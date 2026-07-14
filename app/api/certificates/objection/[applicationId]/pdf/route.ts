// GET /api/certificates/objection/[applicationId]/pdf — bilingual objection letter
// for a refused / penetrating application, citing the permissible alternative.
import { prisma } from "@/lib/db";
import { requireUser, apiError, AuthError } from "@/lib/auth/guards";
import { assertCertificateAccess } from "@/lib/certificates/issue";
import { renderObjectionPdf } from "@/lib/certificates/pdf";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const user = await requireUser();
    const { applicationId } = await params;

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        applicantOrg: { select: { name: true } },
        authorityOrg: { select: { name: true } },
        airport: { select: { icao: true, name: true } },
        evaluationResults: { orderBy: { computedAt: "desc" }, take: 1 },
      },
    });
    if (!application) throw new AuthError("Application not found", 404);
    assertCertificateAccess(user, application);

    const evaluation = application.evaluationResults[0];
    const isObjection =
      application.status === "REJECTED" || evaluation?.status === "OBJECTION";
    if (!evaluation || !isObjection) {
      throw new AuthError(
        "No objection letter is available — the application is not refused/penetrating",
        409
      );
    }

    const buffer = await renderObjectionPdf({
      refNo: application.refNo,
      date: application.decidedAt ?? new Date(),
      applicantName: application.applicantOrg.name,
      authorityName: application.authorityOrg?.name ?? null,
      structureType: application.structureType,
      siteAddress: application.siteAddress,
      lat: application.lat,
      lon: application.lon,
      airportName: application.airport.name,
      airportIcao: application.airport.icao,
      requestedHeightAglM: application.requestedHeightAglM,
      requestedTopElevationAmslM: application.requestedTopElevationAmslM,
      governingSurface: evaluation.governingSurface,
      penetrationM: evaluation.penetrationM ?? 0,
      ptE_amslM: evaluation.ptE_amslM,
      permissibleAglM: evaluation.permissibleAglM,
      signedByName: null,
    });

    const filename = `Objection-${application.refNo.replace(/[\\/]/g, "-")}.pdf`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
