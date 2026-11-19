import { createRequire } from "node:module";
import type { BIP32Interface } from "bip32";
import type { Psbt } from "bitcoinjs-lib";

// The bitcoinjs ecosystem ships CommonJS modules whose default/named exports are
// exposed via getters, which Node's ESM interop mangles. Loading them through
// createRequire is the dependable path.
const require = createRequire(import.meta.url);
const bitcoin = require("bitcoinjs-lib") as typeof import("bitcoinjs-lib");
const bip39 = require("bip39") as typeof import("bip39");
const ecc = require("tiny-secp256k1") as typeof import("tiny-secp256k1");
const bip32Mod = require("bip32") as { default?: unknown; BIP32Factory?: unknown };
const ecpairMod = require("ecpair") as { default?: unknown; ECPairFactory?: unknown };

type Factory = (ecc: unknown) => { fromSeed(seed: Buffer, network: unknown): BIP32Interface };

const BIP32Factory = (bip32Mod.default ?? bip32Mod.BIP32Factory) as Factory;
const ECPairFactory = (ecpairMod.default ?? ecpairMod.ECPairFactory) as (ecc: unknown) => {
  fromPrivateKey(priv: Buffer, opts: { network: unknown }): { privateKey?: Uint8Array; publicKey: Uint8Array };
};

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);
bitcoin.initEccLib(ecc as never); // required for signature validation

export const NETWORK = bitcoin.networks.regtest; // bech32 prefix "bcrt"

/** A forever-unspendable regtest address used as the Lightning "peg" for swaps. */
export const PEG_ADDRESS = bitcoin.payments.p2wpkh({ hash: Buffer.alloc(20, 0x11), network: NETWORK }).address!;

// BIP84-style native segwit path. Coin type 1 = testnet/regtest so the demo stays
// self-contained and never touches mainnet keys.
const DERIVATION = { purpose: 84, coinType: 1, account: 0 };

export interface DerivedKey {
  address: string;
  index: number;
  change: boolean;
  privateKey: Buffer;
  publicKey: Buffer;
  path: string;
}

export interface WalletAccount {
  seedId: string;
  name: string;
  root: BIP32Interface;
  mnemonic?: string; // present only at creation/recovery time, never persisted
  createdAt: number;
}

export interface Utxo {
  txid: string;
  vout: number;
  valueSat: number;
  address: string;
  confirmations: number;
}

/** Derive a key pair at m/84'/1'/0'/{change}/{index}. */
export function deriveKey(root: BIP32Interface, index: number, change: boolean): DerivedKey {
  const path = `m/${DERIVATION.purpose}'/${DERIVATION.coinType}'/${DERIVATION.account}'/${change ? 1 : 0}/${index}`;
  const child = root.derivePath(path);
  if (!child.privateKey || !child.publicKey) throw new Error("derivation produced no key");
  const { address } = bitcoin.payments.p2wpkh({ pubkey: child.publicKey, network: NETWORK });
  if (!address) throw new Error("failed to derive address");
  return {
    address,
    index,
    change,
    privateKey: Buffer.from(child.privateKey),
    publicKey: Buffer.from(child.publicKey),
    path,
  };
}

export function createWallet(name: string): WalletAccount {
  const mnemonic = bip39.generateMnemonic(128); // 12 words
  return fromMnemonic(name, mnemonic);
}

export function recoverWallet(name: string, mnemonic: string): WalletAccount {
  const normalized = mnemonic.trim().toLowerCase();
  if (!bip39.validateMnemonic(normalized)) {
    throw new Error("incorrect mnemonic (checksum)"); // never echo the words back
  }
  return fromMnemonic(name, normalized);
}

function fromMnemonic(name: string, mnemonic: string): WalletAccount {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = bip32.fromSeed(seed, NETWORK);
  const seedId = root.neutered().toBase58().slice(0, 16);
  return { seedId, name, root, mnemonic, createdAt: Date.now() };
}

export function firstReceiveAddress(root: BIP32Interface): string {
  return deriveKey(root, 0, false).address;
}

/**
 * Scan derived addresses with a gap limit and return UTXOs owned by this wallet.
 * `utxosByAddress` comes from the chain adapter.
 */
export function findWalletUtxos(
  root: BIP32Interface,
  utxosByAddress: (address: string) => Utxo[],
  gapLimit = 20
): { utxos: Utxo[]; highestReceive: number; highestChange: number } {
  const utxos: Utxo[] = [];
  const highest = { receive: 0, change: 0 };
  for (const change of [false, true]) {
    let gap = 0;
    for (let i = 0; i < gapLimit + 20; i++) {
      const { address } = deriveKey(root, i, change);
      const found = utxosByAddress(address);
      if (found.length > 0) {
        utxos.push(...found);
        gap = 0;
        if (change) highest.change = Math.max(highest.change, i);
        else highest.receive = Math.max(highest.receive, i);
      } else {
        if (++gap > gapLimit) break;
      }
    }
  }
  return { utxos, highestReceive: highest.receive, highestChange: highest.change };
}

/** Conservative P2WPKH vsize estimate. */
export function estimateVsize(inputs: number, outputs: number): number {
  return 10 + 41 * outputs + 68 * inputs;
}

export interface SendRequest {
  utxos: Utxo[];
  toAddress: string;
  amountSat: number;
  feeRateSatPerVbyte: number;
  changeAddress: string;
  resolveInput: (address: string) => { sign: (psbt: Psbt, inputIndex: number) => void };
}

export interface SendResult {
  txid: string;
  rawHex: string;
  feeSat: number;
  changeSat: number;
  vsize: number;
}

/** Build, sign, and finalize a P2WPKH (native segwit) spend. */
export function buildSignedTx(req: SendRequest): SendResult {
  if (req.amountSat <= 0) throw new Error("amount must be positive");
  if (req.utxos.length === 0) throw new Error("no inputs");

  const totalIn = req.utxos.reduce((a, u) => a + u.valueSat, 0);
  const feeSat = req.feeRateSatPerVbyte * estimateVsize(req.utxos.length, 2);
  const changeSat = totalIn - req.amountSat - feeSat;
  if (changeSat < 0) {
    throw new Error(`insufficient funds: have ${totalIn}, need ${req.amountSat + feeSat} (incl. ${feeSat} fee)`);
  }

  bitcoin.address.toOutputScript(req.toAddress, NETWORK); // throws if invalid

  const psbt = new bitcoin.Psbt({ network: NETWORK });
  const inputAddresses: string[] = [];
  for (const u of req.utxos) {
    const p2wpkh = bitcoin.payments.p2wpkh({ address: u.address, network: NETWORK });
    if (!p2wpkh.output) throw new Error("only P2WPKH inputs supported");
    psbt.addInput({ hash: u.txid, index: u.vout, witnessUtxo: { script: p2wpkh.output, value: u.valueSat } });
    inputAddresses.push(u.address);
  }

  psbt.addOutput({ address: req.toAddress, value: req.amountSat });
  if (changeSat > 0) psbt.addOutput({ address: req.changeAddress, value: changeSat });

  inputAddresses.forEach((address, i) => {
    req.resolveInput(address).sign(psbt, i);
  });

  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();
  return {
    txid: tx.getId(),
    rawHex: tx.toHex(),
    feeSat,
    changeSat,
    vsize: tx.virtualSize(),
  };
}

/** Sign a P2WPKH input with a derived private key (bitcoinjs-lib v6 ECDSA path). */
export function signP2wpkh(psbt: Psbt, inputIndex: number, privateKey: Buffer): void {
  const keyPair = ECPair.fromPrivateKey(privateKey, { network: NETWORK });
  psbt.signInput(inputIndex, keyPair as never);
  const ok = psbt.validateSignaturesOfInput(
    inputIndex,
    (pubkey: Uint8Array, msghash: Uint8Array, sig: Uint8Array) => ecc.verify(msghash, pubkey, sig)
  );
  if (!ok) throw new Error(`signature validation failed for input ${inputIndex}`);
}