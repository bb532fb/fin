import { describe, expect, it } from "vitest";
import { DEFAULT_MUTED_POCKET, normalizeMutedPocket } from "@/lib/alerts/watch-venues";

describe("normalizeMutedPocket", () => {
  it("keeps pocket pairs in list order and drops anything else", () => {
    expect(normalizeMutedPocket(["EURUSD", "SOLUSDT", "ETHUSDT", "ETHUSDT"])).toEqual(["ETHUSDT", "EURUSD"]);
  });

  it("starts with Bitcoin and Ethereum quiet", () => {
    expect(DEFAULT_MUTED_POCKET).toEqual(["BTCUSDT", "ETHUSDT"]);
    expect(normalizeMutedPocket(DEFAULT_MUTED_POCKET)).not.toContain("EURUSD");
  });
});
