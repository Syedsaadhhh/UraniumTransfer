# ARCHIVED — Teranga wallet lab architecture

This diagram and implementation describe the legacy wallet lab, not the active UraniumTransfer prototype. See the root README and `src/transfer/` for the current application. The lab is retained for the previously verified Bitcoin signing demonstration; it is not wired to public prototype request or payout-report flows.

## Overview

```
                          ┌──────────────────────────────────────────────┐
   browser                │                  backend                     │
 ┌──────────┐   HTTPS     │  ┌───────────┐   ┌───────────────────────┐   │
 │ vanilla  │────────────►│  │  Express  │──►│  WalletService        │   │
 │ JS SPA   │  /api/*     │  │  (routes) │   │  (domain logic)       │   │
 │ EN/FR/WO │◄─────────── │  └───────────┘   └──────┬───────┬───────┘   │
 └──────────┘   JSON      │    static /public        │       │           │
                          └──────────────────────────┼───────┼───────────┘
                       Chain adapter          Lightning adapter    Nostr adapter
                      ┌──────────┐            ┌──────────────┐   ┌──────────┐
                      │ Regtest  │ (sim)      │  Sim         │   │  local   │
                      │ Bitcoind │ (docker)   │  LND REST    │   │  relay   │
                      └──────────┘            └──────────────┘   └──────────┘
```

## Data flow: receiving a remittance

1. **User taps "Request"** → `POST /api/wallet/:id/lightning/invoice`.
2. `WalletService.createInvoice` → `LightningNode.createInvoice` (sim mints a BOLT11-shaped
   token; docker calls LND `/v1/invoices`).
3. **Cousin pays** (simulated by `receiveRemittance` / demo sender) → Lightning settles.
4. `WalletService` credits the wallet's spendable balance and **publishes a Nostr-signed
   receipt** (`LocalNostr.publishReceipt`, kind 1, tag `t:remittance`).
5. UI refreshes balance and the fee-comparison table.

## Data flow: saving (on-chain)

1. **Faucet/deposit** credits a derived address via `Chain.fund`.
2. `WalletService` scans BIP84 addresses (gap-limited) with `Chain.getUtxos`.
3. **Top up Lightning** = a *real signed P2WPKH spend* to the peg address
   (`buildSignedTx` → `signP2wpkh` → `Chain.broadcast`), then a simulated Lightning credit.
4. On-chain **send** = the same signed transaction path to an arbitrary address.

## Key abstractions (the portability trick)

- **`Chain`** (`bitcoin/chain.ts`) — `getUtxos`, `fund`, `broadcast`, `mine`, `height`.
  Implementations: `RegtestChain` (in-memory, real tx semantics) and `BitcoindRpcChain`
  (JSON-RPC, stub provided).
- **`LightningNode`** (`lightning/types.ts`) — `info`, `createInvoice`, `payInvoice`,
  `getBalance`, `receivePayment`. Implementations: `SimLightning` and `LndLightning`.
- **`NostrClient`** (`nostr.ts`) — `publishReceipt`, `publishMerchant`.

The `WalletService` and the entire API/UI depend only on these interfaces, so **sim mode and
docker mode are the same code**.

## Wallet derivation

- BIP39 → 12 words → BIP32 seed → `m/84'/1'/0'/{0|1}/{index}` (native segwit, regtest
  network, bech32 prefix `bcrt`). Receive `0`, change `1`, coin type `1` (testnet/regtest) so
  the demo never derives mainnet keys.

## Stack

- **Backend:** Node 24 + TypeScript + Express; `bitcoinjs-lib`, `bip32`, `bip39`, `ecpair`,
  `tiny-secp256k1`, `nostr-tools`, `qrcode`. Runtime via `tsx` (no build step needed).
- **Frontend:** vanilla JS + CSS (no framework) served by Express, for a tiny bundle on
  low-bandwidth connections.
- **Docker path:** `bitcoind` (regtest) + `lnd` + `lnd-peer` + `nostr-rs-relay` + this backend.

## FCFA ↔ sat conversion (demo model)

1 BTC = 100,000 USD; 1 USD = 600 FCFA ⇒ **1 sat = 0.6 FCFA**, 1 FCFA = 5/3 sat. Clearly
labeled as a static demo rate, not a live feed (see `ai/assistant.ts`).
