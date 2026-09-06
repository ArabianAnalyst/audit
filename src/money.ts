import type { Money } from "./types.js";

const SYMBOL: Record<string, string> = { USD: "$", GBP: "£", EUR: "€" };

export function formatMoney(m: Money): string {
  const n = m.amount.toFixed(2);
  const s = SYMBOL[m.currency.toUpperCase()];
  return s ? `${s}${n}` : `${n} ${m.currency.toUpperCase()}`;
}

/** The binding cap for blast radius: per day first, then per spend, then none. */
export function capOf(limits: { perAction?: Money; perDay?: Money } | undefined): Money | undefined {
  return limits?.perDay ?? limits?.perAction;
}
