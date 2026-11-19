import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools/pure";

/**
 * Nostr integration: Teranga publishes signed receipts for settled remittances
 * and a lightweight merchant/community directory, so trust is verifiable without
 * any central server. Dev/demo mode signs locally and returns the event; when a
 * writable relay list is configured it also publishes.
 */
export interface NostrClient {
  publishReceipt(kind: number, content: string, tags: string[][]): Promise<{ eventId: string; signedEvent: unknown }>;
  publishMerchant(npub: string, name: string, location: string): Promise<{ eventId: string }>;
}

export function createNostrSigner(secretKeyHex?: string) {
  const sk = secretKeyHex || Buffer.from(generateSecretKey()).toString("hex");
  const pk = getPublicKey(Buffer.from(sk, "hex"));
  return { sk, pk };
}

export class LocalNostr implements NostrClient {
  private sk: Uint8Array;
  public readonly pk: string;

  constructor(secretKeyHex?: string) {
    const signer = createNostrSigner(secretKeyHex);
    this.sk = Buffer.from(signer.sk, "hex");
    this.pk = signer.pk;
  }

  private signEvent(kind: number, content: string, tags: string[][] = []) {
    const created = Math.floor(Date.now() / 1000);
    const base = { kind, created_at: created, tags, content };
    return finalizeEvent(base, this.sk);
  }

  async publishReceipt(kind: number, content: string, tags: string[][]): Promise<{ eventId: string; signedEvent: unknown }> {
    const ev = this.signEvent(kind, content, tags);
    return { eventId: ev.id, signedEvent: ev };
  }

  async publishMerchant(npub: string, name: string, location: string): Promise<{ eventId: string }> {
    const ev = this.signEvent(30020, JSON.stringify({ name }), [["d", name.toLowerCase().replace(/\s+/g, "-")], ["p", npub], ["location", location]]);
    return { eventId: ev.id };
  }
}