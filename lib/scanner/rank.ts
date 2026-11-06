import type { ScanItem } from "@/lib/schemas/scan";

/** UP/DOWN view: both LONG and SHORT can be acted on; HIGH risk is never recommended. */
export type ScanVerdict = "CONSIDER" | "HIGH_RISK" | "WAIT";

export function scanVerdict(item: ScanItem): ScanVerdict {
  if (item.direction === "LONG" || item.direction === "SHORT") {
    return item.risk === "HIGH" ? "HIGH_RISK" : "CONSIDER";
  }
  return "WAIT";
}

const VERDICT_ORDER: Record<ScanVerdict, number> = {
  CONSIDER: 0,
  HIGH_RISK: 1,
  WAIT: 2,
};

const QUALITY_ORDER: Record<"A" | "B" | "C", number> = { A: 0, B: 1, C: 2 };

/** Best opportunity first: verdict, setup quality, confidence, then risk/reward. */
export function rankScanItems(items: readonly ScanItem[]): ScanItem[] {
  return [...items].sort(
    (a, b) =>
      VERDICT_ORDER[scanVerdict(a)] - VERDICT_ORDER[scanVerdict(b)] ||
      (a.setupQuality ? QUALITY_ORDER[a.setupQuality] : 3) -
        (b.setupQuality ? QUALITY_ORDER[b.setupQuality] : 3) ||
      b.confidence - a.confidence ||
      (b.riskReward ?? 0) - (a.riskReward ?? 0),
  );
}
