import { getSession, publicView, subscribe } from "@/server/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Server-Sent Events: the full public state on connect and on every change (simple and small enough here).
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const s = getSession(code);
  if (!s) return Response.json({ error: "Jar not found" }, { status: 404 });
  const v = new URL(req.url).searchParams.get("playerId");
  const viewer = v && s.players[v] ? v : null;
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          cleanup();
        }
      };
      // A 2 KB comment first: some layers hold small chunks before flushing a stream.
      send(`: ${" ".repeat(2048)}\n\n`);
      send(`retry: 2000\nevent: state\ndata: ${JSON.stringify(publicView(s, viewer))}\n\n`);
      const unsub = subscribe(code, viewer, (view) => send(`event: state\ndata: ${JSON.stringify(view)}\n\n`));
      const ping = setInterval(() => send(`: ping\n\n`), 15000);
      cleanup = () => {
        clearInterval(ping);
        unsub();
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
