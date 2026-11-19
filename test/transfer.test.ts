import assert from "node:assert/strict";
import { test } from "node:test";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { compare, invoiceTTL, senderStartSat, targetFrom, Transfers, type Invoice, type Settlement, type TestWallet } from "../src/transfer/model.js";
import { makeApp } from "../src/transfer/server.js";

const target = targetFrom({ from: "EUR", to: "XOF", target: "50000", rail: "cash", origin: "Paris", destination: "Dakar" });
const route = { name: "Entered quote", rail: "cash", rate: "650", senderFee: "1", percentFee: "1", receiverFee: "0" };

test("reverse comparison rounds up, charges both fees, and never ranks a mismatched payout", () => {
  const result = compare(target, [route, { ...route, rail: "wallet", senderFee: "0" }, { ...route, receiverFee: "" }]);
  assert.equal(result.lowestMinor, 7870); // €76.93 + €1.00 + €0.77
  assert.equal(result.rows[1].reason, "payout_mismatch");
  assert.equal(result.rows[2].reason, "quote_incomplete");
  const withDeduction = compare(target, [{ ...route, receiverFee: "650" }]);
  assert.equal(withDeduction.lowestMinor, 7971); // another €1 principal and 1 cent fee
  assert.throws(() => compare(target, [{ ...route, rate: "0" }]), /invalid_rate/);
});

test("arbitrary corridors, comma decimals, and differing currency precision", () => {
  const other = targetFrom({ from: "JPY", to: "KWD", target: "12,345", rail: "bank", origin: "Tokyo", destination: "Kuwait City" });
  assert.equal(other.targetMinor, 12345);
  const result = compare(other, [{ ...route, rail: "bank", rate: "0.002", senderFee: "4", percentFee: "0", receiverFee: "0.021" }]);
  assert.equal(result.lowestMinor, 6187);
  assert.throws(() => targetFrom({ from: "GBP", to: "XOF", target: "1.23", rail: "mobile" }), /invalid_precision/);
  assert.throws(() => targetFrom({ from: "ABC", to: "GHS", target: "1", rail: "mobile" }), /invalid_currency/);
});

test("sandbox invoice is capability-scoped, hash-bound, and idempotent across restart", async () => {
  const folder = mkdtempSync(join(tmpdir(), "uranium-test-"));
  try {
    let store = new Transfers(join(folder, "state.json"));
    const { request, owner } = store.create(target);
    await assert.rejects(store.invoice(request.id, "bad owner", { amountSat: 42 }), /not_recipient/);
    await assert.rejects(store.invoice(request.id, owner, { amountSat: -1 }), /invalid_amount/);
    const pending = await store.invoice(request.id, owner, { amountSat: 42 });
    assert.equal(pending.state, "waiting");
    await assert.rejects(store.invoice(request.id, owner, { amountSat: 50 }), /invoice_exists/);
    assert.throws(() => store.paySandbox(request.id, owner, pending.invoice), /open_sender_link/);
    assert.throws(() => store.paySandbox(request.id, "", {paymentHash:"wrong"}), /invoice_mismatch/);
    const paid = store.paySandbox(request.id, "", pending.invoice);
    assert.equal(paid.cashPayoutVerified, false);
    store = new Transfers(join(folder, "state.json"));
    assert.deepEqual(store.paySandbox(request.id, "", pending.invoice), paid);
    assert.deepEqual(store.view(request.id).sandboxBalances, { senderSat: senderStartSat - 42, recipientSat: 42 });
    assert.equal("ownerHash" in paid, false);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test("expired invoice cannot be paid or reused after renewal", async () => {
  let now = Date.now();
  const store = new Transfers(undefined, undefined, () => now);
  const { request, owner } = store.create(target);
  const old = await store.invoice(request.id, owner, { amountSat: 100 });
  now += invoiceTTL;
  assert.equal(store.view(request.id).state, "invoice_expired");
  assert.throws(() => store.paySandbox(request.id, "", old.invoice), /invoice_expired/);
  const next = await store.invoice(request.id, owner, { amountSat: 100 });
  assert.notEqual(old.invoice?.paymentHash, next.invoice?.paymentHash);
  assert.throws(() => store.paySandbox(request.id, "", old.invoice), /invoice_mismatch/);
});

test("test-network mode never credits via sandbox and requires the node amount and hash", async () => {
  let settlement: Settlement | undefined;
  const wallet: TestWallet = {
    network: "regtest",
    async createInvoice(amountSat) { return { amountSat, paymentHash: "a".repeat(64), paymentRequest: "ln-test", expiresAt: Date.now() + invoiceTTL }; },
    async lookupInvoice() { return settlement; },
  };
  const store = new Transfers(undefined, wallet);
  const { request, owner } = store.create(target);
  const result = await store.invoice(request.id, owner, { amountSat: 50 });
  assert.throws(() => store.paySandbox(request.id, "", result.invoice), /not_sandbox/);
  assert.equal((await store.refresh(request.id)).state, "waiting");
  settlement = { settledAt: Date.now(), mode: "testnet", paymentHash: "a".repeat(64), amountSat: 49 };
  assert.equal((await store.refresh(request.id)).state, "waiting");
  settlement = { ...settlement, paymentHash: "b".repeat(64), amountSat: 50 };
  assert.equal((await store.refresh(request.id)).state, "waiting");
  settlement = { ...settlement, paymentHash: "a".repeat(64) };
  assert.equal((await store.refresh(request.id)).state, "paid_wallet");
});

test("sender can share the selected quote; only recipient capability can submit a non-zero payout report", async () => {
  let now = Date.now();
  const store = new Transfers(undefined, undefined, () => now);
  const { request, owner } = store.create(target);
  assert.throws(() => store.reportPayout(request.id, "", {state:"collected", amount:"0"}), /not_recipient/);
  let view = store.selectQuote(request.id, { ...route, source:"Provider quote · 20 Nov" });
  assert.equal(view.selectedQuote?.name, "Entered quote");
  assert.equal(view.selectedQuote?.senderTotalMinor, 7870);
  assert.equal(view.selectedQuote?.expectedPayoutMinor, 50000);
  assert.equal(view.payoutReport, undefined);
  assert.equal("ownerHash" in view, false);
  const quoteRevision = view.selectedQuote!.revision;
  assert.throws(() => store.reportPayout(request.id, owner, {state:"collected", amount:"49500"}), /quote_changed/);
  assert.throws(() => store.reportPayout(request.id, owner, {state:"collected", amount:"0",quoteRevision}), /invalid_amount/);
  assert.throws(() => store.reportPayout(request.id, owner, {state:"collected", amount:"50000.123",quoteRevision}), /invalid_precision/);
  view = store.reportPayout(request.id, owner, {state:"not_collected_yet",quoteRevision});
  assert.deepEqual(view.payoutReport, {state:"not_collected_yet", amountMinor:null, quoteRevision, reportedAt:now});
  now += 1500;
  view = store.reportPayout(request.id, owner, {state:"collected", amount:"49500",quoteRevision});
  assert.equal(view.payoutReport?.amountMinor, 49500);
  assert.equal(view.payoutReport?.state, "collected");
  assert.equal(view.selectedQuote?.expectedPayoutMinor, 50000);
  assert.equal(view.cashPayoutVerified, false);
  view = store.selectQuote(request.id,{...route,senderFee:"2",source:"Changed quote"});
  assert.equal(view.payoutReport, undefined, "a report for the old quote must not be applied to a new promise");
  assert.throws(() => store.reportPayout(request.id,owner,{state:"collected",amount:"49500",quoteRevision}),/quote_changed/);
});

test("a recipient payout report is pinned to the currently selected quote revision", () => {
  let now = Date.now();
  const store = new Transfers(undefined, undefined, () => now);
  const {request,owner} = store.create(target);
  const first = store.selectQuote(request.id,{...route,source:"Quote one"});
  const firstAt = first.selectedQuote!.checkedAt;
  const unchanged = store.selectQuote(request.id,{...route,source:"Quote one"});
  assert.equal(unchanged.selectedQuote?.checkedAt,firstAt,"clock resolution may coincide");
  assert.equal(unchanged.selectedQuote?.revision,first.selectedQuote!.revision + 1);
  assert.equal(unchanged.payoutReport,undefined);
  const unchangedRevision = unchanged.selectedQuote!.revision;
  const sharedReport = store.reportPayout(request.id,owner,{state:"collected",amount:"49500",quoteRevision:unchangedRevision});
  assert.equal(sharedReport.payoutReport?.amountMinor,49500);
  now += 1000;
  const changed = store.selectQuote(request.id,{...route,source:"Quote one updated"});
  assert.equal(changed.selectedQuote?.revision,unchangedRevision+1);
  assert.equal(changed.payoutReport,undefined);
  assert.throws(()=>store.reportPayout(request.id,owner,{state:"not_collected_yet",quoteRevision:unchangedRevision}),/quote_changed/);
  assert.deepEqual(store.reportPayout(request.id,owner,{state:"not_collected_yet",quoteRevision:changed.selectedQuote!.revision}).payoutReport,
    {state:"not_collected_yet",amountMinor:null,quoteRevision:changed.selectedQuote!.revision,reportedAt:now});
});

test("HTTP happy path for a new corridor and private recipient / shareable sender capabilities", async () => {
  const app = makeApp(new Transfers(undefined));
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const post = (endpoint: string, body: unknown, owner?: string) => fetch(origin + endpoint, { method: "POST", headers:{ "Content-Type":"application/json", ...(owner && { Authorization:`Bearer ${owner}` }) }, body:JSON.stringify(body) });
    assert.match((await fetch(origin + "/request")).headers.get("Content-Security-Policy") || "", /frame-ancestors 'none'/);
    assert.equal((await fetch(origin + "/api/list")).status, 404);
    const created = await post("/api/requests", { from:"GBP", to:"GHS", target:"120.10", rail:"mobile", origin:"London", destination:"Accra" });
    assert.equal(created.status, 201);
    const { request, owner } = await created.json() as ReturnType<Transfers["create"]>;
    const path = `/api/requests/${request.id}`;
    assert.equal(request.targetMinor, 12010);
    const selected = await post(`${path}/quote`, {quote:{name:"Local quote",rail:"mobile",rate:"12",senderFee:"1",percentFee:"0",receiverFee:"1",source:"Manually entered"}});
    assert.equal(selected.status, 200);
    const quoteAt = ((await selected.json()) as {selectedQuote:{expectedPayoutMinor:number;revision:number}}).selectedQuote;
    assert.equal(quoteAt.expectedPayoutMinor, 12010);
    assert.equal((await post(`${path}/payout-report`, {state:"collected",amount:"120",quoteRevision:quoteAt.revision})).status, 403);
    const reported = await post(`${path}/payout-report`, {state:"collected",amount:"119.50",quoteRevision:quoteAt.revision},owner);
    assert.equal(((await reported.json()) as {payoutReport:{amountMinor:number}}).payoutReport.amountMinor, 11950);
    const reset = await post(`${path}/payout-report`, {state:"not_collected_yet",quoteRevision:quoteAt.revision},owner);
    assert.equal(((await reset.json()) as {payoutReport:{amountMinor:number|null}}).payoutReport.amountMinor, null);
    const changedQuote = await post(`${path}/quote`, {quote:{name:"Revised quote",rail:"mobile",rate:"13",senderFee:"1",percentFee:"0",receiverFee:"1"}});
    assert.equal(changedQuote.status,200);
    assert.equal(((await changedQuote.json()) as {payoutReport?:unknown}).payoutReport,undefined);
    const stale = await post(`${path}/payout-report`,{state:"not_collected_yet",quoteRevision:quoteAt.revision},owner);
    assert.equal(stale.status,409);
    assert.equal((await post(`${path}/invoice`, { amountSat: 500 })).status, 403);
    const invoice = (await (await post(`${path}/invoice`, { amountSat: 500 }, owner)).json() as { invoice: Invoice }).invoice;
    assert.equal((await post(`${path}/sandbox-pay`, { paymentHash: invoice.paymentHash }, owner)).status, 403);
    const paid = await post(`${path}/sandbox-pay`, { paymentHash: invoice.paymentHash });
    assert.equal(paid.status, 200);
    const open = await fetch(origin + path);
    assert.equal(open.headers.get("cache-control"), "no-store");
    const recipient = await open.json() as ReturnType<Transfers["view"]>;
    assert.equal(recipient.state, "paid_wallet");
    assert.equal(recipient.settlement?.amountSat, 500);
    assert.equal(recipient.selectedQuote?.expectedPayoutMinor, 12010);
    assert.equal(recipient.selectedQuote?.name, "Revised quote");
    assert.equal(recipient.payoutReport, undefined);
    assert.equal(recipient.cashPayoutVerified, false);
    assert.equal(Object.hasOwn(recipient,"ownerHash"), false);
  } finally { server.close(); }
});
