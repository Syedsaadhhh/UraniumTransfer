# Archive: Teranga wallet lab

This is the original concept and is kept for provenance. Its claims and setup refer to the historical prototype, not UraniumTransfer. To run that prototype on loopback with simulated funds: `npm run lab`. Do not enter a real recovery phrase. For the current app, see the [UraniumTransfer README](../README.md).

A **self-custodial Bitcoin + Lightning savings & remittance wallet** for French-speaking
West Africa. Built for the **Dakar Bitcoin Hack 2026 (BTrust)**.

TL;DR: West Africans lose money in three silent ways: diaspora remittances cost 3–4% and
often hide fees, bank savings pay ~1.5% while inflation runs ~2.8%, and cheap crypto
workarounds (Binance P2P) are scam-prone. Teranga is one wallet that fixes all three:
receive diaspora money over Lightning with **zero hidden fees**, and save in **hard money**
you self-custody, with plain-language French/Wolof guidance built in.

---

## Run it (one command)

Requires Node 20+. No Docker needed for the demo path.

```bash
npm install
npm start
```

Then open **http://localhost:3000** — it auto-loads a seeded demo wallet (`Awa demo`)
with savings + a received remittance so the judges see data immediately.

To watch the whole happy path as a transcript:

```bash
node scripts/demo.mjs        # after `npm start`
```

To verify the crypto and flows with the test suite (real keys, real signed transactions):

```bash
npm test
```

### Docker path (real bitcoind + LND on regtest)

The same code runs against real nodes when you set `MODE=docker`. This spins up bitcoind
(regtest), two LND nodes, and a Nostr relay. This path requires Docker and was **not
executed end-to-end** in the author's environment; `npm start` (sim mode) is the verified one-command path.

```bash
docker compose up -d
bash scripts/setup-nodes.sh   # mine blocks, open a channel
```

---

## What it does

| Tab | Function | Pain it solves |
| --- | --- | --- |
| **Receive** | Lightning invoice or on-chain address (QR), plus a **fee comparison** against Western Union / Wave / Orange Money / Binance P2P | Remittance cost + hidden fees |
| **Send** | Pay a Lightning invoice or send BTC on-chain | Spending sats you actually hold |
| **Save** | On-chain savings `⇄` Lightning spending, plus a savings projection of what a bank account silently loses to inflation | CFA devaluation / savings erosion |
| **Advisor** | Scam checker for P2P offers + plain-language fee and savings explanations (EN/FR/Wolof) | Digital-literacy & scam risk |

Core properties:

- **Self-custodial on-chain** — BIP84 native-segwit HD wallet; you hold the 12-word seed,
  keys never leave your device in production.
- **Lightning-first** — instant, near-zero-fee payments that work on low bandwidth.
- **Localized & low-bandwidth** — vanilla UI, no framework, French + Wolof, mobile-first.
- **Security by design** — threat model in `docs/threat-model.md`.

---

## How it's built

```
teranga/
├── src/
│   ├── bitcoin/wallet.ts    # real HD wallet, BIP84, signed P2WPKH tx (bitcoinjs-lib)
│   ├── bitcoin/chain.ts     # Chain adapter: in-memory regtest sim + bitcoind stub
│   ├── lightning/sim.ts     # in-memory Lightning (invoices, payments, liquidity)
│   ├── lightning/lnd.ts     # real LND REST adapter (docker mode)
│   ├── nostr.ts             # signed Nostr receipts + merchant directory
│   ├── ai/assistant.ts      # fee transparency, scam heuristics, savings projection
│   ├── service.ts           # wallet service (wires everything)
│   ├── routes/api.ts        # REST API
│   └── server.ts            # Express + static frontend + demo seed
├── public/                  # vanilla JS frontend (index.html, app.js, style.css)
├── infra/                   # bitcoind/LND configs for docker
├── scripts/                 # demo.mjs + setup-nodes.sh
├── docs/                    # research, pitch, threat-model, architecture, roadmap
└── test/                    # node:test suite
```

**Portability trick:** the wallet code depends on two tiny interfaces (`Chain` and
`LightningNode`). In **sim mode** (default) those are backed by an in-memory regtest and a
Lightning simulator — real keys, real signed transactions, simulated network, zero
dependencies. In **docker mode** the exact same code talks to real `bitcoind` and `lnd`.
This is what makes `npm start` a true one-command demo that still uses real cryptography.

---

## API (excerpt)

```
POST /api/wallet                     # create (returns a one-time mnemonic)
POST /api/wallet/recover             # restore from mnemonic
GET  /api/wallet/:seedId             # balances
POST /api/wallet/:seedId/lightning/invoice
POST /api/wallet/:seedId/lightning/pay
POST /api/wallet/:seedId/remittance/receive
POST /api/wallet/:seedId/onchain/send
GET  /api/quote?amountFcfa=50000     # route cost comparison
POST /api/analyze                    # scam detection
GET  /api/savings?monthlyFcfa=…      # inflation projection
```

See `docs/architecture.md` for the full data flow and `docs/pitch.md` for the demo script.

---

## Judging criteria → where to find it

| Criterion | Where |
| --- | --- |
| Usefulness & Local Impact | `docs/research.md` (evidence + reach), `docs/pitch.md` |
| Security by Design | `docs/threat-model.md` |
| UX/UI on low bandwidth | `public/` (vanilla, FR/Wolof, mobile-first) |
| Working MVP | `npm start`, `npm test`, `node scripts/demo.mjs` |
| Clear Pitch & Docs | `docs/pitch.md`, this README, `docs/architecture.md` |

> **Honest scope note:** the Bitcoin key derivation and transaction signing are real and
> unit-tested. The "network" is simulated in sim mode (documented), and the LND/bitcoind
> docker path is provided but unverified. Production limitations and next steps live in
> `docs/next-iteration.md`.
