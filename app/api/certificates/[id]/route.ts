// GET /api/certificates/[id] — one certificate with parties, airport and signer.
// Staff or the application's own parties (applicant org / authority org / creator).
import { prisma } from "@/lib/db";
import { requireUser, apiError, AuthError } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { assertCertificateAccess } from "@/lib/certificates/issue";

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
            refNo: true,
            structureType: true,
            siteAddress: true,
            lat: true,
            lon: true,
            groundElevationM: true,
            requestedHeightAglM: true,
            requestedTopElevationAmslM: true,
            createdById: true,
            applicantOrgId: true,
            authorityOrgId: true,
            applicantOrg: { select: { name: true } },
            authorityOrg: { select: { name: true } },
            airport: { select: { icao: true, name: true, city: true } },
          },
        },
        signedBy: { select: { name: true } },
      },
    });
    if (!certificate) throw new AuthError("Certificate not found", 404);
    assertCertificateAccess(user, certificate.application);

    return Response.json({
      canManage: can(user.role, "certificate.manage"),
      certificate: {
        id: certificate.id,
        hcNo: certificate.hcNo,
        status: certificate.status,
        decision: certificate.decision,
        ptE_amslM: certificate.ptE_amslM,
        permissibleAglM: certificate.permissibleAglM,
        governingSurface: certificate.governingSurface,
        conditions: certificate.conditions,
        validFrom: certificate.validFrom,
        validTo: certificate.validTo,
        issuedAt: certificate.issuedAt,
        qrToken: certificate.qrToken,
        supersededById: certificate.supersededById,
        signedByName: certificate.signedBy?.name ?? null,
        application: {
          id: certificate.application.id,
          refNo: certificate.application.refNo,
          structureType: certificate.application.structureType,
          siteAddress: certificate.application.siteAddress,
          lat: certificate.application.lat,
          lon: certificate.application.lon,
          groundElevationM: certificate.application.groundElevationM,
          applicant: certificate.application.applicantOrg.name,
          authority: certificate.application.authorityOrg?.name ?? null,
          airport: certificate.application.airport,
        },
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
