import "dotenv/config";
import { describe, it } from "vitest";
import { runResearch } from "@/research/run-research";

describe("research optimization workflow", () => {
  it(
    "baseline + experiments + sealed TEST",
    async () => {
      await runResearch();
    },
    3_600_000,
  );
});
