# Teranga — Metrics, constraints & next iteration

## Metrics to track (from day one of a real build)

| Metric | What it proves | Instrumentation |
| --- | --- | --- |
| Remittance fee savings per tx | Real cost advantage vs WU/Wave/OM | Compare quote vs settled amount, log delta |
| Number of received remittances | Adoption of the core flow | counters on `receiveRemittance` |
| On-chain savings balance per user | Shifting users from bank to hard money | wallet summaries over time |
| Scam offers flagged | Advisor value + safety | log signal count/type per analysis |
| Time-to-first-receive | Onboarding friction | telemetry (opt-in) |
| Invoice success rate / failure reason | Lightning reliability | payment state machine |
| Weekly active wallets | Retention | heartbeat |

## Known constraints (MVP, explicit)

1. **Simulated network in the default demo** — real keys/txs, simulated consensus. Docker path
   (real bitcoind + LND) is provided but unverified in this environment.
2. **Single-node, server-side keys** — no per-user Lightning tenant or browser-enclave signing.
3. **In-memory persistence** — wallets vanish on restart (deliberate, reduces at-rest key risk).
4. **Static FCFA/sat rate** — no live FX feed.
5. **No on/off-ramp to Wave/Orange Money** — the biggest adoption gap for a savings-turned-spending story.
6. **English/French/Wolof only** — not the full local language surface.

## Next iteration (ordered by impact)

1. **Per-user Lightning keys** — Greenlight / multi-tenant LND so each user genuinely holds
   their own keys, not an account on a shared node. This is the single biggest step from
   "demo" to "self-custodial product."
2. **Real on/off-ramp** — swap-in from Wave/Orange Money and swap-out to cash, integrated with
   a licensed partner; this is what turns received sats into *spendable* money.
3. **Nostr merchant directory** — publish/query nearby merchants who accept Lightning, so
   recipients can actually spend (ties the Nostr promise to the Day-1 flow).
4. **Atomic savings goals + DCA** — round-ups and scheduled buys that make "hard-money savings"
   a habit, with plain-language projections already in place.
5. **LLM-backed advisor (optional, low-bandwidth)** — attach a small local multilingual model
   to the deterministic scam/fee/savings engine for open-ended questions, keeping offline
   fallback intact.
6. **Hardened persistence** — encrypted vault (passphrase-derived key), seed-shamir backup,
   per-endpoint macaroons, hardware-signing for large balances.
7. **Field validation** — run the Mom-Test interview playbook with real Dakar households to
   confirm the forced-choice thesis before expanding scope.

## Constraints that shaped the build

- Must include a **bitcoin/lightning wallet** (brief) → wallet is the centerpiece.
- **Low bandwidth / mid-range phones** (rubric) → vanilla JS, no framework, tiny bundle.
- **Security by design** (rubric) → proven libs, in-memory keys, validation, threat model.
- **One-command setup** (rubric) → `npm install && npm start` (sim) and `docker compose up`.