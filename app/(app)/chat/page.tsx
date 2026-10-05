import { redirect } from "next/navigation";
import { ChatView } from "@/components/chat-view";
import { boardEnabled } from "@/lib/community-board";
import { readState } from "@/lib/store";

export default async function ChatPage() {
  if (boardEnabled(await readState())) redirect("/");
  return <ChatView />;
}
