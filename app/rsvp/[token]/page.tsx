import { RsvpView } from "@/components/rsvp-view";

export default async function RsvpPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ c?: string | string[] }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const choice = typeof query.c === "string" ? query.c : undefined;
  return <RsvpView token={token} choice={choice} />;
}
