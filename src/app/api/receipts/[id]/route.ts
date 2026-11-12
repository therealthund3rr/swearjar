import { getReceipt, handle, HttpError } from "@/server/store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => {
    const r = getReceipt(id);
    if (!r) throw new HttpError(404, "Receipt not found");
    return r;
  });
}
