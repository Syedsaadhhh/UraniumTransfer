# The trust layer: attestations, AI, and resolution

This adds three small, honest layers on top of the recipient-first planner. None of
them changes the money math; all of them work with **no keys and no network**.

## 1. Nostr attestations (`src/transfer/nostr.ts`)

Every shared decision is signed as a **NIP-78** event (`kind 30078`) by a server key:

- selecting a quote,
- the recipient's payout report,
- an issue report and its resolution.

The signed event is stored in the request record and returned by the API, so either
side can verify it. Publishing to relays is **best-effort** and never blocks a
response; if relays are unreachable the signed event still exists and still verifies.

Content is deliberately **PII-free**: request id, currencies, rail, amounts, the quote
revision and timestamps. No names, account numbers or payment credentials.

Verification is recomputed from the event fields. (Note: `nostr-tools` caches a
verification marker as a symbol property on an event; a naive `{ ...event }` copies it
and would make a tampered copy "verify". `Attestor.verify` rebuilds the event from its
fields to force a real check — see `test/trust.test.ts`.)

## 2. AI safety advisor (`src/transfer/ai.ts`)

Two layers, by design:

- **Rules engine** — deterministic, offline, multilingual patterns for classic fraud:
  urgency, guaranteed returns, "send first", seed-phrase requests, impersonation, and
  the wrong-transfer refund scam. This is the floor and always answers.
- **LLM layer** — any OpenAI-compatible endpoint (`AI_API_KEY`, `AI_BASE_URL`,
  `AI_MODEL`). Given pasted text it returns `{safe, signals, recommendation}`. If the
  key is missing, the call is slow or it returns junk, we fall back to the rules
  engine.

The model is only ever asked to **classify pasted text**. It never produces rates,
fees or amounts, so it cannot corrupt the planner's arithmetic. (This keeps the
`novelty-review.md` guardrail: no AI fee extraction.)

## 3. Resolution engine (`src/transfer/resolution.ts`)

Turns a recorded failure into an ordered, escalating plan:

- **wrong destination**, **fee on a failed operation**, **short payout**, **not
  collected yet**, or **other**.
- Steps are cheapest-first: keep evidence → raise with the provider → recall/fee
  dispute/reconcile → escalate to the regulator on a clock → choose a rail with
  recourse next time.
- It **never asserts a cause** it cannot prove. The difference is reported, not
  explained.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/config` | adds `nostr {enabled,pubkey,relays}` and `ai {enabled,model}` |
| `POST` | `/api/assistant/analyze` | `{text, lang}` → AI/rules fraud verdict |
| `POST` | `/api/requests/:id/issue` | recipient capability; stores an issue + resolution + attestation |
| `GET` | `/api/requests/:id/verify` | returns the signed attestations with a `valid` flag |
| `GET` | `/api/requests/:id/explain` | neutral, plain-language reading of the record |

## Configuration

See `.env.example`. Everything is optional. `NOSTR_DISABLE=true` turns signing off;
with no `AI_API_KEY` the rules engine answers.
