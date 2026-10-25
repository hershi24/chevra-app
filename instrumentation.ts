export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startNudgeScheduler } = await import("./lib/nudge-scheduler");
  startNudgeScheduler();
}
