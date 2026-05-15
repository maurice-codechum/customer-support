import { reportsPool } from "../../../../../_lib/db";
import { checkAuth } from "../../../../../_lib/auth";
import { notFound, toErrorResponse } from "../../../../../_lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; hid: string }> },
) {
  const denial = checkAuth(req);
  if (denial) return denial;

  try {
    const { id, hid } = await params;
    const { rows } = await reportsPool.query<{
      image_blob: Buffer | null;
      image_mime: string | null;
    }>(
      `SELECT image_blob, image_mime
       FROM report_product_highlights
       WHERE id = $1 AND report_id = $2`,
      [hid, id],
    );
    if (rows.length === 0 || !rows[0].image_blob) return notFound();
    const buf: Buffer = rows[0].image_blob;
    const ab = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer;
    return new Response(ab, {
      headers: {
        "Content-Type": rows[0].image_mime ?? "image/png",
        "Content-Length": String(buf.byteLength),
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
