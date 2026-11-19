# UraniumTransfer

**Start with what needs to arrive.** A recipient-first remittance planner and test-only Lightning settlement prototype for [Dakar Bitcoin Hack by BTrust](https://dakar-bitcoin-hack-2026.devpost.com/).

Awa in Dakar needs **50,000 XOF in cash**, not “whatever remains after fees.” She shares a target rather than guessing what her cousin in Paris should send. Her cousin enters provider quotes and sees the *total to send* for the same take-home amount. A cheaper quote that lands in a Bitcoin wallet is **not ranked** against cash pickup. If they test a Lightning payment, both see when sats reach the wallet without being told that cash was paid out.

Paris → Dakar is an optional example. Create your own corridor, choose currencies, and compare cash, mobile money, bank, or Bitcoin-wallet payout. No provider accounts are needed for the planner. Quotes are manually entered, not live; the app does **not** convert funds, deliver cash, or integrate with Wave or Orange Money.

## Run it

Requires Node.js 22 or newer. From a clean checkout:

```sh
npm ci && npm start
```

Open [localhost:3000](http://localhost:3000). Or run `docker compose up --build` for the sandbox. No payment credentials or real money are needed.

**Try both sides:** Select **Try an example**, create the request, and load sample quotes. Then create a test invoice for **2,200 sats**, open **Sender view**, and select **Pay from sender sandbox**. Return to the recipient tab; it shows the exact invoice settled, both test balances update once, and the separate cash-out status does not change. Download the test receipt from either view. Create another request (e.g. GBP → GHS, mobile money) to try real quote inputs for another corridor.

```sh
npm test
npm run typecheck
```

## What’s real, and what’s not

| Mode | Wallet behavior | What it doesn’t prove |
| --- | --- | --- |
| Default **sandbox** | A request-scoped test ledger binds a debit and credit to the invoice hash; expired invoices and replay cannot create another credit. | There is no Lightning network traffic or real balance. |
| Optional **LND test network** | Creates a BOLT11 invoice on a configured LND node. A separate wallet can pay it, and UraniumTransfer checks the receiving node for exact hash and amount before recording settlement. | No mainnet, managed user custody, routing guarantee, live exchange or local payout. |
| Separate **wallet lab** (`npm run lab`) | The original Teranga code exercises BIP39, BIP84 and real P2WPKH signing against a simulated on-chain ledger. | This lab is not part of the public prototype and should not receive real seeds or funds. |

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
- The sender link is a bearer link, not authentication. Keep the separate recipient link private. The owner capability is hashed at rest and omitted from API views. Neither link should contain a name, account number, or payment credentials. Quotes stay in the browser unless submitted for calculation; the server does not persist them.
- Records persist across restarts in `data/` by default (`TRANSFER_DATA_FILE` overrides the path). Links expire after 30 days; writes prune expired records. Use a single app instance, a persistent volume, and HTTPS if hosting a public sandbox. By default the native app only binds to loopback; set `HOST=0.0.0.0` explicitly if your host requires it.
- No public legacy wallet routes, no server-side seed collection in the app, no analytics, no payment preimages included in the receipt. No data goes to a Nostr relay. The exported JSON is a test record, not a signed or legally verifiable cash receipt.
- Frontend is HTML/CSS/JS, no third-party runtime calls, with French and English, reduced-motion support, and responsive layout.

## Impact and next step

[IFAD’s RemitSCOPE Africa](https://remitscope.org/africa/) and the [World Bank Remittance Prices Worldwide database](https://remittanceprices.worldbank.org/) provide background on remittances and costs; the sample calculator values are **not** quotes from either source. No field results or fee savings are claimed yet. Pilot with ten France–Senegal sender/recipient pairs and measure quote completion, time to choose comparable payouts, whether both people correctly interpret “paid to wallet,” and the gap between an entered cash quote and what actually arrives. Next: validate the workflow with participants, then integrate read-only quotes from one licensed provider and confirm independently what proof of local payout is available.

See the [three-minute pitch and demo sequence](docs/uranium-demo.md). The [legacy lab README](docs/legacy-readme.md) and older Teranga documents are historical, not claims about this app.
