import { createRequire } from "node:module";
import { NETWORK, type Utxo } from "./wallet.js";

const require = createRequire(import.meta.url);
const bitcoin = require("bitcoinjs-lib") as typeof import("bitcoinjs-lib");

/**
 * Chain adapter: the wallet reads UTXOs and broadcasts transactions through this
 * interface, so the exact same wallet code runs against the in-memory regtest
 * simulator or a real bitcoind (docker mode) without changes.
 */
export interface Chain {
  getUtxos(address: string): Promise<Utxo[]>;
  getBalanceSat(address: string): Promise<number>;
  /** Faucet: give `address` a spendable coinbase-style UTXO with `confirmations`. */
  fund(address: string, amountSat: number, confirmations?: number): Promise<Utxo>;
  /** Broadcast a signed raw tx. Returns txid once accepted into the mempool. */
  broadcast(rawHex: string): Promise<string>;
  mine(blocks?: number): Promise<number>;
  height(): Promise<number>;
}

interface MempoolEntry {
  txid: string;
  rawHex: string;
  outputAddresses: string[];
  outputValues: number[];
  spentOutpoints: string[];
}

function outpoint(txid: string, vout: number): string {
  return `${txid}:${vout}`;
}

function decode(rawHex: string): { ins: string[]; outs: { address: string; value: number }[] } {
  const tx = bitcoin.Transaction.fromHex(rawHex);
  const ins = tx.ins.map((i) => outpoint(Buffer.from(i.hash).reverse().toString("hex"), i.index));
  const outs = tx.outs.map((o) => {
    let address = "opreturn";
    try {
      address = bitcoin.address.fromOutputScript(o.script, NETWORK);
    } catch {
      address = "unknown";
    }
    return { address, value: o.value };
  });
  return { ins, outs };
}

/**
 * In-memory regtest network. Real keys and real signed transactions, simulated
 * consensus. This makes `npm start` (no Docker) fully demonstrate send/receive,
 * confirmations, and fees end to end.
 */
export class RegtestChain implements Chain {
  private utxos = new Map<string, Utxo[]>();
  private mempool: MempoolEntry[] = [];
  private blocks = 0;
  private nextFundId = 0;

  async height(): Promise<number> {
    return this.blocks;
  }

  async getUtxos(address: string): Promise<Utxo[]> {
    return [...(this.utxos.get(address) || [])];
  }

  async getBalanceSat(address: string): Promise<number> {
    return (this.utxos.get(address) || []).reduce((a, u) => a + u.valueSat, 0);
  }

  async fund(address: string, amountSat: number, confirmations = 6): Promise<Utxo> {
    const utxo: Utxo = {
      txid: Buffer.from(`faucet-${++this.nextFundId}-${address}`).toString("hex").slice(0, 64).padStart(64, "0"),
      vout: 0,
      valueSat: amountSat,
      address,
      confirmations,
    };
    const list = this.utxos.get(address) || [];
    list.push(utxo);
    this.utxos.set(address, list);
    return utxo;
  }

  async broadcast(rawHex: string): Promise<string> {
    const { ins, outs } = decode(rawHex);
    const txid = bitcoin.Transaction.fromHex(rawHex).getId();

    // Remove spent inputs (double-spend guard).
    const spent = new Set(ins);
    for (const [addr, list] of this.utxos) {
      this.utxos.set(
        addr,
        list.filter((u) => !spent.has(outpoint(u.txid, u.vout)))
      );
    }

    // Credit outputs as unconfirmed (mempool) UTXOs.
    outs.forEach((o, vout) => {
      if (o.address === "unknown" || o.address === "opreturn") return;
      const list = this.utxos.get(o.address) || [];
      list.push({ txid, vout, valueSat: o.value, address: o.address, confirmations: 0 });
      this.utxos.set(o.address, list);
    });

    this.mempool.push({ txid, rawHex, outputAddresses: outs.map((o) => o.address), outputValues: outs.map((o) => o.value), spentOutpoints: ins });
    return txid;
  }

  async mine(blocks = 1): Promise<number> {
    for (let b = 0; b < blocks; b++) {
      this.blocks++;
      // Confirm every mempool output.
      for (const addr of this.utxos.keys()) {
        const list = this.utxos.get(addr)!;
        this.utxos.set(
          addr,
          list.map((u) => (u.confirmations === 0 ? { ...u, confirmations: 1 } : { ...u, confirmations: u.confirmations + 1 }))
        );
      }
      this.mempool = [];
    }
    return this.blocks;
  }
}

/** Placeholder for the real bitcoind JSON-RPC adapter (used in docker mode). */
export class BitcoindRpcChain implements Chain {
  constructor(private rpcUrl: string) {}
  async getUtxos(_address: string): Promise<Utxo[]> {
    throw new Error("BitcoindRpcChain: wire JSON-RPC listunspent in docker mode (documented in docs/architecture.md)");
  }
  async getBalanceSat(_address: string): Promise<number> {
    throw new Error("BitcoindRpcChain: not implemented");
  }
  async fund(): Promise<Utxo> {
    throw new Error("BitcoindRpcChain: not implemented");
  }
  async broadcast(): Promise<string> {
    throw new Error("BitcoindRpcChain: not implemented");
  }
  async mine(): Promise<number> {
    throw new Error("BitcoindRpcChain: not implemented");
  }
  async height(): Promise<number> {
    throw new Error("BitcoindRpcChain: not implemented");
  }
}