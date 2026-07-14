import { prisma } from "@/lib/db";
import { requireUser, apiError } from "@/lib/auth/guards";

export async function POST() {
  try {
    const user = await requireUser();
    await prisma.notification.updateMany({
      where: { userId: user.id, channel: "IN_APP", read: false },
      data: { read: true },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
