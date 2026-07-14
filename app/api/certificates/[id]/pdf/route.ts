// GET /api/certificates/[id]/pdf — streams the bilingual certificate PDF.
// Node runtime (fonts from disk, fontkit). Inline disposition for in-browser view.
import { prisma } from "@/lib/db";
import { requireUser, apiError, AuthError } from "@/lib/auth/guards";
import {
  assertCertificateAccess,
} from "@/lib/certificates/issue";
import {
  makeQrDataUrl,
  renderCertificatePdf,
} from "@/lib/certificates/pdf";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const certificate = await prisma.certificate.findUnique({
      where: { id },
      include: {
        application: {
          select: {
            id: true,
            structureType: true,
            siteAddress: true,
            lat: true,
            lon: true,
            groundElevationM: true,
            createdById: true,
            applicantOrgId: true,
            authorityOrgId: true,
            applicantOrg: { select: { name: true } },
            authorityOrg: { select: { name: true } },
            airport: { select: { icao: true, name: true } },
          },
        },
        signedBy: { select: { name: true } },
      },
    });
    if (!certificate) throw new AuthError("Certificate not found", 404);
    assertCertificateAccess(user, certificate.application);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const verifyUrl = `${appUrl}/verify?code=${certificate.qrToken}`;
    const qrDataUrl = await makeQrDataUrl(verifyUrl);

    const buffer = await renderCertificatePdf({
      hcNo: certificate.hcNo,
      issuedAt: certificate.issuedAt,
      applicantName: certificate.application.applicantOrg.name,
      authorityName: certificate.application.authorityOrg?.name ?? null,
      structureType: certificate.application.structureType,
      siteAddress: certificate.application.siteAddress,
      lat: certificate.application.lat,
      lon: certificate.application.lon,
      airportName: certificate.application.airport.name,
      airportIcao: certificate.application.airport.icao,
      groundElevationM: certificate.application.groundElevationM,
      ptE_amslM: certificate.ptE_amslM,
      permissibleAglM: certificate.permissibleAglM,
      governingSurface: certificate.governingSurface,
      validFrom: certificate.validFrom,
      validTo: certificate.validTo,
      conditions: certificate.conditions,
      signedByName: certificate.signedBy?.name ?? null,
      qrDataUrl,
      verifyUrl,
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${certificate.hcNo}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
