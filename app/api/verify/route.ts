// GET /api/verify?code= — PUBLIC certificate verification (no auth).
// Matches HC number OR QR token, case-insensitive. valid=true only for an
// ISSUED certificate that has not passed its validTo date; REVOKED/EXPIRED/
// SUPERSEDED still return the certificate payload so the UI can show why.
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/auth/guards";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code")?.trim();
    if (!code) return Response.json({ valid: false });

    const certificate = await prisma.certificate.findFirst({
      where: {
        OR: [
          { hcNo: { equals: code, mode: "insensitive" } },
          { qrToken: { equals: code, mode: "insensitive" } },
        ],
      },
      include: {
        application: {
          select: {
            lat: true,
            lon: true,
            siteAddress: true,
            applicantOrg: { select: { name: true } },
            authorityOrg: { select: { name: true } },
            airport: { select: { icao: true, name: true } },
          },
        },
        signedBy: { select: { name: true } },
      },
    });

    if (!certificate) return Response.json({ valid: false });

    const valid =
      certificate.status === "ISSUED" && certificate.validTo.getTime() >= Date.now();

    return Response.json({
      valid,
      certificate: {
        hcNo: certificate.hcNo,
        status: certificate.status,
        decision: certificate.decision,
        applicantName: certificate.application.applicantOrg.name,
        authorityName: certificate.application.authorityOrg?.name ?? null,
        airport: {
          icao: certificate.application.airport.icao,
          name: certificate.application.airport.name,
        },
        lat: certificate.application.lat,
        lon: certificate.application.lon,
        siteAddress: certificate.application.siteAddress,
        ptE_amslM: certificate.ptE_amslM,
        permissibleAglM: certificate.permissibleAglM,
        governingSurface: certificate.governingSurface,
        conditions: certificate.conditions,
        validFrom: certificate.validFrom,
        validTo: certificate.validTo,
        issuedAt: certificate.issuedAt,
        signedByName: certificate.signedBy?.name ?? null,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
