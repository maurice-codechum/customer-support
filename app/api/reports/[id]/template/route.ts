import { reportsPool } from "../../../_lib/db";
import { checkAuth } from "../../../_lib/auth";
import { notFound, toErrorResponse } from "../../../_lib/errors";

export const dynamic = "force-dynamic";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function asciiFallback(name: string): string {
  // Replace any non-ASCII or header-hostile chars with underscore.
  return name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\;\r\n]/g, "_") ||
    "template.docx";
}

function contentDisposition(name: string): string {
  const safe = asciiFallback(name);
  const encoded = encodeURIComponent(name).replace(/['()]/g, escape);
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denial = checkAuth(req);
  if (denial) return denial;

  try {
    const { id } = await params;
    const { rows } = await reportsPool.query<{
      template_name: string;
      template_blob: Buffer;
    }>(
      `SELECT template_name, template_blob FROM reports WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) return notFound();
    const { template_name, template_blob } = rows[0];
    const buf: Buffer = template_blob;
    const ab = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer;
    return new Response(ab, {
      headers: {
        "Content-Type": DOCX_MIME,
        "Content-Disposition": contentDisposition(template_name),
        "Content-Length": String(buf.byteLength),
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
