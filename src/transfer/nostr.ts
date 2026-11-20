import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent, type Event } from "nostr-tools/pure";
import { SimplePool } from "nostr-tools/pool";

/**
 * Nostr attestations.
 *
 * Every time the two sides agree on something — a shared quote, a payout report, an
 * issue and its resolution — UraniumTransfer signs a small, PII-free NIP-78 event.
 * Because the event is signed by the server key, anyone holding the share link can
 * verify that a record was not altered after the fact, even though the app produced
 * it. Publishing to public relays is best-effort: the signed event is always
 * returned by the API, so verification works even with no network.
 */

export const ATTESTATION_KIND = 30078;

const DEFAULT_RELAYS = ["wss://relay.damus.io", "wss://nos.lol", "wss://relay.nostr.band"];

export interface Attestation {
  /** NIP-78 application data. */
  kind: number;
  event: Event;
  /** Relays that accepted the event (empty when offline). */
  relays: string[];
}

export function relayList(value: string | undefined = process.env.NOSTR_RELAYS): string[] {
  const source = value && value.trim() ? value : DEFAULT_RELAYS.join(",");
  return source
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^wss?:\/\/[^\s]+$/i.test(s));
}

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("relay timeout")), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

export class Attestor {
  private readonly secret: Uint8Array;
  readonly pubkey: string;
  readonly kind = ATTESTATION_KIND;

  constructor(secretHex: string | undefined = process.env.NOSTR_SECRET_KEY) {
    this.secret = secretHex && /^[0-9a-fA-F]{64}$/.test(secretHex)
      ? Uint8Array.from(Buffer.from(secretHex, "hex"))
      : generateSecretKey();
    this.pubkey = getPublicKey(this.secret);
  }

  /** Sign a canonical record. Pure and offline. */
  attest(type: string, id: string, revision: number, payload: Record<string, unknown>): Attestation {
    const event: Event = finalizeEvent(
      {
        kind: ATTESTATION_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["d", `${id}:${type}:${revision}`], ["t", "uraniumtransfer"], ["t", type], ["p", this.pubkey]],
        content: JSON.stringify(payload),
      },
      this.secret
    );
    return { kind: ATTESTATION_KIND, event, relays: [] };
  }

  static verify(event: Event): boolean {
    try {
      // nostr-tools caches a verification marker (a symbol key) on the event object.
      // Object spread copies that marker, which would make a tampered copy verify as
      // true. Rebuild the event from its fields so verification is always recomputed.
      const canonical: Event = {
        kind: event.kind,
        created_at: event.created_at,
        tags: event.tags,
        content: event.content,
        pubkey: event.pubkey,
        id: event.id,
        sig: event.sig,
      };
      return verifyEvent(canonical);
    } catch { return false; }
  }

  /** Best-effort publish. Never throws; returns the relays that accepted the event. */
  async publish(event: Event, relays: string[], timeoutMs = Number(process.env.NOSTR_TIMEOUT_MS || 4000)): Promise<string[]> {
    if (!relays.length) return [];
    const pool = new SimplePool();
    const accepted: string[] = [];
    try {
      const promises = pool.publish(relays, event);
      const results = await Promise.allSettled(promises.map((p) => timeout(p, timeoutMs)));
      results.forEach((result, index) => { if (result.status === "fulfilled") accepted.push(relays[index]!); });
    } catch { /* offline: the signed event still exists in the record */ }
    finally { try { pool.close(relays); } catch { /* ignore */ } }
    return accepted;
  }
}

export function isAttestation(value: unknown): value is Attestation {
  const a = value as Attestation | undefined;
  return !!a && typeof a === "object" && typeof a.kind === "number" && !!a.event && typeof a.event.id === "string";
}
