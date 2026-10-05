import { redirect } from "next/navigation";
import { ChatView } from "@/components/chat-view";
import { boardEnabled } from "@/lib/community-board";
import { readState } from "@/lib/store";

export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (boardEnabled(await readState())) redirect("/");
  const { id } = await params;
  return <ChatView channelId={id} />;
}
