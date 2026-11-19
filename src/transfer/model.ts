import { randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const currencies = Intl.supportedValuesOf("currency");
export type Rail = "wallet" | "cash" | "mobile" | "bank";
export type Mode = "sandbox" | "testnet";
const rails = new Set(["wallet", "cash", "mobile", "bank"]);
export const invoiceTTL = 15 * 60 * 1000;
const retention = 30 * 24 * 60 * 60 * 1000;
export const senderStartSat = 2_000_000;

export class InputError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError("invalid_input");
  return value as Record<string, unknown>;
}

function currency(value: unknown): string {
  if (typeof value !== "string" || !currencies.includes(value)) throw new InputError("invalid_currency");
  return value;
}

export function digits(code: string): number {
  return new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits!;
}

function decimal(value: unknown, fraction: number, max: bigint): bigint {
  if (typeof value !== "string" || !/^\d{1,9}(?:[.,]\d{1,8})?$/.test(value)) throw new InputError("invalid_amount");
  const [whole, part = ""] = value.replace(",", ".").split(".");
  if (part.length > fraction) throw new InputError("invalid_precision");
  const result = BigInt(whole + part.padEnd(fraction, "0"));
  if (result > max) throw new InputError("invalid_amount");
  return result;
}

function label(value: unknown, max: number, fallback = ""): string {
  if (value === undefined || value === "") return fallback;
  if (typeof value !== "string" || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new InputError("invalid_input");
  return value.trim() || fallback;
}

const identifier = () => randomBytes(18).toString("base64url");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const same = (a: string, b: string) => timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));

export interface Target {
  from: string;
  to: string;
  origin: string;
  destination: string;
  targetMinor: number;
  rail: Rail;
}

export function targetFrom(value: unknown): Target {
  const b = object(value);
  const from = currency(b.from), to = currency(b.to);
  const targetMinor = Number(decimal(b.target, digits(to), 100_000_000_000n));
  if (!targetMinor) throw new InputError("invalid_amount");
  if (typeof b.rail !== "string" || !rails.has(b.rail)) throw new InputError("invalid_rail");
  return { from, to, targetMinor, rail: b.rail as Rail, origin: label(b.origin, 48), destination: label(b.destination, 48) };
}

/** Reverse quote: round the required spend UP to the smallest sender currency unit. */
export function compare(target: Target, raw: unknown) {
  if (!Array.isArray(raw) || raw.length > 5) throw new InputError("invalid_input");
  const scale = 100_000_000n;
  const rows = raw.map((row, index) => {
    const b = object(row);
    if (typeof b.rail !== "string" || !rails.has(b.rail)) throw new InputError("invalid_rail");
    const common = { index, name: label(b.name, 40, `Route ${index + 1}`), rail: b.rail, source: label(b.source, 80) };
    if (b.rail !== target.rail) return { ...common, reason: "payout_mismatch", requiredMinor: null };
    if (!b.rate || b.senderFee === "" || b.receiverFee === "" || b.percentFee === "" ||
        b.senderFee == null || b.receiverFee == null || b.percentFee == null) {
      return { ...common, reason: "quote_incomplete", requiredMinor: null };
    }
    const rate = decimal(b.rate, 8, 10n ** 15n);
    if (!rate) throw new InputError("invalid_rate");
    const fixed = decimal(b.senderFee, digits(target.from), 100_000_000_000n);
    const deduction = decimal(b.receiverFee, digits(target.to), 100_000_000_000n);
    const percent = decimal(b.percentFee, 2, 10_000n);
    // Provider's percentage surcharge is applied to the transfer principal, not the total.
    const numerator = (BigInt(target.targetMinor) + deduction) * scale * BigInt(10 ** digits(target.from));
    const denominator = rate * BigInt(10 ** digits(target.to));
    const principal = (numerator + denominator - 1n) / denominator;
    const fee = fixed + (principal * percent + 9999n) / 10_000n;
    const required = principal + fee;
    if (required > 1_000_000_000_000n) throw new InputError("quote_out_of_range");
    return { ...common, reason: null, requiredMinor: Number(required), principalMinor: Number(principal), senderFeeMinor: Number(fee), receiverFeeMinor: Number(deduction) };
  });
  const costs = rows.flatMap(row => row.requiredMinor == null ? [] : [row.requiredMinor]);
  return { rows, lowestMinor: costs.length ? Math.min(...costs) : null };
}

export interface Invoice {
  paymentHash: string;
  paymentRequest: string;
  amountSat: number;
  expiresAt: number;
}
export interface Settlement {
  paymentHash: string;
  amountSat: number;
  settledAt: number;
  mode: Mode;
}
export interface Transfer extends Target {
  id: string;
  ownerHash: string;
  mode: Mode;
  createdAt: number;
  invoice?: Invoice;
  settlement?: Settlement;
}

export interface TestWallet {
  network: string;
  createInvoice(amountSat: number): Promise<Invoice>;
  lookupInvoice(paymentHash: string): Promise<Settlement | undefined>;
}

export class Transfers {
  private rows: Map<string, Transfer>;

  constructor(private filename: string | undefined, private wallet?: TestWallet, private now = Date.now) {
    let rows: Transfer[] = [];
    if (filename) {
      try { rows = JSON.parse(readFileSync(filename, "utf8")); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    }
    this.rows = new Map(rows.map(row => [row.id, row]));
  }

  get mode(): Mode { return this.wallet ? "testnet" : "sandbox"; }

  private save(row: Transfer): void {
    const next = new Map([...this.rows].filter(([, v]) => this.now() - v.createdAt < retention));
    next.set(row.id, row);
    if (this.filename) {
      mkdirSync(dirname(this.filename), { recursive: true, mode: 0o700 });
      const temp = this.filename + ".tmp";
      writeFileSync(temp, JSON.stringify([...next.values()]), { mode: 0o600 });
      renameSync(temp, this.filename);
    }
    this.rows = next;
  }

  private get(id: string): Transfer {
    const row = this.rows.get(id);
    if (!row || this.now() - row.createdAt >= retention) throw new InputError("request_not_found", 404);
    return row;
  }

  view(id: string) {
    const { ownerHash: _, ...row } = this.get(id);
    return {
      ...row,
      state: row.settlement ? "paid_wallet" : row.invoice ?
        (this.now() >= row.invoice.expiresAt ? "invoice_expired" : "waiting") : "no_invoice",
      cashPayoutVerified: false,
      sandboxBalances: row.mode === "sandbox" ? {
        senderSat: senderStartSat - (row.settlement?.amountSat ?? 0), recipientSat: row.settlement?.amountSat ?? 0,
      } : undefined,
    };
  }

  create(target: Target) {
    if (this.rows.size >= 2500 && [...this.rows.values()].filter(row => this.now() - row.createdAt < retention).length >= 2500) {
      throw new InputError("capacity", 503);
    }
    const owner = identifier();
    const row: Transfer = { ...target, id: identifier(), ownerHash: hash(owner), mode: this.mode, createdAt: this.now() };
    this.save(row);
    return { request: this.view(row.id), owner };
  }

  quote(id: string, rows: unknown) { return compare(this.get(id), rows); }

  private creating = new Set<string>();

  async invoice(id: string, owner: string, raw: unknown) {
    const row = this.get(id);
    if (!same(hash(owner), row.ownerHash)) throw new InputError("not_recipient", 403);
    if (row.mode !== this.mode) throw new InputError("mode_changed", 409);
    if (row.settlement || (row.invoice && this.now() < row.invoice.expiresAt)) throw new InputError("invoice_exists", 409);
    if (this.creating.has(id)) throw new InputError("invoice_exists", 409);
    const { amountSat } = object(raw);
    if (typeof amountSat !== "number" || !Number.isSafeInteger(amountSat) || amountSat < 1 || amountSat > senderStartSat) throw new InputError("invalid_amount");
    this.creating.add(id);
    try {
      // Check the old test-network invoice before replacing it, even if its displayed expiry passed.
      if (row.invoice && await this.checkNode(row)) return this.view(id);
      const paymentHash = randomBytes(32).toString("hex");
      const invoice = this.wallet ? await this.wallet.createInvoice(amountSat) : {
        paymentHash, paymentRequest: `sandbox:${paymentHash}`, amountSat, expiresAt: this.now() + invoiceTTL,
      };
      this.save({ ...this.get(id), invoice });
      return this.view(id);
    } finally { this.creating.delete(id); }
  }

  paySandbox(id: string, owner: string, raw: unknown) {
    const row = this.get(id);
    if (row.mode !== "sandbox" || this.mode !== "sandbox") throw new InputError("not_sandbox", 409);
    if (same(hash(owner), row.ownerHash)) throw new InputError("open_sender_link", 403);
    const { paymentHash } = object(raw);
    if (!row.invoice || row.invoice.paymentHash !== paymentHash) throw new InputError("invoice_mismatch", 409);
    if (row.settlement) return this.view(id);
    if (this.now() >= row.invoice.expiresAt) throw new InputError("invoice_expired", 409);
    this.save({ ...row, settlement: { paymentHash, amountSat: row.invoice.amountSat, settledAt: this.now(), mode: row.mode } });
    return this.view(id);
  }

  private async checkNode(row: Transfer): Promise<boolean> {
    if (!this.wallet || row.mode !== "testnet" || !row.invoice || row.settlement) return false;
    const settled = await this.wallet.lookupInvoice(row.invoice.paymentHash);
    if (!settled) return false;
    const current = this.get(row.id);
    if (!current.settlement && current.invoice?.paymentHash === settled.paymentHash && row.invoice.amountSat === settled.amountSat) {
      this.save({ ...current, settlement: settled });
      return true;
    }
    return !!current.settlement;
  }

  async refresh(id: string) {
    await this.checkNode(this.get(id));
    return this.view(id);
  }
}
