// Own-profile settings — PATCH the signed-in user's display name and/or locale.
// Available to any authenticated user (they can only ever change themselves).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";

const schema = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(120).optional(),
    locale: z.enum(["en", "bn"]).optional(),
  })
  .refine((v) => v.name !== undefined || v.locale !== undefined, {
    message: "Nothing to update",
  });

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();

    const json = await request.json().catch(() => null);
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const before = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, locale: true },
    });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.locale !== undefined ? { locale: parsed.data.locale } : {}),
      },
      select: { name: true, email: true, locale: true },
    });

    await writeAudit({
      actorId: user.id,
      action: "settings.profile.update",
      entity: "User",
      entityId: user.id,
      before,
      after: { name: updated.name, locale: updated.locale },
    });

    return Response.json({ profile: updated });
  } catch (error) {
    return apiError(error);
  }
}
