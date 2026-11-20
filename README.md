# UraniumTransfer

**Start with what needs to arrive.** A recipient-first remittance planner and test-only Lightning settlement prototype for [Dakar Bitcoin Hack by BTrust](https://dakar-bitcoin-hack-2026.devpost.com/).

Awa in Dakar needs **50,000 XOF in cash**, not “whatever remains after fees.” She shares a target rather than guessing what her cousin in Paris should send. Her cousin enters provider quotes and sees the *total to send* for the same take-home amount. A cheaper quote that lands in a Bitcoin wallet is **not ranked** against cash pickup. The sender can share one selected, timestamped quote so both views see what amount was expected. After a payout, Awa can optionally report what she says she collected—or “not collected yet.” The recorded difference has no assumed reason and is not provider-verified. If they test a Lightning payment, both see when sats reach the wallet without being told that cash was paid out.

Paris → Dakar is an optional example. Create your own corridor, choose currencies, and compare cash, mobile money, bank, or Bitcoin-wallet payout. No provider accounts are needed for the planner. Quotes are manually entered, not live; the app does **not** convert funds, deliver cash, or integrate with Wave or Orange Money.

## Run it

Requires Node.js 22 or newer. From a clean checkout:

```sh
npm ci && npm start
```

Open [localhost:3000](http://localhost:3000). Or run `docker compose up --build` for the sandbox. No payment credentials or real money are needed.

**Try both sides:** Select **Try an example**, create the request, and load sample quotes. Select a cash quote to share it. The sender’s separate tab now shows that quote and the expected payout. In the recipient tab, submit **Not collected yet**; the sender sees the report separately. Optionally submit “I collected this amount” with an illustrative amount such as 49,500 XOF to demonstrate the reported difference—this is not a real-user test or verified payout. A different shared quote expires the old report; submit it again against that quote. Finally, create a test invoice for **2,200 sats**, open **Sender view**, and select **Pay from sender sandbox**. Both views then show the settled invoice, while the cash-out status remains separate. Create another request (e.g. GBP → GHS, mobile money) to try other corridors.

```sh
npm test
npm run typecheck
```

## What’s real, and what’s not

| Mode | Wallet behavior | What it doesn’t prove |
| --- | --- | --- |
| Default **sandbox** | A request-scoped test ledger binds a debit and credit to the invoice hash; expired invoices and replay cannot create another credit. | There is no Lightning network traffic or real balance. |
| Optional **LND test network** | Creates a BOLT11 invoice on a configured LND node. A separate wallet can pay it, and UraniumTransfer checks the receiving node for exact hash and amount before recording settlement. | No mainnet, managed user custody, routing guarantee, live exchange or local payout. |
| Separate **wallet lab** (`npm run lab`) | The original Teranga code exercises BIP39, BIP84 and real P2WPKH signing against a simulated on-chain ledger. | This lab is not part of the public prototype and should not receive real seeds or funds. The old node configs are archived and are not used by the current Docker Compose app. |

### Optional LND mode

Requires a funded test payer, a receiving LND node on the same **non-mainnet** Bitcoin network with inbound liquidity, and an HTTPS certificate matching the configured hostname. The app uses an invoice-only macaroon with three RPC permissions. Bake it on the recipient node with its existing admin CLI:

```sh
lncli --network=regtest bakemacaroon --save_to=uranium-invoice.macaroon \
  uri:/lnrpc.Lightning/GetInfo uri:/lnrpc.Lightning/AddInvoice uri:/lnrpc.Lightning/LookupInvoice
```

Set `TRANSFER_MODE=lnd`, `TRANSFER_LND_URL=https://localhost:8080`, `TRANSFER_LND_CERT=/path/to/tls.cert`, and `TRANSFER_LND_MACAROON=/path/to/uranium-invoice.macaroon`, then run `npm start`. Pay the displayed QR/invoice from a separate test wallet. The app refuses mainnet at startup and never gets send permissions. The [Windows smoke test](scripts/regtest-smoke.ps1) provisions two disposable nodes for reproducible verification (Bitcoin Core 28.1, LND 0.18.5-beta).

**Verified on regtest:** The payer node paid a 2,200-sat BOLT11 invoice created on the recipient node through UraniumTransfer. The app reported `waiting` before payment, then `paid_wallet` with that exact payment hash and amount. A second check preserved the settlement time, and `cashPayoutVerified` stayed false. No real funds were used.

To reproduce with the above Windows binaries on a local machine, install app dependencies and run:

```powershell
.\scripts\regtest-smoke.ps1 -BitcoinBin 'C:\path\to\bitcoin\bin' -LndBin 'C:\path\to\lnd'
```

## Architecture and safety

```text
Recipient (private link) ── create target + invoice ─┐
                                                    ├─ Express API → per-request records → JSON volume
Sender (share link) ── compare / read status ────────┘         ├─ reverse quote math (integer minor units)
                                                              └─ sandbox ledger OR invoice-only LND over TLS
```

- The server ranks only requests with the same payout type and known rate and fees. It rounds the sender amount up in the sender’s currency. Rates and fees can change: the planner does not guarantee a provider’s final quote.
- The sender link is a bearer link, not authentication. Keep the separate recipient link private. The owner capability is hashed at rest and omitted from API views. Neither link should contain a name, account number, or payment credentials. Quote rows stay in the sender’s browser; only the selected, timestamped quote and the recipient’s optional self-reported payout amount are stored for both views. Each selected quote has its own revision; an outcome report is accepted only against the current revision, and selecting another quote invalidates the previous report. Reports are not checked against the provider or a cash agent.
- Records persist across restarts in `data/` by default (`TRANSFER_DATA_FILE` overrides the path). Links expire after 30 days; writes prune expired records. Use a single app instance, a persistent volume, and HTTPS if hosting a public sandbox. By default the native app only binds to loopback; set `HOST=0.0.0.0` explicitly if your host requires it.
- No public legacy wallet routes, no server-side seed collection in the app, no analytics, no payment preimages included in the receipt. No data goes to a Nostr relay. The exported JSON is a test record, not a signed or legally verifiable cash receipt.
- Frontend is HTML/CSS/JS, no third-party runtime calls, with French and English, reduced-motion support, and responsive layout.

## Trust layer: signed records, an AI check, and a resolution plan

Three additions sit on top of the planner. All of them work with **no keys and no
network**:

- **Signed records.** Selecting a quote, reporting a payout, or filing an issue signs a
  small, PII-free **NIP-78 Nostr event**. Either side can verify it at
  `GET /api/requests/:id/verify`; publishing to relays is best-effort and never blocks a
  response.
- **AI safety check.** `POST /api/assistant/analyze` reads a pasted offer, SMS or receipt
  for fraud signals. A deterministic **rules engine** always answers offline; an optional
  OpenAI-compatible model (`AI_API_KEY`) upgrades it. The model never produces rates or
  amounts, so it cannot corrupt the money math.
- **Resolution plan.** When a destination is wrong, a fee is charged for a failed
  operation, or a payout arrives short, `POST /api/requests/:id/issue` stores the issue
  and returns an ordered, escalating resolution plan. The difference is reported, never
  explained.

Endpoints and design are in [`docs/trust-layer.md`](docs/trust-layer.md); the positioning
against the other gallery projects is in
[`docs/differentiation.md`](docs/differentiation.md); configuration is in
[`.env.example`](.env.example).

## What we learned from the novelty review

UraniumTransfer works best as a **shared decision record**, not a claim to invent remittances. The PDF notes that recipient-initiated requests and price comparison already exist as concepts. Our narrower hypothesis joins the recipient’s requested payout to one shared, timestamped quote, a recipient-reported outcome, and a separate Lightning wallet status. This surfaces an evidence gap; it cannot prove why a payout differed, global novelty, participant demand, or prize placement. See the [novelty review and truth boundary](docs/novelty-review.md).

## Impact and next step

[IFAD’s RemitSCOPE Africa](https://remitscope.org/africa/) and the [World Bank Remittance Prices Worldwide database](https://remittanceprices.worldbank.org/) provide background on remittances and costs; the sample calculator values are **not** quotes from either source. No interviews, field results, representative research, or fee savings are claimed. The current desktop-research hypothesis is that showing one chosen payout promise beside the recipient’s unverified outcome may clarify a transfer; the prototype can be tested without recruiting participants. Validate wording and real-use assumptions before treating that hypothesis as evidence of impact. Next: validate the workflow, then integrate read-only quotes from one licensed provider and confirm independently what proof of local payout is available.

See the [three-minute pitch and demo sequence](docs/uranium-demo.md). The [legacy lab README](docs/legacy-readme.md), [archived regtest configs](legacy/README.md), and older Teranga documents are historical, not instructions or claims about this app.

Project terms: [MIT License](LICENSE).
