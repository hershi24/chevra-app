import { ChatView } from "@/components/chat-view";

export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatView channelId={id} />;
}
