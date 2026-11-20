/**
 * AI safety advisor.
 *
 * Two layers, deliberately:
 *  1. A deterministic, offline rules engine (works with zero keys and never
 *     hallucinates) — this is always the floor.
 *  2. An optional LLM layer (any OpenAI-compatible endpoint) that reads a pasted
 *     offer, SMS or quote and returns a structured safety verdict. If the LLM is
 *     unset, slow or returns junk, we fall back to the rules engine.
 *
 * The LLM is only ever asked to classify text the user pasted. It is never asked to
 * invent rates, fees or payout amounts, so it cannot corrupt the money math.
 */

export type Lang = "en" | "fr";

export interface Verdict {
  safe: boolean;
  signals: string[];
  recommendation: string;
  source: "llm" | "rules";
  model?: string;
}

interface Signal { pattern: RegExp; reason: string }

const SIGNALS: Signal[] = [
  { pattern: /act\s*fast|quick\s*before|last\s*chance|limited\s*time|today\s*only|urgent/i, reason: "urgency pressure" },
  { pattern: /guaranteed\s*(return|profit)|double\s*your\s*money|100%\s*(return|profit|sure)|triple/i, reason: "guaranteed-return claim" },
  { pattern: /send\s*first|pay\s*first|payez\s*d'abord|envoyez\s*d'abord|deposit\s*to\s*release|frais\s*de\s*libération/i, reason: "asks you to send money first" },
  { pattern: /rendement\s*garanti|argent\s*facile|gagnez\s*(facilement|\d)|doublez|gain\s*rapide/i, reason: "easy-money claim" },
  { pattern: /cadeau|gift\s*card|chèque|fake\s*check|too\s*good\s*to\s*be\s*true|trop\s*beau/i, reason: "unusual payment instrument" },
  { pattern: /private\s*key|seed\s*phrase|mnemonic|12\s*words|24\s*words|phrase\s*secrète|récupération|recovery\s*phrase/i, reason: "asks for your seed / keys" },
  { pattern: /customer\s*support|support\s*officiel|admin|impersonat|usurpation|service\s*client/i, reason: "possible impersonation" },
  { pattern: /wrong\s*(number|account)|mauvais\s*num[eé]ro|by\s*mistake|par\s*erreur|mistaken/i, reason: "classic wrong-transfer refund scam" },
];

export function aiEnabled(): boolean { return !!process.env.AI_API_KEY; }
export function aiModel(): string { return process.env.AI_MODEL || "gpt-4o-mini"; }

export function rulesAnalyze(text: string, lang: Lang = "en"): Verdict {
  const signals: string[] = [];
  for (const { pattern, reason } of SIGNALS) if (pattern.test(text)) signals.push(reason);
  return { safe: signals.length === 0, signals, recommendation: advice(signals, lang), source: "rules" };
}

/** Full analysis: LLM when configured and healthy, rules otherwise. */
export async function analyze(text: string, lang: Lang = "en"): Promise<Verdict> {
  const llm = await llmAnalyze(text, lang).catch(() => null);
  return llm ?? rulesAnalyze(text, lang);
}

function systemPrompt(lang: Lang): string {
  const language = lang === "fr" ? "French" : "English";
  return [
    "You are a payment-safety checker for West African remittance users.",
    "The user pastes an offer, SMS, receipt or provider quote. Decide whether it shows signs of fraud or manipulation.",
    "Return ONLY compact JSON: {\"safe\": boolean, \"signals\": string[], \"recommendation\": string}.",
    "signals: short lowercase reasons (empty array if none). safe: true only when there are no signals.",
    "recommendation: one plain sentence, no jargon, telling the person what to do next.",
    `Write the recommendation in ${language}. Never invent amounts, fees or exchange rates.`,
  ].join(" ");
}

async function llmAnalyze(text: string, lang: Lang): Promise<Verdict | null> {
  const key = process.env.AI_API_KEY;
  if (!key) return null;
  const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = aiModel();
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt(lang) },
        { role: "user", content: text.slice(0, 2000) },
      ],
    }),
    signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS || 12000)),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return null;
  const parsed = JSON.parse(raw) as { safe?: unknown; signals?: unknown; recommendation?: unknown };
  const signals = Array.isArray(parsed.signals)
    ? parsed.signals.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 8)
    : [];
  const recommendation = typeof parsed.recommendation === "string" && parsed.recommendation.trim()
    ? parsed.recommendation.trim()
    : advice(signals, lang);
  return { safe: parsed.safe === true && signals.length === 0, signals, recommendation, source: "llm", model };
}

function advice(signals: string[], lang: Lang): string {
  if (signals.length === 0) {
    return lang === "fr"
      ? "Aucun signal d'arnaque détecté. Ne partagez jamais votre phrase de récupération et vérifiez la personne autrement."
      : "No scam signal detected. Still: never share your seed phrase, and confirm the person through another channel.";
  }
  const joined = signals.join(", ");
  return lang === "fr"
    ? `Ceci semble risqué. Signaux : ${joined}. N'envoyez rien et vérifiez autrement.`
    : `This looks risky. Signals: ${joined}. Do not send anything and verify another way.`;
}

export interface ShortfallInput {
  state: "collected" | "not_collected_yet";
  expectedMinor: number;
  reportedMinor: number | null;
  currency: string;
  rail: string;
}

/** Plain-language reading of the two-sided record. LLM when configured, template otherwise. */
export async function explainShortfall(input: ShortfallInput, lang: Lang = "en"): Promise<{ text: string; source: "llm" | "rules" }> {
  const llm = await llmExplain(input, lang).catch(() => null);
  return llm ?? { text: template(input, lang), source: "rules" };
}

async function llmExplain(input: ShortfallInput, lang: Lang): Promise<{ text: string; source: "llm" } | null> {
  const key = process.env.AI_API_KEY;
  if (!key) return null;
  const base = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: aiModel(),
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You explain a remittance record in one or two plain sentences. Do not invent causes for any difference and do not claim a payout happened. Be neutral and concrete. " +
            (lang === "fr" ? "Reply in French." : "Reply in English."),
        },
        { role: "user", content: JSON.stringify(input) },
      ],
    }),
    signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS || 12000)),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  return text ? { text, source: "llm" } : null;
}

function template(input: ShortfallInput, lang: Lang): string {
  const fmt = (minor: number) => {
    const f = new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en", { style: "currency", currency: input.currency, currencyDisplay: "code" });
    return f.format(minor / 10 ** f.resolvedOptions().maximumFractionDigits!);
  };
  if (input.state === "not_collected_yet") {
    return lang === "fr"
      ? `Le bénéficiaire n'a pas encore reçu le versement prévu de ${fmt(input.expectedMinor)} (${input.rail}). Le paiement au portefeuille, s'il existe, ne prouve pas un retrait.`
      : `The recipient has not reported receiving the ${fmt(input.expectedMinor)} ${input.rail} payout yet. A wallet payment, if any, is not proof of a local payout.`;
  }
  const reported = input.reportedMinor ?? 0;
  const diff = reported - input.expectedMinor;
  if (diff === 0) {
    return lang === "fr"
      ? `Le bénéficiaire a déclaré avoir reçu exactement le montant prévu de ${fmt(input.expectedMinor)}. Déclaration non vérifiée.`
      : `The recipient reports receiving exactly the ${fmt(input.expectedMinor)} promised. Self-reported, not verified.`;
  }
  const sign = diff < 0 ? (lang === "fr" ? "en dessous de" : "below") : (lang === "fr" ? "au-dessus de" : "above");
  return lang === "fr"
    ? `Le bénéficiaire a déclaré ${fmt(reported)}, ${sign} ${fmt(Math.abs(diff))} par rapport au montant prévu de ${fmt(input.expectedMinor)}. L'écart n'établit pas la cause.`
    : `The recipient reports ${fmt(reported)}, ${fmt(Math.abs(diff))} ${sign} the ${fmt(input.expectedMinor)} promised. The difference does not establish why.`;
}
