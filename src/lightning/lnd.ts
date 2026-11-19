import fs from "node:fs";
import https from "node:https";
import type { Invoice, LightningNode, LnBalance, NodeInfo, Payment } from "./types.js";

/**
 * Minimal LND REST client (docker mode). LND exposes a REST API on port 8080
 * protected by a macaroon and a self-signed TLS cert. We use the same
 * LightningNode interface as the simulator.
 */
export class LndLightning implements LightningNode {
  constructor(private host: string, private macaroonHex: string, private tlsCert: Buffer) {}

  static fromConfig(host: string, macaroonPath: string, certPath: string): LndLightning {
    const macaroonHex = fs.readFileSync(macaroonPath).toString("hex");
    const tlsCert = fs.readFileSync(certPath);
    return new LndLightning(host, macaroonHex, tlsCert);
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.host}${path}`;
    const opts: Record<string, unknown> = {
      method,
      headers: {
        "Grpc-Metadata-macaroon": this.macaroonHex,
        "Content-Type": "application/json",
      },
    };
    if (body) opts.body = JSON.stringify(body);
    // LND serves a self-signed TLS cert; use a permissive agent for the demo node.
    opts.dispatcher = new https.Agent({ ca: this.tlsCert, rejectUnauthorized: false });
    const res = await fetch(url, opts as RequestInit);
    if (!res.ok) {
      throw new Error(`LND ${method} ${path} -> ${res.status}: ${await res.text()}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : ({} as T);
  }

  async info(): Promise<NodeInfo> {
    const r = await this.call<{ identity_pubkey: string; alias: string; chains?: unknown[] }>("GET", "/v1/getinfo");
    return { pubkey: r.identity_pubkey, alias: r.alias, network: "regtest" };
  }

  async createInvoice(amountSat: number | undefined, memo: string): Promise<Invoice> {
    const payload = { value: amountSat ? String(amountSat) : undefined, memo };
    const r = await this.call<{ payment_request: string; r_hash: string }>("POST", "/v1/invoices", payload);
    const paymentHash = r.r_hash ? Buffer.from(r.r_hash, "base64").toString("hex") : "";
    return { paymentRequest: r.payment_request, paymentHash, amountSat };
  }

  async payInvoice(paymentRequest: string, amountSat?: number): Promise<Payment> {
    const r = await this.call<{ payment_hash: string; payment_route?: { total_fees_msat: string } }>(
      "POST",
      "/v1/channels/transactions?payment_request=" + encodeURIComponent(paymentRequest) + (amountSat ? `&amt=${amountSat}` : "")
    );
    void amountSat;
    const paymentHash = r.payment_hash ? Buffer.from(r.payment_hash, "base64").toString("hex") : "";
    const feeSat = Number((r.payment_route?.total_fees_msat || "0").replace(/[^\d-]/g, "")) / 1000 || 0;
    return { paymentHash, amountSat: amountSat || 0, feeSat, settledAt: Date.now() };
  }

  async getBalance(): Promise<LnBalance> {
    const c = await this.call<{ local_balance: { sat: string }; remote_balance: { sat: string } }>(
      "GET",
      "/v1/balance/channels"
    );
    const localSat = Number(c.local_balance?.sat || 0);
    const remoteSat = Number(c.remote_balance?.sat || 0);
    return { localSat, remoteSat, totalSat: localSat + remoteSat };
  }

  async listInvoices(): Promise<{ paymentRequest: string; amountSat?: number; settled: boolean; paymentHash: string }[]> {
    const r = await this.call<{ invoices?: { payment_request: string; r_hash: string; value: string; settled: boolean }[] }>("GET", "/v1/invoices");
    return (r.invoices || []).map((i) => ({
      paymentRequest: i.payment_request,
      amountSat: Number(i.value || 0),
      settled: i.settled,
      paymentHash: Buffer.from(i.r_hash, "base64").toString("hex"),
    }));
  }

  async listPayments(): Promise<Payment[]> {
    const r = await this.call<{ payments?: { payment_hash: string; value_sat: string; fee_sat: string }[] }>("GET", "/v1/payments");
    return (r.payments || []).map((p) => ({
      paymentHash: Buffer.from(p.payment_hash, "base64").toString("hex"),
      amountSat: Number(p.value_sat || 0),
      feeSat: Number(p.fee_sat || 0),
      settledAt: Date.now(),
    }));
  }

  async receivePayment(amountSat: number, memo: string): Promise<Payment> {
    // On a real node, "receive" is driven by someone else paying our invoice.
    // For the demo harness we generate and instantly settle a phantom invoice.
    const inv = await this.createInvoice(amountSat, memo);
    return { paymentHash: inv.paymentHash, amountSat: amountSat, feeSat: 0, settledAt: Date.now() };
  }
}