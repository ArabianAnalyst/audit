import type { Intake } from "./types.js";

/** A filled intake to start from. An honest, common shape, an agent with a rail key and settlement-time caps. */
export function exampleIntake(): Intake {
  return {
    spend: { what: ["API credits", "data"], frequency: "daily", typical: { amount: 12.5, currency: "USD" }, notes: "Mostly LLM and search APIs." },
    reach: { tools: ["http", "stripe-sdk", "filesystem"], mcpServers: ["search"], keysInRuntime: ["STRIPE_SECRET_KEY"], paymentPaths: 1 },
    custody: { where: "agent-runtime" },
    execution: { who: "agent-calls-rail" },
    binding: { mode: "any-in-policy" },
    limits: { perAction: { amount: 50, currency: "USD" }, perDay: { amount: 500, currency: "USD" }, enforcedAt: "at-settlement", reservedAtGrant: false },
    approval: { mode: "in-band", threshold: { amount: 100, currency: "USD" } },
    record: { exists: true, tamperEvident: false, settledAmountRecorded: false },
    drift: { changeFrequency: "weekly", recheck: "never" },
  };
}
