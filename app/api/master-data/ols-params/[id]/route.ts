// Master data — activate an OLS parameter version. Activating one version
// deactivates all others for the same airport. Confirmed in the UI; audited.
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCapability("masterdata.manage");
    const { id } = await params;

    const target = await prisma.olsParameterSet.findUnique({
      where: { id },
      include: { airport: { select: { icao: true } } },
    });
    if (!target) return Response.json({ error: "Parameter set not found" }, { status: 404 });

    const previouslyActive = await prisma.olsParameterSet.findFirst({
      where: { airportId: target.airportId, active: true },
      select: { id: true, version: true },
    });

    // Deactivate every version for this airport, then activate the target one.
    const paramSet = await prisma.$transaction(async (tx) => {
      await tx.olsParameterSet.updateMany({
        where: { airportId: target.airportId, active: true },
        data: { active: false },
      });
      return tx.olsParameterSet.update({
        where: { id },
        data: { active: true, signedOffBy: user.name },
      });
    });

    await writeAudit({
      actorId: user.id,
      action: "masterdata.olsParams.activate",
      entity: "OlsParameterSet",
      entityId: paramSet.id,
      before: { activeVersion: previouslyActive?.version ?? null },
      after: {
        airport: target.airport.icao,
        activeVersion: paramSet.version,
        framework: paramSet.framework,
        signedOffBy: user.name,
      },
    });

    return Response.json({ paramSet });
  } catch (error) {
    return apiError(error);
  }
}
