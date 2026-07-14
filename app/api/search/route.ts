// Command-palette search: applications by ref/applicant (role-scoped).
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, apiError } from "@/lib/auth/guards";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return Response.json([]);

    const where: Prisma.ApplicationWhereInput = {
      OR: [
        { refNo: { contains: q, mode: "insensitive" } },
        { applicantOrg: { name: { contains: q, mode: "insensitive" } } },
        { siteAddress: { contains: q, mode: "insensitive" } },
      ],
    };
    // Scope: applicants see their org's cases; authority officers their jurisdiction's
    if (user.role === "APPLICANT") {
      where.applicantOrgId = user.orgId ?? "__none__";
    } else if (user.role === "AUTHORITY_OFFICER") {
      where.authorityOrgId = user.orgId ?? "__none__";
    }

    const apps = await prisma.application.findMany({
      where,
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { applicantOrg: { select: { name: true } }, airport: { select: { icao: true } } },
    });

    return Response.json(
      apps.map((a) => ({
        id: a.id,
        refNo: a.refNo,
        applicant: a.applicantOrg.name,
        status: a.status,
        airport: a.airport.icao,
      }))
    );
  } catch (error) {
    return apiError(error);
  }
}
