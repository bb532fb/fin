import { z } from "zod";

/**
 * Sent to OpenAI as the Structured Outputs format. Kept free of length keywords,
 * which strict mode may not support; lengths are enforced by `aiExplanationSchema`.
 */
export const aiOutputFormatSchema = z.strictObject({
  summary: z.string(),
  reasoning: z.array(z.string()),
  riskWarning: z.string(),
});

export const aiExplanationSchema = z.strictObject({
  summary: z.string().min(10).max(600),
  reasoning: z.array(z.string().min(3).max(300)).min(2).max(6),
  riskWarning: z.string().min(10).max(400),
});

export type AiExplanation = z.infer<typeof aiExplanationSchema>;

export const EXPLANATION_SOURCES = ["AI", "RULES"] as const;
export type ExplanationSource = (typeof EXPLANATION_SOURCES)[number];

export interface Explanation extends AiExplanation {
  source: ExplanationSource;
  model: string | null;
}
