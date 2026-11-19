# UraniumTransfer: three-minute demo

**0:00–0:30 — A specific decision.** “Awa in Dakar needs 50,000 CFA in cash. Her cousin in Paris doesn’t need another list of transfer fees. He needs to know what to send so 50,000 actually arrives.” Show the target and the recipient choosing *Cash pickup*. The example is fictional, and the app accepts other corridors.

**0:30–1:20 — Compare equal outcomes.** Open the sender link. Enter provider rates and fees (or use the visibly labelled sample quotes). The two cash offers come out to €78.70 and €80.27. The wallet route is not ranked, even though it appears cheaper: it cannot be assumed to deliver the same cash. Point out the recipient fee field, which some price displays omit.

**1:20–2:20 — Show both views and what settled.** Back in the recipient tab create an invoice for 2,200 test sats. This amount is deliberately independent of the XOF target. In the sender tab use the separate test wallet. For the real protocol demonstration use a second LND wallet on regtest, not the simulator. Show the recipient tab updating to wallet settlement, and point to the line saying cash/mobile/bank payout is not available or verified. Open the receipt without displaying the private recipient link in the recording. Say whether you are in sandbox or regtest before clicking pay.

**2:20–3:00 — What we will validate.** Try a second corridor briefly (e.g. GBP → GHS for mobile money). “We compare the take-home target on the same terms, and we don’t say cash arrived when only sats arrived. We’ll test the workflow with ten sender–recipient pairs and measure time-to-compare, whether payment statuses are understood, and the gap between estimated and actual local payout.”

## Before recording

- Open one recipient tab and one sender tab; keep any private link out of frame.
- Start from a fresh request and verify both tabs can see it; a request settles only once.
- If LND isn’t up for the recording, use the honest sandbox mode. Never open a real-money wallet for the demo.
- Submit public GitHub link and a three-minute video or hosted prototype; do not claim a cash-out integration or guaranteed savings.
