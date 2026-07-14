// Serves a small generated sample PDF for seeded document records (demo).
// Real uploads are stored in the DB (DocumentFile.data) via the portal module.
import { NextRequest } from "next/server";

const LABELS: Record<string, string> = {
  OWNERSHIP: "Ownership Document (Sample)",
  SITE_PLAN: "Site Plan (Sample)",
  ELEVATION_CERT: "Ground Elevation Certificate (Sample)",
  MOUZA_MAP: "Mouza Map (Sample)",
  OTHER: "Supporting Document (Sample)",
};

/** Minimal single-page PDF with a title — no dependencies. */
function tinyPdf(title: string): Uint8Array {
  const safe = title.replace(/[()\\]/g, "");
  const content = `BT /F1 20 Tf 72 720 Td (${safe}) Tj 0 -28 Td /F1 11 Tf (CAAB HCMS demonstration document. Not an official record.) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) body += `${String(off).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new TextEncoder().encode(body);
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") ?? "OTHER";
  const pdf = tinyPdf(LABELS[type] ?? LABELS.OTHER);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${type.toLowerCase()}-sample.pdf"`,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
