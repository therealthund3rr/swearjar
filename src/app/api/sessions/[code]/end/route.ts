import { z } from "zod";
import { sessionReports } from "@/server/ai";
import { settleSession } from "@/server/settle";
import { getSession, handle, HttpError, mutate, requireCreator } from "@/server/store";

const Body = z.object({ playerId: z.string() });

// Idempotent: a second call only retries players whose settlement failed.
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return handle(async () => {
    const { playerId } = Body.parse(await req.json());
    const s = getSession(code);
    if (!s) throw new HttpError(404, "Jar not found");
    requireCreator(s, playerId);
    if (s.status === "lobby") throw new HttpError(409, "The session has not started");
    const results = await settleSession(code);
    const after = getSession(code)!;
    if (Object.keys(after.reports).length === 0) {
      // Reports are a nice-to-have: never let them break settlement.
      try {
        const reports = await sessionReports(after);
        mutate(code, (x) => {
          x.reports = reports;
        });
      } catch (err) {
        console.error("reports failed", (err as Error).message);
      }
    }
    return { results, receiptId: getSession(code)!.receiptId };
  });
}
