import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze, explainShortfall, rulesAnalyze } from "../src/transfer/ai.js";

test("rules engine flags classic scam phrasing", () => {
  const v = rulesAnalyze("Send first and double your money, act fast!");
  assert.equal(v.safe, false);
  assert.ok(v.signals.length >= 2);
  assert.equal(v.source, "rules");
});

test("rules engine flags the wrong-transfer refund scam", () => {
  const v = rulesAnalyze("Sorry, I sent you money by mistake, please refund it to this new number.");
  assert.equal(v.safe, false);
  assert.ok(v.signals.includes("classic wrong-transfer refund scam"));
});

test("rules engine passes an ordinary note", () => {
  const v = rulesAnalyze("Paid the school fees at the agency this morning.");
  assert.equal(v.safe, true);
  assert.equal(v.signals.length, 0);
});

test("analyze falls back to the rules engine when no key is configured", async () => {
  delete process.env.AI_API_KEY;
  const v = await analyze("act fast, guaranteed profit", "en");
  assert.equal(v.source, "rules");
  assert.equal(v.safe, false);
});

test("shortfall explanation is neutral and never invents a cause", async () => {
  delete process.env.AI_API_KEY;
  const fr = { state: "collected" as const, expectedMinor: 50000, reportedMinor: 49500, currency: "XOF", rail: "cash" };
  const en = await explainShortfall(fr, "en");
  assert.equal(en.source, "rules");
  assert.match(en.text, /does not establish/);
  const equal = await explainShortfall({ ...fr, reportedMinor: 50000 }, "en");
  assert.match(equal.text, /exactly/);
  const waiting = await explainShortfall({ ...fr, state: "not_collected_yet", reportedMinor: null }, "fr");
  assert.equal(waiting.source, "rules");
  assert.match(waiting.text, /pas encore/);
});
