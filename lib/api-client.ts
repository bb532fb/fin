import type { z } from "zod";
import { analysisResultSchema, apiErrorSchema } from "@/lib/schemas/analysis";
import { scanResultSchema } from "@/lib/schemas/scan";
import type { ScanRequest, ScanResult } from "@/lib/schemas/scan";
import type { AnalysisResult, AnalyzeRequest } from "@/types/analysis";

/** POSTs JSON and validates the response before it reaches the UI. */
async function postJson<T>(
  path: string,
  input: unknown,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new Error("Network error. Check your connection and try again.");
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(body);
    throw new Error(
      parsedError.success ? parsedError.data.error.message : "Հարցումը ձախողվեց։ Փորձիր նորից։",
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error("Ստացվեց անվավեր պատասխան։ Փորձիր նորից։");
  return parsed.data;
}

export function requestAnalysis(input: AnalyzeRequest, signal?: AbortSignal): Promise<AnalysisResult> {
  return postJson("/api/analyze", input, analysisResultSchema, signal);
}

export function requestScan(input: ScanRequest, signal?: AbortSignal): Promise<ScanResult> {
  return postJson("/api/scan", input, scanResultSchema, signal);
}
