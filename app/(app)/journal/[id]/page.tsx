import { JournalDetail } from "@/components/journal-detail";

export default function JournalEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <JournalDetail params={params} />;
}
