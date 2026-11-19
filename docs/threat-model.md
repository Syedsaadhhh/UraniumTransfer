# Teranga — Threat model & security by design

## Scope

This model covers the on-chain wallet key management, the Lightning transport, the REST API,
and the Nostr receipts. It is written for a **student hackathon MVP**; production gaps are
called out explicitly rather than hidden.

## Assets

1. **User seeds / keys (P0)** — the 12-word BIP39 seed and derived BIP32 keys. Highest value;
   loss or theft = total loss of funds.
2. **Lightning credentials (P0)** — LND macaroon + TLS cert in docker mode.
3. **Funds under management (P0)** — on-chain and Lightning balances.
4. **PII / metadata (P1)** — wallet names, memo text, remittance receipts.

## Trust boundaries

```
browser ── HTTPS ──► backend (Express) ──► Chain / Lightning / Nostr adapters
                          │
                          └─► memory (wallets, keys)   <-- do not persist plaintext
```

The browser and the backend are separate trust domains. The backend is assumed trustworthy
but is the primary attack surface.

## Threats & mitigations

| Threat | Severity | Mitigation (MVP) | Production |
| --- | --- | --- | --- |
| Seed/keys leaked via logs or storage | Critical | Seeds are held **in memory only**; never written to disk, never returned after creation (recover returns no mnemonic), never logged. | Encrypted vault at rest (KMS/keychain), HSM-backed node keys. |
| Mnemonic echoed in errors | Medium | Errors never echo the words; "incorrect mnemonic (checksum)" only. | same. |
| Replay / forged on-chain tx | Critical | `bitcoinjs-lib` builds & validates; signatures validated before finalize; inputs resolved by address → re-derived key, not a stored private key. | Hardware signing, PSBT multisig. |
| Invalid destination address | Medium | `address.toOutputScript` throws before any spend. | same. |
| Lightning credential exposure | High | Macaroon mounted read-only (`:ro`), least-privilege admin macaroon only (no per-endpoint macaroons in MVP). | Per-call macaroons (invoice-only vs read-only), per-user tenants. |
| LND MITM | High | TLS configured; demo uses permissive agent against the node's own cert. | Pin CA, `rejectUnauthorized: true`. |
| Injection (XSS) in UI | Medium | All dynamic output escaped (`esc()`); no `innerHTML` from unescaped user input. | CSP, SRI. |
| Input validation / abuse | Medium | Amounts validated (>0, numeric), balances checked before spend. | Rate limiting, authn/z, structured validation. |
| PII in logs | Low | Logs contain no seed, address, or PII. | Log redaction pipeline. |
| Reuse of addresses | Low | Sequential BIP84 addresses; gap-limited scan. | Gap-limit tuning, address labeling. |

## Known MVP limitations (honest)

- Wallets live in **process memory**; a restart loses them (the demo re-seeds a fresh wallet).
  *This is deliberate for the hackathon:* it removes an entire class of at-rest-key-leak bugs.
- Keys are created and signed **server-side** (single-node model), not in a browser enclave.
- The LND docker path uses a **single admin macaroon**, not least-privilege per-endpoint macaroons.
- The "peg" swap-address in sim mode is illustrative, not a real atomic swap.

## Security-by-design choices that count for the rubric

- **Minimal attack surface:** one small backend, one static frontend, two adapter interfaces.
- **Least privilege:** read-only macaroon mount; no write permission where read suffices.
- **Safe secret handling:** secrets only in memory or env; never in code, logs, or git (`.gitignore`).
- **Validated inputs:** amounts, addresses, mnemonics all validated before use.
- **Proven libraries:** bitcoinjs-lib, tiny-secp256k1, bip32/bip39 (the reference stack), not
  hand-rolled crypto.