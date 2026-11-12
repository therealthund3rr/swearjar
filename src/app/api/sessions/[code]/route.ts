import { getSession, handle, HttpError, publicView } from "@/server/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return handle(() => {
    const s = getSession(code);
    if (!s) throw new HttpError(404, "Jar not found");
    const viewer = new URL(req.url).searchParams.get("playerId");
    return publicView(s, viewer && s.players[viewer] ? viewer : null);
  });
}
