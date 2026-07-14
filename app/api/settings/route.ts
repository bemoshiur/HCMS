// System settings — GET all rows (System tab) + PATCH a single keyed setting.
// Restricted to settings.manage (ADMIN). Every write is audited with before/after.
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCapability, apiError } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { SLA_DAYS } from "@/lib/workflow";
import type { Prisma } from "@prisma/client";

const SETTING_KEYS = [
  "sla.workingDays",
  "safeguarding.radiusKm",
  "features.billing",
  "certificate.validityYears",
  "notifications.templates",
] as const;

// ─────────────────────────────── GET ───────────────────────────────

export async function GET() {
  try {
    await requireCapability("settings.manage");

    const rows = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
    const settings: Record<string, unknown> = {};
    for (const row of rows) settings[row.key] = row.value;

    // Informational SLA day budgets (read-only) sourced from the workflow policy.
    const slaPolicy = Object.entries(SLA_DAYS).map(([status, days]) => ({
      status,
      days: days as number,
    }));

    return Response.json({ settings, slaPolicy });
  } catch (error) {
    return apiError(error);
  }
}

// ─────────────────────────────── PATCH ───────────────────────────────

const weekdayEnum = z.enum(["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const VALUE_SCHEMAS = {
  "sla.workingDays": z.object({
    weekend: z.array(weekdayEnum).max(7),
    holidays: z.array(dateStr).max(80),
  }),
  "safeguarding.radiusKm": z.object({ default: z.number().min(1).max(200) }),
  "features.billing": z.object({ enabled: z.boolean() }),
  "certificate.validityYears": z.object({ years: z.number().int().min(1).max(25) }),
  "notifications.templates": z.record(
    z.string(),
    z.object({ email: z.string().max(800), sms: z.string().max(400) })
  ),
} satisfies Record<(typeof SETTING_KEYS)[number], z.ZodTypeAny>;

const patchSchema = z.object({
  key: z.enum(SETTING_KEYS),
  value: z.unknown(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireCapability("settings.manage");

    const json = await request.json().catch(() => null);
    const base = patchSchema.safeParse(json);
    if (!base.success) {
      return Response.json(
        { error: "Invalid input", issues: base.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const valueParsed = VALUE_SCHEMAS[base.data.key].safeParse(base.data.value);
    if (!valueParsed.success) {
      return Response.json(
        { error: "Invalid setting value", issues: valueParsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.systemSetting.findUnique({
      where: { key: base.data.key },
    });
    const nextValue = valueParsed.data as Prisma.InputJsonValue;

    const setting = await prisma.systemSetting.upsert({
      where: { key: base.data.key },
      create: { key: base.data.key, value: nextValue },
      update: { value: nextValue },
    });

    await writeAudit({
      actorId: user.id,
      action: "settings.update",
      entity: "SystemSetting",
      entityId: base.data.key,
      before: existing?.value ?? null,
      after: setting.value,
    });

    return Response.json({ setting: { key: setting.key, value: setting.value } });
  } catch (error) {
    return apiError(error);
  }
}
