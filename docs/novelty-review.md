# Novelty review and truth boundary

## The useful finding

The uploaded `UraniumTransfer-NoveltyCheck & Truth.pdf` (19 Nov 2026, two pages) identifies two concrete limitations of the earlier prototype:

1. The sender entered quotes in one browser, so the recipient could not see which offer the sender selected.
2. The saved test record showed sat settlement, but not the quote against which local payout could be reported.

It recommends a two-person record connecting the **requested payout, selected provider quote, recipient-reported collected amount, and separate wallet status**. This release implements that workflow. A blank collection amount is not zero; “not collected yet” is its own state. Selecting a quote creates a new quote revision, expires any previous payout report, and prevents a late form submission against that previous revision. The recipient’s statement is explicitly unverified; no difference is attributed to a fee, provider, agent, or event.

## Narrow claim, not a monopoly on the idea

There is no defensible claim that recipient-initiated transfers, fee comparison, a remittance target, a wallet, or a cash-report form is individually unprecedented. The PDF names Remitly/Elektra recipient requests in Mexico, Monito’s Senegal comparison, and Dakar Bitcoin Hack 2025’s PaySats. These are useful leads from the supplied document, **not a completed, independently rechecked competitor study**.

The product thesis to test is narrower: **one shareable, recipient-first payout comparison that joins the sender’s selected, timestamped expected amount to a separately recipient-reported outcome while keeping the Lightning wallet event explicitly separate.** It surfaces an evidence gap; it does not prove why a remittance arrived short, that Bitcoin provides a cash payout, or that this workflow is novel across the market. The prototype can be tried without a user study; no interviews or representative findings are claimed.

## Evidence and implementation

- Desk research only; the PDF and its competitor assertions are not primary-user research or a prize prediction.
- Demo rates and fees remain illustrative. No provider accuracy, average savings, conversion, cash delivery, or user reach is claimed.
- Selected quotes and recipient reports are shared with the request; quote rows remain in the sender’s browser. The sender link is shareable; the separate recipient capability is private.
- Lightning regtest and sandbox record an invoice paid to a wallet, not cash received in Senegal. The payout report is an unverified recipient statement, not a provider receipt or independent check.
- The repo now includes an MIT `LICENSE`. Historical Teranga wallet documents are marked as such; they are not evidence or documentation of this app.

For a time-limited demo, do **not** add unsupported provider integrations, AI fee extraction, or an invented cause code. Demonstrate the shared quote on two tabs, submit “not collected yet” (which stores no amount), then keep a Lightning settlement separate. If interviews are infeasible, describe them as a planned validation step—not something the team has already done.
