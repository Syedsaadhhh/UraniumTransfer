import { readFileSync } from "node:fs";
import { request } from "node:https";
import { invoiceTTL, type Invoice, type Settlement, type TestWallet } from "./model.js";

const testChains = new Set(["regtest", "testnet", "testnet3", "testnet4", "signet", "simnet"]);

export class LndReceiver implements TestWallet {
  private constructor(private host: URL, private ca: Buffer, private macaroon: string, public network: string) {}

  static async open(host: string, cert: string, invoiceMacaroon: string) {
    const url = new URL(host);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("Provide an HTTPS LND REST origin");
    }
    const node = new LndReceiver(url, readFileSync(cert), readFileSync(invoiceMacaroon).toString("hex"), "");
    const info = await node.call<{ chains?: { chain: string; network: string }[] }>("/v1/getinfo");
    // LND's invoice.macaroon includes invoice permissions only. GetInfo may require a
    // separately baked info permission. Fail closed if we can't confirm the chain.
    const chain = info.chains?.[0];
    if (chain?.chain !== "bitcoin" || !testChains.has(chain.network)) throw new Error("LND must be on a supported Bitcoin test network");
    node.network = chain.network;
    return node;
  }

  private call<T>(pathname: string, payload?: object): Promise<T> {
    return new Promise((resolve, reject) => {
      const body = payload ? JSON.stringify(payload) : undefined;
      const req = request(new URL(pathname, this.host), {
        ca: this.ca, rejectUnauthorized: true, method: body ? "POST" : "GET",
        headers: {
          "Grpc-Metadata-macaroon": this.macaroon,
          ...(body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : {}),
        },
        signal: AbortSignal.timeout(5500),
      }, res => {
        if (res.statusCode !== 200) { res.resume(); reject(new Error(`LND returned HTTP ${res.statusCode}`)); return; }
        let json = "";
        res.setEncoding("utf8");
        res.on("data", chunk => { json += chunk; if (json.length > 65_536) req.destroy(new Error("LND response too large")); });
        res.on("error", reject);
        res.on("end", () => {
          try { resolve(JSON.parse(json) as T); } catch { reject(new Error("Invalid LND response")); }
        });
      });
      req.on("error", reject);
      req.end(body);
    });
  }

  async createInvoice(amountSat: number): Promise<Invoice> {
    const result = await this.call<{ r_hash: string; payment_request: string }>("/v1/invoices", {
      value: String(amountSat), expiry: String(invoiceTTL / 1000), memo: "UraniumTransfer · test invoice",
    });
    const paymentHash = Buffer.from(result.r_hash, "base64").toString("hex");
    if (paymentHash.length !== 64 || !/^ln[a-z0-9]{25,2048}$/.test(result.payment_request)) throw new Error("Invalid LND invoice");
    return { paymentHash, paymentRequest: result.payment_request, amountSat, expiresAt: Date.now() + invoiceTTL };
  }

  async lookupInvoice(paymentHash: string): Promise<Settlement | undefined> {
    const invoice = await this.call<{ state: string; r_hash: string; amt_paid_sat: string; settle_date: string }>(`/v1/invoice/${paymentHash}`);
    if (invoice.state !== "SETTLED") return;
    const amountSat = Number(invoice.amt_paid_sat), settledAt = Number(invoice.settle_date) * 1000;
    if (!Number.isSafeInteger(amountSat) || amountSat <= 0 || !Number.isSafeInteger(settledAt) || settledAt <= 0) throw new Error("Invalid LND settlement");
    return { paymentHash: Buffer.from(invoice.r_hash, "base64").toString("hex"), amountSat, settledAt, mode: "testnet" };
  }
}
