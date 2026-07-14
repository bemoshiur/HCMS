// Bulk mark notifications read/unread — owner only. No audit (reads aren't audited).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, apiError } from "@/lib/auth/guards";

const markSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  read: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const json = await request.json().catch(() => null);
    const parsed = markSchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { ids, read } = parsed.data;

    // userId filter guarantees callers can only touch their own rows.
    const result = await prisma.notification.updateMany({
      where: { id: { in: ids }, userId: user.id },
      data: { read },
    });

    return Response.json({ ok: true, count: result.count });
  } catch (error) {
    return apiError(error);
  }
}
