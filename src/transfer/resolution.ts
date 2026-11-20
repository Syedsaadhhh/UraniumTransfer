import type { Rail } from "./model.js";

/**
 * Resolution engine (the "BOUNCE" layer).
 *
 * UraniumTransfer starts as planning. This module turns a real failure — money that
 * went to the wrong place, a fee charged for an operation that never completed, or a
 * payout that arrived short — into a structured, evidence-backed action plan. It is
 * deliberately honest: it never claims a cause it cannot prove, and it always tells
 * the user what information to keep and how to escalate in order of cost.
 */

export type IssueType = "wrong_destination" | "failed_fee" | "shortfall" | "uncollected" | "other";

export const ISSUE_TYPES: IssueType[] = ["wrong_destination", "failed_fee", "shortfall", "uncollected", "other"];

export interface IssueInput {
  type: IssueType;
  rail: Rail;
  expectedMinor: number;
  reportedMinor: number | null;
  from: string;
  to: string;
  note: string;
}

export interface ResolutionStep { title: string; detail: string }

export interface Resolution {
  type: IssueType;
  differenceMinor: number | null;
  /** Ordered steps, cheapest first. */
  steps: ResolutionStep[];
  /** True when the plan reaches the point of a formal/regulator escalation. */
  escalate: boolean;
}

export function isIssueType(value: unknown): value is IssueType {
  return typeof value === "string" && (ISSUE_TYPES as string[]).includes(value);
}

const RAIL_EVIDENCE: Record<Rail, string> = {
  wallet: "the invoice, payment hash and settlement time from this record",
  cash: "the payout agent's name, location, the time you attended, and any agent reference or SMS",
  mobile: "the operator, the transaction ID, the SMS alert, and the exact amount and time",
  bank: "the bank name, account reference, transfer reference and statement line",
};

export function buildResolution(input: IssueInput): Resolution {
  const steps: ResolutionStep[] = [];
  const evidence = RAIL_EVIDENCE[input.rail];

  steps.push({
    title: "Keep the evidence",
    detail: `Save ${evidence}, plus this shared record (both sides see the same entry). Do not edit it; the signed record is what makes it useful.`,
  });
  steps.push({
    title: "Raise it with the provider first",
    detail: `Contact the ${input.rail} provider or agent that handled the payout. Give them the reference, the expected amount and the date. Ask for a written complaint reference.`,
  });

  if (input.type === "wrong_destination") {
    steps.push({
      title: "Ask for a recall, in writing",
      detail: "Ask the receiving provider to recall or return the funds to the source. If they cannot, ask them to confirm in writing that the recipient declined, so it is on record.",
    });
  }
  if (input.type === "failed_fee") {
    steps.push({
      title: "Dispute the charge for the failed operation",
      detail: "State that the operation did not complete and ask for the fee or levy to be reversed. Request the reversal reference, not just a verbal promise.",
    });
  }
  if (input.type === "shortfall" || input.type === "uncollected") {
    steps.push({
      title: "Reconcile the amount, line by line",
      detail: "Ask the provider for the exact deductions: exchange rate applied, sending fee, receiving fee, and any agent or cash-out charge. Compare each against the agreed quote.",
    });
  }
  steps.push({
    title: "Escalate on a clock",
    detail: "If there is no resolution in a reasonable window, escalate to the national payments regulator or consumer protection body that licensed the provider, attaching the complaint reference and this record.",
  });
  steps.push({
    title: "If money must move sideways, choose a rail with recourse",
    detail: "A settled wallet payment is final and is not proof of a local payout. For money that still needs to arrive as cash, prefer the rail with the clearest written trail.",
  });

  const differenceMinor =
    input.reportedMinor == null ? null : input.reportedMinor - input.expectedMinor;

  return { type: input.type, differenceMinor, steps, escalate: true };
}
