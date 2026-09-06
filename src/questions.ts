import type { Question } from "./types.js";

const unknown = { value: "unknown", label: "Unknown" };

export const questions: Question[] = [
  {
    id: "spend",
    title: "What the agent buys",
    prompt: "What does the agent buy, and how often? API credits, compute, data, vendors, on-chain.",
    fields: [
      { key: "what", label: "What it buys", kind: "list" },
      { key: "frequency", label: "How often", kind: "choice", choices: [
        { value: "rare", label: "Rarely, a few times a month" }, { value: "daily", label: "Daily" }, { value: "continuous", label: "Continuously, many times an hour" }, unknown] },
      { key: "typical", label: "Typical spend", kind: "money", optional: true },
    ],
  },
  {
    id: "reach",
    title: "What the runtime can reach",
    prompt: "What can the agent's runtime reach? List every tool, MCP server, SDK, and key in the agent's process.",
    fields: [
      { key: "tools", label: "Tools and SDKs", kind: "list" },
      { key: "mcpServers", label: "MCP servers", kind: "list" },
      { key: "keysInRuntime", label: "Payment credentials present in the agent's process, prompt, memory, or tools", kind: "list" },
      { key: "paymentPaths", label: "How many distinct ways the runtime can move money", kind: "number", optional: true },
    ],
  },
  {
    id: "custody",
    title: "Where the credential lives",
    prompt: "Where does the payment credential live? In the agent's process or prompt or memory, or behind a separate service or signer.",
    fields: [{ key: "where", label: "Credential location", kind: "choice", choices: [
      { value: "agent-runtime", label: "In the agent's process, prompt, memory, or tools" }, { value: "separate-service", label: "Behind a separate service or signer the agent cannot read" }, unknown] }],
  },
  {
    id: "execution",
    title: "Who executes the payment",
    prompt: "Who executes the payment? The agent calls the rail itself, or it submits an intent to something that executes.",
    fields: [{ key: "who", label: "Executor", kind: "choice", choices: [
      { value: "agent-calls-rail", label: "The agent calls the rail itself" }, { value: "intent-to-executor", label: "The agent submits an intent and something else executes behind a boundary" }, unknown] }],
  },
  {
    id: "binding",
    title: "What a grant is bound to",
    prompt: "When a spend is approved, is it bound to a specific payee and amount, or can the agent supply any in-policy value?",
    fields: [{ key: "mode", label: "Binding", kind: "choice", choices: [
      { value: "bound-payee-and-amount", label: "Bound to an exact payee and amount, single use" }, { value: "any-in-policy", label: "The agent chooses the payee and amount within policy" }, unknown] }],
  },
  {
    id: "limits",
    title: "Limits and where they bite",
    prompt: "What limits exist and where are they enforced? Per-action, daily, per-vendor. Checked before the spend or only at settlement.",
    fields: [
      { key: "perAction", label: "Cap per spend", kind: "money", optional: true },
      { key: "perDay", label: "Cap per day", kind: "money", optional: true },
      { key: "enforcedAt", label: "Where caps are checked", kind: "choice", choices: [
        { value: "before-spend", label: "Before the spend" }, { value: "at-settlement", label: "Only when the spend settles" }, { value: "none", label: "No caps" }, unknown] },
      { key: "reservedAtGrant", label: "Budget is reserved the moment a spend is approved, not when it settles", kind: "boolean" },
    ],
  },
  {
    id: "approval",
    title: "Human approval",
    prompt: "Is there human approval for large spends? None, in-band where the agent decides, or out of band where a person approves the exact spend.",
    fields: [
      { key: "mode", label: "Approval", kind: "choice", choices: [
        { value: "none", label: "None" }, { value: "in-band", label: "In-band, the agent decides" }, { value: "out-of-band", label: "Out of band, a person approves the exact spend" }, unknown] },
      { key: "threshold", label: "Approval threshold", kind: "money", optional: true },
    ],
  },
  {
    id: "record",
    title: "The record",
    prompt: "Is there a record of every decision and the amount actually settled, and can it be tampered with?",
    fields: [
      { key: "exists", label: "A record of every decision exists", kind: "boolean" },
      { key: "tamperEvident", label: "The record is tamper-evident, hash-chained or signed", kind: "boolean" },
      { key: "settledAmountRecorded", label: "The amount actually settled is in the record", kind: "boolean" },
    ],
  },
  {
    id: "drift",
    title: "Drift",
    prompt: "How often does the agent's tool or dependency set change, and is the money-path re-checked when it does?",
    fields: [
      { key: "changeFrequency", label: "How often tools or dependencies change", kind: "choice", choices: [
        { value: "rare", label: "Rarely" }, { value: "weekly", label: "Weekly" }, { value: "daily", label: "Daily or more" }, unknown] },
      { key: "recheck", label: "When the money path is re-checked", kind: "choice", choices: [
        { value: "on-change", label: "Every time the tool or dependency set changes" }, { value: "at-deploy", label: "Once, at deploy" }, { value: "never", label: "Never" }, unknown] },
    ],
  },
];
