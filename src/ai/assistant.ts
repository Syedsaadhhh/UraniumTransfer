export type Lang = "en" | "fr" | "wo";

export type RouteId = "teranga" | "western-union" | "wave" | "orange-money" | "binance-p2p";

interface RouteMeta {
  pct: number; // indicative all-in cost as a percentage
  time: string;
  risk: "low" | "medium" | "high";
  note: string;
}

const ROUTES: Record<RouteId, RouteMeta> = {
  teranga: { pct: 0, time: "instant", risk: "low", note: "self-custody, no intermediary" },
  "western-union": { pct: 3.5, time: "minutes (agent or cash)", risk: "low", note: "cash pickup, hidden FX margins" },
  wave: { pct: 1.5, time: "instant", risk: "low", note: "mobile money, cash-out fee applies" },
  "orange-money": { pct: 2.0, time: "instant", risk: "low", note: "mobile money, +0.5% transfer tax" },
  "binance-p2p": { pct: 0.5, time: "minutes", risk: "high", note: "cheapest, but scam + freeze risk" },
};

export interface RemittanceQuote {
  route: RouteId;
  amountFcfa: number;
  feeFcfa: number;
  receivedFcfa: number;
  time: string;
  risk: string;
  note: string;
}

// Demo conversion model (clearly labeled, not a live feed):
//   1 Bitcoin = 100,000 USD and 1 USD = 600 FCFA
//   => 1 sat = 0.6 FCFA, and 1 FCFA = 5/3 sat.
const USD_PER_BTC = 100_000;
const FCFA_PER_USD = 600;
const FCFA_PER_SAT = (USD_PER_BTC * FCFA_PER_USD) / 100_000_000; // 0.6

export function remittanceQuote(route: RouteId, amountFcfa: number): RemittanceQuote {
  const m = ROUTES[route];
  const feeFcfa = Math.round(amountFcfa * (m.pct / 100));
  return {
    route,
    amountFcfa,
    feeFcfa,
    receivedFcfa: amountFcfa - feeFcfa,
    time: m.time,
    risk: m.risk,
    note: m.note,
  };
}

export function allRemittanceQuotes(amountFcfa: number): RemittanceQuote[] {
  return (Object.keys(ROUTES) as RouteId[]).map((r) => remittanceQuote(r, amountFcfa));
}

/** Scam-signal detection for P2P / off-ramp offers. Deterministic and offline-friendly. */
const SCAM_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /act\s*fast|quick\s*before|last\s*chance|limited\s*time|today\s*only/i, reason: "urgency pressure" },
  { pattern: /guaranteed\s*(return|profit)|double\s*your\s*money|100%\s*(return|profit|sure)/i, reason: "guaranteed-return claim" },
  { pattern: /send\s*first|pay\s*first|payez\s*d'abord|envoyez\s*d'abord|deposit\s*to\s*release/i, reason: "asks you to send money first" },
  { pattern: /rendement\s*garanti|gagnez\s*(\d|facile)|argent\s*facile|doublez/i, reason: "rendement garanti / argent facile" },
  { pattern: /cadeau|gift\s*card|chèque|fake\s*check|too\s*good\s*to\s*be\s*true/i, reason: "unusual payment instrument" },
  { pattern: /private\s*key|seed\s*phrase|mnemonic|12\s*words|24\s*words|récupération|phrase\s*secrète/i, reason: "asks for your seed / keys" },
  { pattern: /admin|customer\s*support|support\s*officiel|impersonat/i, reason: "possible impersonation" },
];

export interface ScamAnalysis {
  safe: boolean;
  signals: string[];
  recommendation: string;
}

export function analyzeMessage(text: string, lang: Lang = "en"): ScamAnalysis {
  const signals: string[] = [];
  for (const { pattern, reason } of SCAM_PATTERNS) {
    if (pattern.test(text)) signals.push(reason);
  }
  const safe = signals.length === 0;
  return { safe, signals, recommendation: scamAdvice(signals, lang) };
}

function scamAdvice(signals: string[], lang: Lang): string {
  if (signals.length === 0) return t(lang, "advice_safe");
  const joined = signals.join(", ");
  return t(lang, "advice_unsafe") + ` ${joined}.`;
}

const STR: Record<string, Record<Lang, string>> = {
  advice_safe: {
    en: "No red flags detected. Still: never share your seed phrase, and prefer a trusted party you can verify in person.",
    fr: "Aucun signal d'arnaque détecté. Rappel : ne partagez jamais votre phrase de récupération et privilégiez une personne de confiance vérifiable.",
    wo: "Lu ñu gis xibaar bu set. Waaye bul jox kenn seed bu ñu wax (recovery phrase), te bul def dara boo xamul ki ko jëm.",
  },
  advice_unsafe: {
    en: "This looks risky. Red flags:",
    fr: "Ceci semble risqué. Signaux d'alerte :",
    wo: "Lii dafa ànd ak lu am solo. Yëngu-yëngu yi:",
  },
};

export interface SavingsProjection {
  monthlyFcfa: number;
  years: number;
  savingsAccountEndFcfa: number;
  savingsAccountRealFcfa: number;
  btcOnboardingCostFcfa: number;
  headline: string;
}

const INFLATION = 0.028; // Senegal ~2.8% annual
const SAVINGS_RATE = 0.015; // bank "livret" ~1.5%

export function savingsProjection(monthlyFcfa: number, years = 5, lang: Lang = "en"): SavingsProjection {
  const months = years * 12;
  // Simple accumulation with annual compounding applied at the end of each month.
  let nominal = 0;
  for (let m = 0; m < months; m++) {
    nominal = nominal * (1 + SAVINGS_RATE / 12) + monthlyFcfa;
  }
  const real = nominal * Math.pow(1 / (1 + INFLATION), years);
  const btcOnboardingCostFcfa = 0;
  void real;
  return {
    monthlyFcfa,
    years,
    savingsAccountEndFcfa: Math.round(nominal),
    savingsAccountRealFcfa: Math.round(nominal * Math.pow(1 / (1 + INFLATION), years)),
    btcOnboardingCostFcfa,
    headline: savingsHeadline(nominal, nominal * Math.pow(1 / (1 + INFLATION), years), lang),
  };
}

function savingsHeadline(nominal: number, real: number, lang: Lang): string {
  const loss = Math.max(0, Math.round(nominal - real));
  const map: Record<Lang, string> = {
    en: `After ${loss.toLocaleString()} FCFA of silent inflation, a bank account leaves ~${Math.round(real).toLocaleString()} FCFA of real value. Saving in hard money keeps your purchasing power.`,
    fr: `Après ${loss.toLocaleString()} FCFA d'inflation silencieuse, un compte bancaire ne préserve qu'environ ${Math.round(real).toLocaleString()} FCFA de valeur réelle. Épargner en monnaie forte conserve votre pouvoir d'achat.`,
    wo: `Ginnaaw ${loss.toLocaleString()} FCFA ci inflation wu tëx, kont bu bank bi dees koy ${Math.round(real).toLocaleString()} FCFA. Sàcc ci xaalis bu dëgër dafay aar sa xaalis.`,
  };
  return map[lang];
}

export function feeExplainSentence(amountFcfa: number, route: RouteId, lang: Lang): string {
  const q = remittanceQuote(route, amountFcfa);
  const map: Record<Lang, (q: RemittanceQuote) => string> = {
    en: (q) => `Sending ${q.amountFcfa.toLocaleString()} FCFA via ${route} costs ~${q.feeFcfa.toLocaleString()} FCFA in fees; the recipient gets ~${q.receivedFcfa.toLocaleString()} FCFA (${q.time}).`,
    fr: (q) => `Envoyer ${q.amountFcfa.toLocaleString()} FCFA via ${route} coûte ~${q.feeFcfa.toLocaleString()} FCFA de frais ; le destinataire reçoit ~${q.receivedFcfa.toLocaleString()} FCFA (${q.time}).`,
    wo: (q) => `Yónnee ${q.amountFcfa.toLocaleString()} FCFA ci ${route} dafay jooy ~${q.feeFcfa.toLocaleString()} FCFA; ku ko jot mooy ~${q.receivedFcfa.toLocaleString()} FCFA (${q.time}).`,
  };
  return map[lang](q);
}

export function satToFcfa(sat: number): number {
  return Math.round(sat * FCFA_PER_SAT);
}

export function fcfaToSat(fcfa: number): number {
  return Math.round(fcfa / FCFA_PER_SAT);
}

export function t(lang: Lang, key: string): string {
  return (STR[key] && STR[key][lang]) || STR[key]?.en || key;
}