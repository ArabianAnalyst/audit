import type { Money } from "./types.js";

const SYMBOL: Record<string, string> = { USD: "$", GBP: "£", EUR: "€" };

export function formatMoney(m: Money): string {
  const n = m.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!m.currency) return n;
  const cur = m.currency.toUpperCase();
  const s = SYMBOL[cur];
  return s ? `${s}${n}` : `${n} ${cur}`;
}

/** The binding cap for blast radius: per day first, then per spend, then none. */
export function capOf(limits: { perAction?: Money; perDay?: Money } | undefined): Money | undefined {
  return limits?.perDay ?? limits?.perAction;
}
