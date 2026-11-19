import { test } from "node:test";
import assert from "node:assert/strict";
import { WalletService } from "../src/service.js";
import { RegtestChain } from "../src/bitcoin/chain.js";
import { SimLightning } from "../src/lightning/sim.js";
import { LocalNostr } from "../src/nostr.js";
import { analyzeMessage, remittanceQuote, savingsProjection, fcfaToSat, satToFcfa } from "../src/ai/assistant.js";

function makeService() {
  return new WalletService(new RegtestChain(), new SimLightning(), new LocalNostr(), { feeRate: 1 });
}

test("full save + remittance happy path", async () => {
  const svc = makeService();
  await svc.init();

  const { summary, mnemonic } = await svc.createWallet("Fatou");
  assert.equal(mnemonic.split(" ").length, 12);

  await svc.faucet(summary.seedId, 200_000, 6);
  await svc.topUpLightning(summary.seedId, 50_000);
  await svc.receiveRemittance(summary.seedId, 83_333, "Cousin in Paris - 50,000 FCFA");

  const s = await svc.summary(summary.seedId);
  assert.equal(s.lightningSat, 133_333);
  assert.equal(s.remittancesReceived, 1);
  assert.ok(s.onchainSat > 0 && s.onchainSat < 200_000); // less the 50k top-up + fee
  assert.equal(s.totalSat, s.onchainSat + s.lightningSat);
});

test("lightning pay decreases spendable balance and settles", async () => {
  const svc = makeService();
  await svc.init();
  const { summary } = await svc.createWallet("Moussa");
  await svc.faucet(summary.seedId, 100_000, 6);
  await svc.topUpLightning(summary.seedId, 60_000);

  const inv = await svc.createInvoice(summary.seedId, 10_000, "coffee");
  const p = await svc.payLightning(summary.seedId, inv.paymentRequest, 10_000);
  assert.equal(p.amountSat, 10_000);

  const s = await svc.summary(summary.seedId);
  assert.equal(s.lightningSat, 50_000);
});

test("scam detector flags urgency and guaranteed-return language", () => {
  const r = analyzeMessage("Act fast! Double your money guaranteed, send first today only", "en");
  assert.equal(r.safe, false);
  assert.ok(r.signals.length >= 2);
  const ok = analyzeMessage("Hello, can we meet tomorrow at the market?", "en");
  assert.equal(ok.safe, true);
});

test("remittance quote math and FCFA/sat conversion are consistent", () => {
  const q = remittanceQuote("teranga", 50_000);
  assert.equal(q.feeFcfa, 0);
  assert.equal(q.receivedFcfa, 50_000);

  const wu = remittanceQuote("western-union", 50_000);
  assert.equal(wu.feeFcfa, 1_750); // 3.5%
  assert.equal(wu.receivedFcfa, 48_250);

  assert.equal(satToFcfa(83_333), 50_000);
  assert.equal(fcfaToSat(50_000), 83_333);
});

test("savings projection shows inflation eroding nominal value", () => {
  const p = savingsProjection(50_000, 5, "en");
  assert.ok(p.savingsAccountRealFcfa < p.savingsAccountEndFcfa);
  assert.match(p.headline, /FCFA/i);
});

test("nostr receipts produce a valid event id", async () => {
  const nostr = new LocalNostr();
  const r = await nostr.publishReceipt(1, "remittance test", [["t", "remittance"]]);
  assert.equal(r.eventId.length, 64);
});