# UraniumTransfer: three-minute demo

**0:00–0:30 — A specific decision.** “Awa in Dakar needs a quote targeting 50,000 CFA in cash. Her cousin in Paris doesn’t need another list of transfer fees. He needs to see the sender’s total for that target.” Show the recipient choosing *Cash pickup*. This is a design example, not a claim of field validation; the app accepts other corridors.

**0:30–1:20 — Compare equal outcomes.** Open the sender link. Enter provider rates and fees (or use the visibly labelled sample quotes). The two cash offers come out to €78.70 and €80.27. The wallet route is not ranked, even though it appears cheaper: it cannot be assumed to deliver the same cash. Select one cash offer; both views now show the expected payout, sender total, and server timestamp. Point out the recipient-fee input. Sample rates are illustrative only.

**1:20–2:20 — Show both views and what settled.** Back in the recipient tab create an invoice for 2,200 test sats. This amount is deliberately independent of the XOF target. In the sender tab use the separate test wallet. For the real protocol demonstration use a second LND wallet on regtest, not the simulator. Show the recipient tab updating to wallet settlement, and point to the line saying cash/mobile/bank payout is not available or verified. Open the receipt without displaying the private recipient link in the recording. Say whether you are in sandbox or regtest before clicking pay.

For an optional payout-report beat, share a quote and submit “not collected yet” in the private recipient view. The sender view can see that the recipient has not reported collection. Reload the private tab, select “I collected this amount,” and enter a clearly labelled example such as 49,500 XOF. The shared record displays a 500-XOF **reported difference** without inventing a reason. Do not present this walkthrough value as a real payout or field-test result. Selecting a quote creates a revision and clears the prior report; submit the report again against the current one.

**2:20–3:00 — What is known and next.** Try a second corridor briefly (e.g. GBP → GHS for mobile money). “We compare entered offers only when they target the same payout, and we keep an invoice separate from local payout. The recipient report is self-reported, not verified. Our current insight comes from desk research, not interviews. When access to participants is available, we would test whether both people understand the status and whether this comparison helps an actual decision.”

If showing the recipient’s optional report, select “not collected yet” first: it does not record zero. A collected amount is labelled recipient-reported, the app makes no claim about why it differs, and selecting another quote clears the earlier payout report.

## Before recording

- Open one recipient tab and one sender tab; keep any private link out of frame.
- Start from a fresh request and verify both tabs can see it; a request settles only once.
- If LND isn’t up for the recording, use the honest sandbox mode. Never open a real-money wallet for the demo.
- Submit public GitHub link and a three-minute video or hosted prototype; do not claim a cash-out integration or guaranteed savings.
