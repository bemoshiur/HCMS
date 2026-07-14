// GET /api/applications/export — server-side CSV export honouring the same
// role scope and filters as the list endpoint.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, apiError } from "@/lib/auth/guards";
import { toCsv, formatDate } from "@/lib/format";
import { buildApplicationWhere, listQuerySchema } from "../_lib/filters";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();

    const raw = Object.fromEntries(
      [...request.nextUrl.searchParams.entries()].filter(([, v]) => v !== "")
    );
    const parsed = listQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid query", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { where } = buildApplicationWhere(user, parsed.data);

    const rows = await prisma.application.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      take: 2000,
      include: {
        applicantOrg: { select: { name: true } },
        authorityOrg: { select: { name: true } },
        airport: { select: { icao: true, name: true } },
        assignedOfficer: { select: { name: true } },
        evaluationResults: {
          orderBy: { computedAt: "desc" },
          take: 1,
          select: { status: true, ptE_amslM: true, permissibleAglM: true, penetrationM: true },
        },
        certificates: { orderBy: { issuedAt: "desc" }, take: 1, select: { hcNo: true } },
      },
    });

    const csv = toCsv(
      [
        "Ref No",
        "Status",
        "Applicant",
        "Authority",
        "Airport",
        "Structure Type",
        "Requested Height (m AGL)",
        "Latitude",
        "Longitude",
        "Evaluation",
        "PTE (m AMSL)",
        "Permissible (m AGL)",
        "Penetration (m)",
        "HC No",
        "Assigned Officer",
        "SLA Due",
        "Submitted",
      ],
      rows.map((a) => {
        const ev = a.evaluationResults[0];
        return [
          a.refNo,
          a.status,
          a.applicantOrg.name,
          a.authorityOrg?.name ?? "",
          a.airport.icao,
          a.structureType,
          a.requestedHeightAglM,
          a.lat,
          a.lon,
          ev?.status ?? "",
          ev?.ptE_amslM ?? "",
          ev?.permissibleAglM ?? "",
          ev?.penetrationM ?? "",
          a.certificates[0]?.hcNo ?? "",
          a.assignedOfficer?.name ?? "",
          a.slaDueAt ? formatDate(a.slaDueAt) : "",
          a.submittedAt ? formatDate(a.submittedAt) : "",
        ];
      })
    );

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="applications-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
