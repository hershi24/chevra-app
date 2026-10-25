import { runNudges } from "./nudge";

const FIRST_RUN_MS = 60_000;
const EVERY_MS = 15 * 60_000;

const g = globalThis as unknown as { __chevraNudgeTimer?: boolean };

async function tick() {
  try {
    const result = await runNudges();
    if (result.ran) {
      const sent = result.deliveries.filter((row) => row.status === "sent").length;
      console.info(`[nudge] ${sent}/${result.deliveries.length} reminders sent`);
    }
  } catch (error) {
    console.error("[nudge] run failed", error);
  }
}

export function startNudgeScheduler() {
  if (g.__chevraNudgeTimer) return;
  g.__chevraNudgeTimer = true;
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), EVERY_MS).unref?.();
  }, FIRST_RUN_MS).unref?.();
}
