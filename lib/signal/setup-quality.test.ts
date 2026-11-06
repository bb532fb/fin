import { describe, expect, it } from "vitest";
import { assessSetupQuality, higherTrendAllows } from "@/lib/signal/setup-quality";

describe("higherTrendAllows", () => {
  it("allows matching and neutral HTF", () => {
    expect(higherTrendAllows("LONG", "BULLISH")).toBe(true);
    expect(higherTrendAllows("LONG", "NEUTRAL")).toBe(true);
    expect(higherTrendAllows("SHORT", "BEARISH")).toBe(true);
  });

  it("rejects opposing HTF", () => {
    expect(higherTrendAllows("LONG", "BEARISH")).toBe(false);
    expect(higherTrendAllows("SHORT", "BULLISH")).toBe(false);
  });
});

describe("assessSetupQuality", () => {
  const base = {
    direction: "LONG" as const,
    confidence: 90,
    riskReward: 2.2,
    risk: "LOW" as const,
    stopBasis: "STRUCTURE" as const,
    targetBasis: "STRUCTURE" as const,
    higherTrend: "BULLISH" as const,
  };

  it("returns A for a strong structured setup", () => {
    expect(assessSetupQuality(base)).toBe("A");
  });

  it("returns B for solid but not top-tier setups", () => {
    expect(assessSetupQuality({ ...base, confidence: 72, riskReward: 1.6 })).toBe("B");
  });

  it("returns C for weaker tradeable setups", () => {
    expect(assessSetupQuality({ ...base, confidence: 62, riskReward: 1.5 })).toBe("C");
  });

  it("does not grade an opposing higher timeframe", () => {
    expect(assessSetupQuality({ ...base, higherTrend: "BEARISH" })).toBeNull();
    expect(assessSetupQuality({ ...base, direction: "SHORT", higherTrend: "BULLISH" })).toBeNull();
  });
});
