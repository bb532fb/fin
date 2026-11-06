import "server-only";
import { logger } from "@/lib/logger";

const TIMEOUT_MS = 10_000;

interface TelegramUpdate {
  message?: { text?: string; chat?: { id?: number; type?: string } };
}

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
): Promise<boolean> {
  try {
    const response = await fetch(telegramUrl(token, "sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn("telegram_send_failed", { status: response.status });
      return false;
    }
    return true;
  } catch (error) {
    logger.warn("telegram_send_failed", { status: error instanceof Error ? error.name : "error" });
    return false;
  }
}

/** Latest private chat that has written to this bot. Null until the user presses Start. */
export async function findTelegramChatId(token: string): Promise<string | null> {
  try {
    const response = await fetch(telegramUrl(token, "getUpdates"), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { ok?: boolean; result?: TelegramUpdate[] };
    const updates = body.ok ? (body.result ?? []) : [];
    for (let i = updates.length - 1; i >= 0; i--) {
      const chat = updates[i]?.message?.chat;
      if (chat?.type === "private" && typeof chat.id === "number") return String(chat.id);
    }
    return null;
  } catch {
    return null;
  }
}

function telegramUrl(token: string, method: string): string {
  return `https://api.telegram.org/bot${token}/${method}`;
}
