export interface Invoice {
  paymentRequest: string;
  paymentHash: string;
  amountSat?: number;
}

export interface Payment {
  paymentHash: string;
  amountSat: number;
  feeSat: number;
  settledAt: number;
}

export interface LnBalance {
  localSat: number; // outbound / spendable
  remoteSat: number; // inbound / receivable
  totalSat: number; // channel capacity
}

export interface NodeInfo {
  pubkey: string;
  alias: string;
  network: string;
}

/**
 * Same interface for the in-memory simulator and the real LND client.
 * The wallet and API never know which one is behind it.
 */
export interface LightningNode {
  info(): Promise<NodeInfo>;
  createInvoice(amountSat: number | undefined, memo: string): Promise<Invoice>;
  payInvoice(paymentRequest: string, amountSat?: number): Promise<Payment>;
  getBalance(): Promise<LnBalance>;
  listInvoices(): Promise<{ paymentRequest: string; amountSat?: number; settled: boolean; paymentHash: string }[]>;
  listPayments(): Promise<Payment[]>;
  /** Inbound liquidity: settle an incoming payment (used by the demo "remittance" sender). */
  receivePayment(amountSat: number, memo: string): Promise<Payment>;
}