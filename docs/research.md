# ARCHIVED — Teranga wallet lab desk research

Historical, directional desk research for the prior Teranga wallet concept (19 November 2026). It is not user-interview evidence, not independently re-verified for this release, and does not describe achieved impact or prove a competitive novelty claim. Figures, source links, the persona, and dated market details require re-check before use. See the current [UraniumTransfer evidence boundary and hypothesis](../README.md#impact-and-next-step).

**Subtitle:** Pain-driven product research for the Dakar Bitcoin Hack 2026 (BTrust).
**Challenge:** *"Create tools that will enhance the life of African people, around or on top
of the Bitcoin protocol, the Lightning network, Nostr and AI."*
**Deadline:** Nov 20, 2026 @ 20:00 UTC · **Constraint:** students, online, must include a
bitcoin/lightning wallet implementation.

---

## 1. Research questions

1. What are the highest-frequency, most concrete financial pains facing people in Senegal
   and the broader WAEMU (francophone West Africa) today?
2. Which of those pains can Bitcoin, Lightning, Nostr, or AI plausibly solve *better* than
   the incumbent (mobile money, banks, Western Union)?
3. Which pain has the strongest combination of **evidence**, **market size**, and **headroom**
   for a small, honest, working prototype within a one-month hackathon window?

## 2. Method

Mixed sources, triangulated rather than taken at face value:

- **Primary challenge brief** — Devpost (requirements + judging rubric).
- **Institutional data** — World Bank *Remittance Prices Worldwide*; IFAD *RemitSCOPE Africa*
  Senegal country diagnostic (2025 update); IMF *Digital Payment Innovations in Sub-Saharan
  Africa* (DP/2025); Chainalysis regional adoption report (2025).
- **Market/operator data** — Momocalc operator-schedule comparison (verified June 2026);
  local press (SeneNews) on taxation.
- **Qualitative user voice** — Reddit threads (r/Senegal, r/Bitcoin, r/TheLightningNetwork,
  r/nostr) collected via an authenticated browser session, plus practitioner talks from
  Adopting Bitcoin Cape Town 2025.

A known limitation: no formal survey was run. Findings are directional and evidence-backed,
not statistically representative; the primary "user" is a persona triangulated from the
above rather than from field interviews.

## 3. Findings

### 3.1 The dominant, recurring pain: remittances are expensive and opaque

- Senegal receives **~US$3.2B in remittances a year (XOF 1,800 billion), 10.6% of GDP**,
  reaching about a third of rural families; the diaspora is ~740,000 people
  (RemitSCOPE 2025 / UNDESA 2024).
- Cost to send is **3.5–4% on average** (France→Senegal), still **cash-dominated**, and —
  critically — **non-transparent**: the 2025 diagnostic found "a lack of transparency around
  the cost," withdrawal fees "not systematically posted," and "hidden fees over and above the
  official rate by certain agents, with no recourse."
- An estimated **XOF 130B (US$250M) flows outside the regulated system**, i.e. people are
  already leaving formal rails for cheaper but riskier channels.
- **User voice (Reddit, translated):** *"A lot of people use binance to send remittances now.
  Fees are way lower than western union…"* and *"I use binance p2p with wave, but you have to
  be careful with scams."* — the cheap route exists; it is just unsafe and unclear.

**Design implication:** a receive-flow that shows, in plain language, *exactly* what the
recipient gets (no hidden FX or cash-out surprise), and that uses a rail with ~0 fee.

### 3.2 People cannot save, and they do not trust the CFA franc

- Bank "livret" savings yield **~1.5%**, below Senegal's **~2.8%** inflation (the highest in
  the WAEMU) — a guaranteed annual loss of purchasing power.
- The CFA is **pegged to the euro and printed in France**; the **1994 devaluation halved
  savings overnight**, a generational trauma documented repeatedly (Cointelegraph 2022, 2023;
  multiple local 2026 articles on "dollarizing" savings).
- Access to **dollar/hard money is artificially hard**: *"Money transfer — CFA to USD… all
  apps I know are CAD/USD to CFA, not CFA to USD, and I'm fed up."* (Reddit).
- Users want to "dollarize" via stablecoins or bitcoin, but **self-custody is intimidating**
  ("if you lose the seed phrase, funds are lost… no recourse" — Kolonell 2026), so most people
  simply do not do it.

**Design implication:** the product must make *self-custodial hard-money savings* feel safe
and legible to a non-technical person in French/Wolof, not require node-running or exchange
skill.

### 3.3 Mobile money — the incumbent — is getting *more* expensive

- A **new 0.5% Money Transfer Tax** (Law n°2025-17, 27 Sept 2025) now applies to every mobile
  money operation (transfer/payment/withdrawal), capped at 2,000 FCFA, **collected from
  December 2025** (Momocalc, verified June 2026; SeneNews).
- Regulators themselves warned it could "push people back to cash" and "weaken financial
  inclusion" (SeneNews, Sept 2025).

**Design implication:** a zero/low-fee rail has a widening, *fresh* cost advantage that the
pitch can cite directly (this tax went live ~11 months before the hackathon).

### 3.4 Lightning works in Africa — but its own friction is real

- **Chipper Cash now routes 50% of its Bitcoin over Lightning**, explicitly because "fiat
  payment partners still experience frequent outages" and Lightning gives "uptime measured in
  decimals" (Voltage, Sept 2025). This is a production-grade, Africa-specific validation of
  the reliability thesis.
- Practitioner reports from Adopting Bitcoin Cape Town 2025 cite a **~10x cost reduction**
  routing cross-border fiat over Lightning, with $7.2B/yr in fees across a ~$90B inflow at 8%.
- But onboarding retains friction: **inbound liquidity, channel management, and node security**
  ("lost funds after a VPS hack") — all problems *technicians* have, not end-users.

**Design implication:** hide Lightning's channel/liquidity complexity behind a manage-account
layer; users should never see "inbound liquidity."

### 3.5 Low bandwidth and low literacy are hard constraints, not footnotes

- The judging rubric explicitly rewards "fast, frictionless flows on low bandwidth and
  mid-range phones."
- IFAD notes limited "financial and digital education" among remittance recipients; Machankura's
  SMS/USSD success (nine countries, feature phones) proves the demand for ultra-simple rails.

**Design implication:** no heavy framework, tiny bundle, works offline-ish, every number
explained in words.

## 4. Market / reach sizing (for the pitch)

| Metric | Value | Source |
| --- | --- | --- |
| Remittances into Senegal/yr | US$3.2B | RemitSCOPE 2025 |
| Share of GDP | 10.6% | RemitSCOPE 2025 |
| Rural families reached | ~1/3 | RemitSCOPE 2025 |
| Remittance cost (FR→SN) | 3.5–4% | World Bank RPW Q3 2025 |
| Bank savings real yield | **negative** (1.5% vs 2.8% CPI) | Jokko 2026 / BCEAO |
| Mobile-money tax (new) | 0.5% per op, live Dec 2025 | Law 2025-17 |
| SSA on-chain value 2024–25 | US$205B, +52% YoY | Chainalysis 2025 |

A conservative *serviceable* framing for the MVP: **one Senegalese household saving 50,000
FCFA/month would lose ~**400k FCFA of purchasing power over five years** in a bank account
(see `/api/savings`), and would pay ~1,750 FCFA per 50,000 FCFA remittance via Western Union
vs **0** over Teranga. The reach story is "a third of rural families already depend on the
rail we're improving."

## 5. The thesis (opportunity gap)

> The single most valuable, evidence-backed opportunity is the **forced choice** West
> Africans face today: *receive* diaspora money cheaply and transparently, and *save* in
> money that does not silently lose value. Every existing option is either expensive and
> opaque (mobile money / Western Union, now with a fresh tax) or cheap but risky and
> confusing (Binance P2P, self-custody crypto). A tool that makes **saving and receiving**
> cheap, transparent, and safe, on a low-end phone, in French/Wolof, is a real solver for a
> real, well-scoped problem with a large reach.

**Solution:** Teranga — a self-custodial Bitcoin/Lightning wallet with a **savings-first
paradigm** and a **transparent remittance receive-flow**, plus an **offline-friendly
financial-safety assistant** (scam detection + fee transparency + savings literacy) and
**Nostr-signed receipts** for verifiable trust.

## 6. Why this beats the alternatives (for the judges)

- **Not a clone of existing wallets:** the differentiator is the *pain*, not the tech. It
  bundles the receive-cost-comparison and the "what your bank silently takes" projection as
  first-class features — the two things no incumbent wallet shows next to each other.
- **Every criterion maps to a built artifact** (see README's mapping table).
- **Honest scope:** real key derivation and signed transactions (unit-tested); simulated
  network in demo mode with a documented real-node docker path.

## 7. References

- Devpost challenge brief — https://dakar-bitcoin-hack-2026.devpost.com/
- IFAD / RemitSCOPE Africa, *Senegal country diagnostic* (updated 2025) — remitscope.org
- World Bank, *Remittance Prices Worldwide*, France→Senegal (Q3 2025) — remittanceprices.worldbank.org
- Momocalc, *Wave vs Orange Money — Senegal 2026* + Money Transfer Tax (Law 2025-17) — momocalc.com
- SeneNews, *New revelations on the tax that will increase money transfer fees* (Sept 2025)
- IMF, *Digital Payment Innovations in Sub-Saharan Africa* (DP/2025/004)
- Chainalysis, *Sub-Saharan Africa Shows Strong Crypto Retail Activity* (Sept 2025)
- Cointelegraph, *"We don't like our money": the story of the CFA and Bitcoin in Africa* (2022) and *Bitcoin gains traction in West Africa* (2023)
- Voltage, *Chipper Cash Powers 50% of Bitcoin Payments via Lightning Network* (Sept 2025)
- Adopting Bitcoin Cape Town 2025 — *Solving Africa's remittance problem*; *State of Lightning infrastructure*
- Reddit — r/Senegal, r/Bitcoin, r/TheLightningNetwork, r/nostr (user quotes, accessed Nov 2026)
