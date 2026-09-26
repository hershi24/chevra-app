import { applyPollLink } from "@/lib/poll-vote";

export const dynamic = "force-dynamic";

export default async function PollVotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let result: Awaited<ReturnType<typeof applyPollLink>> | { error: string } = { error: "קישור לא תקין" };
  try {
    result = await applyPollLink(token);
  } catch (error) {
    result = { error: error instanceof Error ? error.message : "השמירה נכשלה" };
  }
  const saved = "choice" in result && result.choice ? result : null;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f7f8f9] px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white px-6 py-8 text-center shadow-[0_18px_50px_rgba(31,35,40,0.16)] ring-1 ring-black/10">
        {saved ? (
          <>
            <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary text-lg text-primary-foreground">
              ✓
            </div>
            <p className="mt-4 text-2xl font-medium">עזרת לנו מאוד!!</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {saved.name}, הבחירה שלך: {saved.choice}
            </p>
          </>
        ) : (
          <p className="text-destructive">{"error" in result ? result.error : "קישור לא תקין"}</p>
        )}
      </div>
    </div>
  );
}
