import {
  type WalletAccount,
  type Utxo,
  PEG_ADDRESS,
  buildSignedTx,
  createWallet as createBtcWallet,
  deriveKey,
  firstReceiveAddress,
  recoverWallet as recoverBtcWallet,
  signP2wpkh,
} from "./bitcoin/wallet.js";
import type { Chain } from "./bitcoin/chain.js";
import type { LightningNode, Payment, Invoice } from "./lightning/types.js";
import type { NostrClient } from "./nostr.js";
import {
  type Lang,
  type RouteId,
  allRemittanceQuotes,
  analyzeMessage,
  feeExplainSentence,
  remittanceQuote,
  savingsProjection,
} from "./ai/assistant.js";

export interface WalletMeta {
  account: WalletAccount;
  receiveIndex: number;
  changeIndex: number;
  addressIndex: Map<string, { index: number; change: boolean; pubHex: string }>;
  lightningSat: number;
  remittances: Payment[];
}

export interface WalletSummary {
  seedId: string;
  name: string;
  onchainSat: number;
  lightningSat: number;
  totalSat: number;
  address: string;
  createdAt: number;
  remittancesReceived: number;
}

export class WalletService {
  private wallets = new Map<string, WalletMeta>();

  constructor(
    private chain: Chain,
    private lightning: LightningNode,
    private nostr: NostrClient,
    private opts: { feeRate: number } = { feeRate: 1 }
  ) {}

  async init(): Promise<void> {
    await this.lightning.info();
  }

  async createWallet(name: string): Promise<{ summary: WalletSummary; mnemonic: string }> {
    const account = createBtcWallet(name);
    const mnemonic = account.mnemonic!;
    const meta = this.newMeta(account);
    this.register(meta, 0, false);
    this.wallets.set(account.seedId, meta);
    return { summary: await this.summary(account.seedId), mnemonic };
  }

  async recoverWallet(name: string, mnemonic: string): Promise<WalletSummary> {
    const account = recoverBtcWallet(name, mnemonic);
    const meta = this.newMeta(account);
    this.register(meta, 0, false);
    this.wallets.set(account.seedId, meta);
    return this.summary(account.seedId);
  }

  private newMeta(account: WalletAccount): WalletMeta {
    account.mnemonic = undefined; // drop plaintext words immediately
    return { account, receiveIndex: 0, changeIndex: 0, addressIndex: new Map(), lightningSat: 0, remittances: [] };
  }

  private get(seedId: string): WalletMeta {
    const m = this.wallets.get(seedId);
    if (!m) throw new Error("wallet not found");
    return m;
  }

  private register(meta: WalletMeta, index: number, change: boolean): void {
    const k = deriveKey(meta.account.root, index, change);
    if (!meta.addressIndex.has(k.address)) {
      meta.addressIndex.set(k.address, { index, change, pubHex: k.publicKey.toString("hex") });
    }
  }

  private async ownedUtxos(seedId: string): Promise<Utxo[]> {
    const meta = this.get(seedId);
    const utxos: Utxo[] = [];
    const seen = new Set<string>();
    for (const change of [false, true]) {
      const limit = change ? meta.changeIndex : meta.receiveIndex;
      for (let i = 0; i <= limit + 5; i++) {
        const k = deriveKey(meta.account.root, i, change);
        this.register(meta, i, change);
        const list = await this.chain.getUtxos(k.address);
        for (const u of list) {
          if (!seen.has(u.txid + ":" + u.vout)) {
            seen.add(u.txid + ":" + u.vout);
            utxos.push(u);
          }
        }
      }
    }
    return utxos;
  }

  async summary(seedId: string): Promise<WalletSummary> {
    const meta = this.get(seedId);
    const utxos = await this.ownedUtxos(seedId);
    const onchainSat = utxos.reduce((a, u) => a + u.valueSat, 0);
    return {
      seedId,
      name: meta.account.name,
      onchainSat,
      lightningSat: meta.lightningSat,
      totalSat: onchainSat + meta.lightningSat,
      address: deriveKey(meta.account.root, meta.receiveIndex, false).address,
      createdAt: meta.account.createdAt,
      remittancesReceived: meta.remittances.length,
    };
  }

  async list(): Promise<WalletSummary[]> {
    const out: WalletSummary[] = [];
    for (const seedId of this.wallets.keys()) out.push(await this.summary(seedId));
    return out;
  }

  async currentAddress(seedId: string): Promise<string> {
    const meta = this.get(seedId);
    return deriveKey(meta.account.root, meta.receiveIndex, false).address;
  }

  async nextAddress(seedId: string): Promise<string> {
    const meta = this.get(seedId);
    const k = deriveKey(meta.account.root, meta.receiveIndex, false);
    this.register(meta, meta.receiveIndex, false);
    if (!meta.addressIndex.has(k.address)) throw new Error("address registration failed");
    const addr = k.address;
    meta.receiveIndex++;
    return addr;
  }

  /** Faucet: simulate buying BTC or receiving on-chain (the savings layer). */
  async faucet(seedId: string, amountSat: number, confirmations = 6): Promise<{ txid: string; address: string }> {
    const addr = await this.currentAddress(seedId);
    await this.chain.fund(addr, amountSat, confirmations);
    return { txid: "faucet", address: addr };
  }

  /** Send BTC on-chain. Real signed transaction broadcast to the chain. */
  async sendOnchain(seedId: string, toAddress: string, amountSat: number): Promise<{ txid: string; feeSat: number }> {
    const meta = this.get(seedId);
    const utxos = await this.ownedUtxos(seedId);
    const changeK = deriveKey(meta.account.root, meta.changeIndex, true);
    this.register(meta, meta.changeIndex, true);
    const changeAddress = changeK.address;
    meta.changeIndex++;

    const result = buildSignedTx({
      utxos,
      toAddress,
      amountSat,
      feeRateSatPerVbyte: this.opts.feeRate,
      changeAddress,
      resolveInput: (address) => {
        const info = this.findKeyByAddress(meta, address);
        return { sign: (psbt, i) => signP2wpkh(psbt, i, info.privateKey) };
      },
    });
    const txid = await this.chain.broadcast(result.rawHex);
    return { txid, feeSat: result.feeSat };
  }

  private findKeyByAddress(meta: WalletMeta, address: string): { privateKey: Buffer; index: number; change: boolean } {
    const info = meta.addressIndex.get(address);
    if (info) return deriveKey(meta.account.root, info.index, info.change);
    for (const change of [false, true]) {
      for (let i = 0; i < 200; i++) {
        const k = deriveKey(meta.account.root, i, change);
        if (k.address === address) return k;
      }
    }
    throw new Error("address does not belong to this wallet");
  }

  /** Top up the Lightning spending layer from on-chain savings (simulated submarine swap). */
  async topUpLightning(seedId: string, amountSat: number): Promise<{ txid: string; lightningSat: number }> {
    const { txid } = await this.sendOnchain(seedId, PEG_ADDRESS, amountSat);
    const meta = this.get(seedId);
    meta.lightningSat += amountSat;
    return { txid, lightningSat: meta.lightningSat };
  }

  async createInvoice(seedId: string, amountSat: number | undefined, memo: string): Promise<Invoice> {
    void seedId;
    return this.lightning.createInvoice(amountSat, memo);
  }

  async receiveRemittance(seedId: string, amountSat: number, memo = "Remittance (Lightning)"): Promise<Payment> {
    const meta = this.get(seedId);
    await this.lightning.createInvoice(amountSat, memo);
    const payment = await this.lightning.receivePayment(amountSat, memo);
    meta.lightningSat += amountSat;
    meta.remittances.push(payment);
    await this.nostr.publishReceipt(1, `Remittance of ${amountSat} sat settled (${memo})`, [["t", "remittance"]]);
    return payment;
  }

  async payLightning(seedId: string, paymentRequest: string, amountSat?: number): Promise<Payment> {
    const meta = this.get(seedId);
    const payment = await this.lightning.payInvoice(paymentRequest, amountSat);
    meta.lightningSat -= payment.amountSat;
    return payment;
  }

  async withdrawOnchain(seedId: string, amountSat: number): Promise<{ txid: string; address: string; lightningSat: number }> {
    const meta = this.get(seedId);
    if (meta.lightningSat < amountSat) throw new Error("not enough lightning balance");
    meta.lightningSat -= amountSat;
    const addr = await this.nextAddress(seedId);
    await this.chain.fund(addr, amountSat, 0); // simulate swap-out crediting on-chain
    return { txid: "swap-out", address: addr, lightningSat: meta.lightningSat };
  }

  async remittanceQuotes(amountFcfa: number) {
    return allRemittanceQuotes(amountFcfa);
  }

  async quote(route: RouteId, amountFcfa: number) {
    return remittanceQuote(route, amountFcfa);
  }

  async feeSentence(route: RouteId, amountFcfa: number, lang: Lang) {
    return feeExplainSentence(amountFcfa, route, lang);
  }

  async analyze(text: string, lang: Lang) {
    return analyzeMessage(text, lang);
  }

  async savings(monthlyFcfa: number, years: number, lang: Lang) {
    return savingsProjection(monthlyFcfa, years, lang);
  }
}