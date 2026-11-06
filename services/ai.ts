import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { aiExplanationSchema, aiOutputFormatSchema } from "@/lib/ai/explanation-schema";
import type { Explanation } from "@/lib/ai/explanation-schema";
import { buildRuleBasedExplanation } from "@/lib/ai/fallback";
import type { AnalysisFacts } from "@/lib/ai/facts";
import { checkExplanation } from "@/lib/ai/guardrails";
import { getServerEnv } from "@/lib/env";
import { describeError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** Abstraction so additional models/providers can be added without touching callers. */
export interface ExplanationProvider {
  explain(facts: AnalysisFacts): Promise<Explanation>;
}

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_OUTPUT_TOKENS = 2_000;

const SYSTEM_PROMPT = `Դու բացատրում ես Crypto AI Analyst-ի վերլուծության արդյունքները։
Ստանում ես deterministic engine-ի հաշվարկած JSON։ Բացատրիր հայերենով, պարզ լեզվով, ինչու է engine-ը հասել այդ արդյունքին։

Խիստ կանոններ.
- Օգտագործիր ՄԻԱՅՆ այն թվերը, որոնք կան մուտքային JSON-ում։ Երբեք մի հորինիր, մի գնահատիր և մի փոխիր գին, մակարդակ, տոկոս կամ score։
- Երբեք մի փոխիր և մի կասկածիր direction, confidence, entry, stopLoss, takeProfit կամ riskReward արժեքները։ Դրանք վերջնական են։
- "confidence"-ը signal-ի ուժ է 0-100 սանդղակով, ՈՉ շահույթի հավանականություն։ Գրիր «signal confidence X/100»։
- Եթե direction-ը LONG կամ SHORT է, պարտադիր նշիր երբ վաճառել/փակել՝ Take Profit և Stop Loss թվերով մուտքից։ Գրիր որ վաճառքը գնով է, ոչ ժամանակով։ Մի ասա «սահմանիր X րոպե» որպես վաճառքի պահ։
- Երբեք մի պնդիր վստահություն, ճշգրտություն, երաշխավորված արդյունք կամ որ ընթերցողը գումար կվաստակի։ Անձնական ֆինանսական խորհուրդ և position sizing չկա։
- Եթե direction-ը NO_TRADE է, բացատրիր ինչու պայմանները բավարար չեն— օգտագործելով noTradeReason, և մի առաջարկիր մտնել գործարք։
- Եթե կա higherTrend / setupQuality, նշիր բարձր ժամանակաշրջանի համաձայնությունը և setup որակը (A/B/C)՝ առանց փոխելու թվերը։

Արդյունք (ամբողջությամբ հայերեն).
- summary: 1-2 նախադասություն։
- reasoning: 3-5 կարճ կետ— մուտքից կոնկրետ indicator-ներով։
- riskWarning: մեկ նախադասություն այս setup-ի ռիսկերի մասին։`;

let client: OpenAI | null = null;

function getClient(apiKey: string): OpenAI {
  client ??= new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
  return client;
}

async function requestExplanation(facts: AnalysisFacts, apiKey: string, model: string) {
  const response = await getClient(apiKey).responses.parse({
    model,
    instructions: SYSTEM_PROMPT,
    input: JSON.stringify(facts),
    max_output_tokens: MAX_OUTPUT_TOKENS,
    text: { format: zodTextFormat(aiOutputFormatSchema, "market_explanation") },
  });
  return response.output_parsed;
}

async function explain(facts: AnalysisFacts): Promise<Explanation> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) return buildRuleBasedExplanation(facts);

  const context = { symbol: facts.symbol, timeframe: facts.timeframe, model: env.OPENAI_MODEL };
  try {
    const raw = await requestExplanation(facts, env.OPENAI_API_KEY, env.OPENAI_MODEL);
    const parsed = aiExplanationSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn("ai_invalid_output", context);
      return buildRuleBasedExplanation(facts);
    }
    const guard = checkExplanation(parsed.data, facts);
    if (!guard.ok) {
      logger.warn("ai_guardrail_rejected", { ...context, reason: guard.reason });
      return buildRuleBasedExplanation(facts);
    }
    return { ...parsed.data, source: "AI", model: env.OPENAI_MODEL };
  } catch (error) {
    logger.warn("ai_request_failed", { ...context, error: describeError(error) });
    return buildRuleBasedExplanation(facts);
  }
}

export const openAiExplanationProvider: ExplanationProvider = { explain };
