# Teranga — 3-minute demo pitch

**Format:** screen-share + live demo on `http://localhost:3000` (or a short recording).

## 0:00–0:30 · The problem (three silent leaks)

> "Every month, three things quietly take money from a Senegalese family. First, sending
> 50,000 FCFA home from Paris costs about 1,750 FCFA in Western Union fees — and often more,
> because cash-out and exchange fees are hidden. Second, a bank savings account pays about
> 1.5% while inflation runs 2.8%, so savings *lose* value every year. Third, the cheap
> workaround — Binance P2P — is where people get scammed."

One number to land it: **remittances are 10.6% of Senegal's GDP (US$3.2B/yr)** and reach a
third of rural families. This isn't a niche.

## 0:30–1:15 · The solution

> "Teranga is one wallet that fixes all three. You *receive* diaspora money over Lightning —
> instant, zero fee, and the app shows you exactly what you get, compared side by side with
> Western Union, Wave, Orange Money and P2P. And you *save* in hard money you self-custody —
> not in a bank account that melts."

Show: **Receive** tab → the fee-comparison table (Teranga 0 FCFA vs Western Union 1,750 FCFA
on 50,000 FCFA). Then **Save** tab → the projection: *"a bank account leaves you ~2.7M FCFA
of real value after 5 years; hard money keeps your purchasing power."*

## 1:15–2:15 · The demo (live)

1. Load the seeded wallet (`Awa demo`) — already has savings + a received remittance.
2. **Receive** a remittance: request a Lightning invoice, receive 83,333 sats (= 50,000 FCFA),
   watch the balance update, no fees.
3. **Send**: pay a vendor invoice over Lightning.
4. **Advisor**: paste a scam P2P offer ("Act fast! double your money…") and see it flagged
   with the reason, in French or Wolof.

Emphasize: *real self-custodial keys* (12-word seed), *real signed transactions*, and a
one-command setup (`npm start`), with the running code open.

## 2:15–2:45 · Impact + reach

> "Primary user: a Dakar household that depends on diaspora money and has no safe way to
> save. Reach: a third of rural families already depend on this rail. Per 50,000 FCFA
> remittance, Teranga saves ~1,750 FCFA vs Western Union; over a year of monthly 50,000 FCFA
> savings, hard-money custody avoids ~400k FCFA of silent inflation loss. The mobile-money
> tax that went live in December only widens our edge."

## 2:45–3:00 · Next steps

> "Next iteration: per-user Lightning keys (Greenlight/multi-tenant LND), a real on/off-ramp
> to Wave/Orange Money, and a Nostr merchant directory so recipients can actually *spend*
> what they receive. Thanks."

---

### One-line summaries

- **Problem:** receiving diaspora money is expensive/opaque, saving erodes, cheap crypto is scammy.
- **Solution:** self-custodial BTC/Lightning wallet for save + receive, with fee transparency and a safety advisor.
- **Impact:** 0-fee remittances + inflation-proof savings for households on a remittance breadline.
- **Next:** Lightning keys per user, Wave/Orange off-ramp, Nostr merchant directory.