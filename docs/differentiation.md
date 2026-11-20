# Differentiation: what the field built, and what we did not copy

The Dakar Bitcoin Hack gallery held **67 projects**. This note records what we
checked and where UraniumTransfer sits, so the claim stays honest and the overlap is
deliberate, not accidental. It is a design aid, not a marketing claim.

## The clusters everyone crowded into

- **ROSCA / tontines / savings circles:** Twese, Natt, KOLA, CircleSats, "Ajo on
  Lightning" (×2), AjoBook, Rota, Tontine Lightning, TontineBTC, TontineZap, Koinon,
  OpenLevy.
- **Pay-on-delivery / escrow:** Gëm, Sésame, FlashDrop, NobPay, KODI, pontHTLC,
  AfriTrade.
- **Merchant / POS:** BaatSats, Jaay, SamaBoutik, SatsPoint, Ojo POS, Soko, SokoSats,
  SunuSats, Monnaie.
- **Learning:** KAOS, Satacademy, SatsClass, Sandbox, LearnSats.
- **Remittance cost / offline:** SatsFlow, Jotali, SamaBill, Seam, offTap.
- **Fraud / safety:** TerangaStats, Zafy, SatsGuard AI.

## The projects closest to us, and the actual difference

| Project | What it does | Overlap | Our difference |
| --- | --- | --- | --- |
| **TerangaStats** | AI verifier of fake Orange Money / Wave **SMS** | Uses AI to read a message | We classify a pasted offer/SMS too, but also turn a **payout shortfall into a resolution plan** and attach a signed record. Ours is not SMS-only. |
| **Zafy** | Anti-scam Lightning wallet, pay by number | Safety framing | We do not custody funds or promise a wallet-first payout. Our unit is the **two-sided settlement record**, not a wallet. |
| **SatsFlow / Jotali / SamaBill / Seam** | Move money cheaper / offline over Lightning | Remittance cost | We do not claim to move money more cheaply. We make the **promise and the outcome comparable and verifiable**, and we keep wallet settlement separate from cash payout. |
| **Natt / KOLA / TontineZap** | Rotating savings on Lightning | Shared-ledger trust | Their ledger is a group pot. Ours is a **pairwise record** of one transfer's promise vs what arrived. |
| **Gëm / Sésame / FlashDrop / KODI** | Escrow / pay-on-delivery | Reversibility-ish | They **hold funds** in a Lightning hold invoice. We never hold funds; we resolve a **failure after** a normal transfer. |
| **BaatSats / Jaay / SamaBoutik / SatsPoint** | Merchant POS in FCFA + sats | Local context | Different user (merchant checkout vs a cross-border transfer decision). |

## What no listed project does (our wedge)

From reading all 67 entries:

1. A **recipient-first, two-sided record** where the sender's chosen, timestamped
   quote and the recipient's reported outcome are shown **together**, with the wallet
   event explicitly separate.
2. A **failure → resolution plan** engine: a wrong destination, a fee charged on a
   failed operation, or a short payout becomes an ordered, escalating action list.
3. **Tamper-evident** records: each agreement is a **signed Nostr event**, verifiable
   by either side, working even with no relay reachable.
4. An **AI safety check with a rules-engine floor** — fraud signals detected without a
   key, upgraded by a model when configured. Because the model only classifies pasted
   text and never produces rates or amounts, it cannot corrupt the money math.

## What we deliberately did **not** build

- No tontine/savings circle — saturated and not our user.
- No escrow or fund custody — avoids the licensing and finality problems a custodian
  invites.
- No merchant POS — different problem.
- No claim to invent remittance planning. Recipient-initiated requests and price
  comparison already exist; our narrow contribution is joining the **promise**, the
  **self-reported outcome**, and a **signed, tamper-evident** record, then acting on a
  failure.
- No AI fee extraction. The model reads pasted text for safety only; it never invents
  provider numbers (see `docs/novelty-review.md`).

## Honest boundary (unchanged)

The recipient's payout amount is **self-reported and unverified**. The wallet
settlement is **not** proof of a local cash payout. The signed record proves **what was
agreed and what was reported**, not why a difference occurred.
