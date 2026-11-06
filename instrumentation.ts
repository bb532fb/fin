export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { startSignalAlerts } = await import("@/services/signal-alerts");
  startSignalAlerts();
}
