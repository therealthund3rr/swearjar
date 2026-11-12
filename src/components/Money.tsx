import { formatMoney, type Cents } from "@/lib/money";

export function Money({ cents, currency, big }: { cents: Cents; currency: string; big?: boolean }) {
  return <span className={`money${big ? " big" : ""}`}>{formatMoney(cents, currency)}</span>;
}
