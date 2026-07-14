// Mark a single in-app notification read — owner only. No audit (reads aren't audited).
import { prisma } from "@/lib/db";
import { requireUser, apiError } from "@/lib/auth/guards";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    // Scope the update to the caller's own notifications so a foreign id is a no-op.
    const result = await prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { read: true },
    });

    if (result.count === 0) {
      return Response.json({ error: "Notification not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
