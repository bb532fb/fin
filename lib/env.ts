import "server-only";
import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const serverEnvSchema = z.object({
  DATABASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  OPENAI_API_KEY: z.preprocess(emptyToUndefined, z.string().min(20).optional()),
  OPENAI_MODEL: z.preprocess(emptyToUndefined, z.string().min(1).default("gpt-4.1-mini")),
  BINANCE_API_BASE_URL: z.preprocess(
    emptyToUndefined,
    z.url().default("https://data-api.binance.vision"),
  ),
  BINANCE_FUTURES_API_BASE_URL: z.preprocess(
    emptyToUndefined,
    z.url().default("https://fapi.binance.com"),
  ),
  ANALYZE_RATE_LIMIT_PER_MINUTE: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(1000).default(10),
  ),
  /** Bot token from @BotFather. Empty disables Telegram alerts. */
  TELEGRAM_BOT_TOKEN: z.preprocess(emptyToUndefined, z.string().min(20).optional()),
  /** Private chat that receives up/down alerts. Discovered from /start when empty. */
  TELEGRAM_CHAT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

/** Validated lazily so `next build` does not require runtime secrets. */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid server environment variables: ${fields}`);
  }
  cached = parsed.data;
  return cached;
}
