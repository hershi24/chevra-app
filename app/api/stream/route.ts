import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { recordVisit } from "@/lib/visits";
import { onlineMemberIds, subscribe } from "@/lib/realtime";
import { persistQuietly, readState, updateState } from "@/lib/store";

function noteVisit(memberId: string, kind: "enter" | "beat" | "leave") {
  const write =
    kind === "beat"
      ? persistQuietly((state) => recordVisit(state, memberId, kind))
      : updateState((state) => {
          recordVisit(state, memberId, kind);
        }, { announce: true });
  return write.catch((error) => console.error("visit log failed", error));
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;
  let ping: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(data));
      };
      let entered: Promise<unknown> = Promise.resolve();
      cleanup = subscribe(
        { send, memberId: me.id },
        {
          onFirst: () => {
            entered = noteVisit(me.id, "enter");
          },
          onLast: () => {
            void noteVisit(me.id, "leave");
          },
        }
      );
      await entered;
      ping = setInterval(() => {
        try {
          send(`: ping\n\n`);
          noteVisit(me.id, "beat");
        } catch {
          clearInterval(ping);
          cleanup?.();
        }
      }, 25_000);
      const state = await readState();
      send(
        `data: ${JSON.stringify({
          type: "hello",
          revision: state.revision,
          ids: onlineMemberIds(),
        })}\n\n`
      );
    },
    cancel() {
      clearInterval(ping);
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
