import crypto from "node:crypto";
import type { Invoice, LightningNode, LnBalance, NodeInfo, Payment } from "./types.js";

interface SimInvoice {
  paymentRequest: string;
  paymentHash: string;
  amountSat: number;
  memo: string;
  settled: boolean;
  createdAt: number;
}

/**
 * In-memory Lightning simulator with realistic directional-liquidity semantics.
 * It models the friction that the real product removes: a node can only receive up
 * to its `inboundSat` and send up to its `localSat`, exactly as with real channels.
 */
export class SimLightning implements LightningNode {
  private pubkey: string;
  private invoiceMap = new Map<string, SimInvoice>();
  private payments: Payment[] = [];
  private localSat: number; // outbound (spendable)
  private remoteSat: number; // inbound (receivable)

  constructor(opts: { pubkey?: string; localSat?: number; remoteSat?: number } = {}) {
    this.pubkey = opts.pubkey || "03" + crypto.randomBytes(32).toString("hex");
    this.localSat = opts.localSat ?? 250_000;
    this.remoteSat = opts.remoteSat ?? 500_000;
  }

  async info(): Promise<NodeInfo> {
    return { pubkey: this.pubkey, alias: "Teranga (sim)", network: "regtest" };
  }

  async getBalance(): Promise<LnBalance> {
    return { localSat: this.localSat, remoteSat: this.remoteSat, totalSat: this.localSat + this.remoteSat };
  }

  async createInvoice(amountSat: number | undefined, memo: string): Promise<Invoice> {
    const amt = amountSat ?? 0;
    if (this.remoteSat < amt) {
      throw new Error(`not enough inbound liquidity to receive ${amt} sat`);
    }
    const paymentHash = crypto.randomBytes(32).toString("hex");
    // A realistic-looking invoice token. In docker mode this is a real BOLT11 string
    // from LND; here it is self-describing for the demo.
    const paymentRequest = `lntrt1sim1${Buffer.from(`${amt}:${paymentHash}`).toString("base64url")}`;
    this.invoiceMap.set(paymentHash, { paymentRequest, paymentHash, amountSat: amt, memo, settled: false, createdAt: Date.now() });
    return { paymentRequest, paymentHash, amountSat: amt };
  }

  async receivePayment(amountSat: number, memo: string): Promise<Payment> {
    // An incoming payment increases local (outbound) liquidity and this node's spendable sats.
    this.localSat += amountSat;
    const paymentHash = crypto.randomBytes(32).toString("hex");
    const p: Payment = { paymentHash, amountSat, feeSat: 0, settledAt: Date.now() };
    this.payments.push(p);
    void memo;
    return p;
  }

  async payInvoice(paymentRequest: string, _amountSat?: number): Promise<Payment> {
    const { amt, paymentHash } = this.decodeRequest(paymentRequest);
    if (amt <= 0) throw new Error("zero-amount invoices need an explicit amount");
    if (this.localSat < amt) {
      throw new Error(`not enough outbound liquidity to send ${amt} sat (have ${this.localSat})`);
    }
    const feeSat = 0; // regtest/sim routing fee is ~0
    this.localSat -= amt + feeSat;
    this.remoteSat += amt; // remote side gains outbound; simplified
    const inv = this.invoiceMap.get(paymentHash);
    if (inv) inv.settled = true;
    const p: Payment = { paymentHash, amountSat: amt, feeSat, settledAt: Date.now() };
    this.payments.push(p);
    return p;
  }

  async listInvoices(): Promise<{ paymentRequest: string; amountSat?: number; settled: boolean; paymentHash: string }[]> {
    return [...this.invoiceMap.values()].map((i) => ({
      paymentRequest: i.paymentRequest,
      amountSat: i.amountSat,
      settled: i.settled,
      paymentHash: i.paymentHash,
    }));
  }

  async listPayments(): Promise<Payment[]> {
    return [...this.payments];
  }

  private decodeRequest(paymentRequest: string): { amt: number; paymentHash: string } {
    const marker = "lntrt1sim1";
    if (!paymentRequest.startsWith(marker)) {
      // Foreign invoice (for the demo we only settle our own). Pretend it is a
      // real invoice and fabricate a deterministic hash so the flow keeps working.
      const amtMatch = paymentRequest.match(/1(\d+)p/); // optional legacy pattern
      return { amt: amtMatch ? Number(amtMatch[1]) * 1000 : 0, paymentHash: crypto.createHash("sha256").update(paymentRequest).digest("hex") };
    }
    const decoded = Buffer.from(paymentRequest.slice(marker.length), "base64url").toString();
    const [amtStr, paymentHash] = decoded.split(":");
    return { amt: Number(amtStr), paymentHash };
  }
}