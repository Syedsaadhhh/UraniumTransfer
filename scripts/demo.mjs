// Teranga demo harness: exercises the running API on the happy path and prints
// a readable transcript. Run after `npm start` (sim mode), or point BASE at a
// docker deployment.
const BASE = process.env.BASE || "http://localhost:3000";

async function api(path, opts = {}) {
  const res = await fetch(BASE + "/api" + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${data.error || JSON.stringify(data)}`);
  return data;
}

const fcfa = (s) => Math.round(s * 0.6).toLocaleString("en") + " FCFA";

async function main() {
  console.log("=== Teranga demo transcript ===");

  let seedId = (await api("/demo")).seedId;
  if (!seedId) {
    const w = await api("/wallet", { method: "POST", body: JSON.stringify({ name: "Awa" }) });
    seedId = w.seedId;
    console.log("created wallet:", seedId);
  } else {
    console.log("loaded demo wallet:", seedId);
  }

  let s = await api("/wallet/" + seedId);
  console.log(`● balance: on-chain ${s.onchainSat} sat | lightning ${s.lightningSat} sat | total ${s.totalSat} sat (${fcfa(s.totalSat)})`);

  // 1. A diaspora remittance arrives over Lightning.
  const r = await api(`/wallet/${seedId}/remittance/receive`, { method: "POST", body: JSON.stringify({ amountSat: 83_333, memo: "Cousin in Paris - 50,000 FCFA" }) });
  console.log(`● remittance received: +${r.amountSat} sat (${fcfa(r.amountSat)}) via Lightning`);

  // 2. Fee transparency comparison for the same 50,000 FCFA.
  const quotes = await api("/quote?amountFcfa=50000");
  console.log(`● sending 50,000 FCFA costs per route:`);
  for (const q of quotes) console.log(`    - ${q.route.padEnd(14)} fee ${String(q.feeFcfa).padStart(5)} FCFA  -> recipient keeps ${q.receivedFcfa} FCFA  [risk: ${q.risk}]`);

  // 3. Scam detection.
  const scam = await api("/analyze", { method: "POST", body: JSON.stringify({ text: "Act fast! Double your money guaranteed, send first today only", lang: "en" }) });
  console.log(`● scam check: safe=${scam.safe} signals=[${scam.signals.join(", ")}]`);

  // 4. Savings projection (what the bank silently takes).
  const proj = await api("/savings?monthlyFcfa=50000&years=5&lang=en");
  console.log(`● savings: ${proj.headline}`);

  // 5. Spend over Lightning.
  const inv = await api(`/wallet/${seedId}/lightning/invoice`, { method: "POST", body: JSON.stringify({ amountSat: 10_000, memo: "market vendor" }) });
  const pay = await api(`/wallet/${seedId}/lightning/pay`, { method: "POST", body: JSON.stringify({ paymentRequest: inv.paymentRequest, amountSat: 10_000 }) });
  console.log(`● paid ${pay.amountSat} sat (${pay.feeSat} sat fee) to a vendor`);

  s = await api("/wallet/" + seedId);
  console.log(`● final balance: on-chain ${s.onchainSat} sat | lightning ${s.lightningSat} sat | remittances ${s.remittancesReceived}`);
  console.log("=== done ===");
}

main().catch((e) => {
  console.error("demo failed:", e.message);
  process.exit(1);
});