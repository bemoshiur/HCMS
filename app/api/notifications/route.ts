// In-app notifications for the signed-in user.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, apiError } from "@/lib/auth/guards";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 20), 100);

    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id, channel: "IN_APP" },
        orderBy: { sentAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: user.id, channel: "IN_APP", read: false },
      }),
    ]);

    return Response.json({ items, unread });
  } catch (error) {
    return apiError(error);
  }
}
