export type Money = { amount: number; currency: string };
export type Verdict = "Closed" | "Partial" | "Exposed" | "Unknown";
export type Dimension =
  | "single-path" | "custody" | "mediated-execution" | "intent-binding"
  | "no-splitting" | "human-approval" | "provable-audit" | "continuous-verification";

export const DIMENSIONS: readonly Dimension[] = [
  "single-path", "custody", "mediated-execution", "intent-binding",
  "no-splitting", "human-approval", "provable-audit", "continuous-verification",
];

export const DIMENSION_LABEL: Record<Dimension, string> = {
  "single-path": "Single path",
  "custody": "Custody",
  "mediated-execution": "Mediated execution",
  "intent-binding": "Intent-binding",
  "no-splitting": "No splitting",
  "human-approval": "Human approval",
  "provable-audit": "Provable audit",
  "continuous-verification": "Continuous verification",
};

export type Unknownable<T> = T | "unknown";

export interface Intake {
  spend?: { what: string[]; frequency: "rare" | "daily" | "continuous" | "unknown"; typical?: Money; notes?: string };
  reach?: { tools: string[]; mcpServers: string[]; keysInRuntime: string[]; paymentPaths: number | "unknown"; notes?: string };
  custody?: { where: "agent-runtime" | "separate-service" | "unknown"; notes?: string };
  execution?: { who: "agent-calls-rail" | "intent-to-executor" | "unknown"; notes?: string };
  binding?: { mode: "bound-payee-and-amount" | "any-in-policy" | "unknown"; notes?: string };
  limits?: { perAction?: Money; perDay?: Money; enforcedAt: "before-spend" | "at-settlement" | "none" | "unknown"; reservedAtGrant: boolean | "unknown"; notes?: string };
  approval?: { mode: "none" | "in-band" | "out-of-band" | "unknown"; threshold?: Money; notes?: string };
  record?: { exists: boolean | "unknown"; tamperEvident: boolean | "unknown"; settledAmountRecorded: boolean | "unknown"; notes?: string };
  drift?: { changeFrequency: "rare" | "weekly" | "daily" | "unknown"; recheck: "on-change" | "at-deploy" | "never" | "unknown"; notes?: string };
}

export type FieldKind = "choice" | "money" | "list" | "boolean" | "number" | "text";
export interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  choices?: { value: string; label: string }[];
  optional?: boolean;
}
export interface Question {
  id: keyof Intake;
  title: string;
  prompt: string;
  fields: Field[];
}

export type Openness = "open" | "partial" | "closed" | "unknown";
export type StepKind = "governance-layer" | "hosted-control-plane" | "hands-on" | "practice";

export interface Readout {
  posture: string;
  moneyPaths: { path: string; mediated: boolean | "unknown" }[];
  exposure: { dimension: Dimension; verdict: Verdict; finding: string; question?: string }[];
  topBreaches: { dimension: Dimension; blastRadius: string; fix: string }[];
  open: { forgery: Openness; misdirection: Openness; why: string };
  shortestPath: { step: string; kind: StepKind }[];
  lastLine: string;
  notes: { dimension: Dimension | "spend"; text: string }[];
}
