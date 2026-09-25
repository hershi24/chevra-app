import { RsvpView } from "@/components/rsvp-view";
import { applyRsvp, readRsvp } from "@/lib/rsvp";
import type { RsvpStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RsvpPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const raw = typeof query.c === "string" ? query.c : undefined;
  const choice: RsvpStatus | undefined =
    raw === "yes" || raw === "no" || raw === "maybe" ? raw : undefined;
  let result = null;
  let error: string | null = null;
  try {
    result = choice ? await applyRsvp(token, choice) : await readRsvp(token);
    if (!result) error = "קישור לא תקין";
  } catch (err) {
    error = err instanceof Error ? err.message : "השמירה נכשלה";
  }
  return <RsvpView token={token} initial={result} initialError={error} />;
}
