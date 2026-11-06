import { z } from "zod";
import { MARKETS, POCKET_SYMBOLS } from "@/lib/config/market";
import { AppError } from "@/lib/errors";
import { handleJson, parseJsonBody } from "@/lib/http";
import { getAlertWatch, setAlertWatch } from "@/services/alert-watch";

const bodySchema = z.strictObject({
  venues: z.array(z.enum(MARKETS)).max(MARKETS.length),
  muted: z.array(z.enum(POCKET_SYMBOLS)).max(POCKET_SYMBOLS.length),
});

export async function GET(): Promise<Response> {
  return Response.json(await getAlertWatch(), { headers: { "Cache-Control": "no-store" } });
}

/** Local switches only. Not counted against the analyze limit. */
export function PUT(request: Request): Promise<Response> {
  return handleJson("alert_watch_failed", async () => {
    const parsed = bodySchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Շուկայի ընտրությունը սխալ է։");
    return setAlertWatch(parsed.data.venues, parsed.data.muted);
  });
}
