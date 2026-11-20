import assert from "node:assert/strict";
import { test } from "node:test";
import { Attestor, isAttestation } from "../src/transfer/nostr.js";
import { buildResolution, isIssueType } from "../src/transfer/resolution.js";
import { targetFrom, Transfers } from "../src/transfer/model.js";

const target = targetFrom({ from: "EUR", to: "XOF", target: "50000", rail: "cash", origin: "Paris", destination: "Dakar" });
const route = { name: "Entered quote", rail: "cash", rate: "650", senderFee: "1", percentFee: "1", receiverFee: "0" };

test("nostr attestations are signed, verifiable and tamper-evident", () => {
  const attestor = new Attestor();
  const a = attestor.attest("quote", "req1", 1, { targetMinor: 50000 });
  assert.equal(a.kind, 30078);
  assert.equal(a.relays.length, 0);
  assert.ok(isAttestation(a));
  assert.equal(Attestor.verify(a.event), true);
  const tampered = { ...a.event, content: JSON.stringify({ targetMinor: 9 }) };
  assert.equal(Attestor.verify(tampered), false);
  assert.equal(Attestor.verify({ ...a.event, sig: "0".repeat(128) }), false);
});

test("resolution engine returns an ordered, escalating plan for every issue type", () => {
  for (const type of ["wrong_destination", "failed_fee", "shortfall", "uncollected", "other"] as const) {
    const resolution = buildResolution({ type, rail: "mobile", expectedMinor: 50000, reportedMinor: 48000, from: "EUR", to: "XOF", note: "" });
    assert.ok(resolution.steps.length >= 4, `${type} should have several steps`);
    assert.equal(resolution.escalate, true);
  }
  const shortfall = buildResolution({ type: "shortfall", rail: "cash", expectedMinor: 50000, reportedMinor: 49500, from: "EUR", to: "XOF", note: "" });
  assert.equal(shortfall.differenceMinor, -500);
  assert.equal(isIssueType("wrong_destination"), true);
  assert.equal(isIssueType("nonsense"), false);
});

test("a request attests quote, payout report and issue; only the recipient can file an issue", () => {
  const store = new Transfers(undefined, undefined, () => Date.now(), new Attestor());
  const { request, owner } = store.create(target);
  assert.equal((store.view(request.id).attestations ?? []).length, 0);

  let view = store.selectQuote(request.id, { ...route, source: "Provider" });
  assert.equal((view.attestations ?? []).length, 1);
  assert.equal((view.attestations ?? [])[0].event.kind, 30078);
  assert.equal(Attestor.verify((view.attestations ?? [])[0].event), true);

  const revision = view.selectedQuote!.revision;
  view = store.reportPayout(request.id, owner, { state: "collected", amount: "49500", quoteRevision: revision });
  assert.equal((view.attestations ?? []).length, 2);

  assert.throws(() => store.reportIssue(request.id, "", { type: "wrong_destination" }), /not_recipient/);
  assert.throws(() => store.reportIssue(request.id, owner, { type: "nope" }), /invalid_issue/);

  view = store.reportIssue(request.id, owner, { type: "shortfall", note: "short by 500", amount: "" });
  assert.equal(view.issue?.type, "shortfall");
  assert.ok((view.issue?.resolution.steps.length ?? 0) >= 4);
  assert.equal((view.attestations ?? []).length, 3);

  const first = (view.attestations ?? [])[0];
  store.markPublished(request.id, first.event.id, ["wss://relay.example"]);
  const after = store.view(request.id);
  assert.deepEqual((after.attestations ?? [])[0].relays, ["wss://relay.example"]);
  assert.equal((after.attestations ?? [])[1].relays.length, 0);
});

test("attestations are absent when no attestor is configured", () => {
  const store = new Transfers(undefined, undefined, () => Date.now());
  const { request } = store.create(target);
  const view = store.selectQuote(request.id, route);
  assert.equal(view.attestations, undefined);
  assert.equal(store.pubkey, undefined);
});
