// Mocked EMAIL/SMS delivery log for the signed-in user.
// Real SMTP/SMS gateways are not wired in the demo — lib/notify writes these rows
// alongside IN_APP so the dispatch is visible here instead of being sent.
import { prisma } from "@/lib/db";
import { requireUser, apiError } from "@/lib/auth/guards";

/** Mask a phone number for display, keeping the last 3 digits. */
function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return trimmed;
  const tail = trimmed.slice(-3);
  const head = trimmed.startsWith("+") ? "+" : "";
  return `${head}${"•".repeat(Math.max(3, trimmed.length - 3 - head.length))}${tail}`;
}

export async function GET() {
  try {
    const user = await requireUser();

    const rows = await prisma.notification.findMany({
      where: { userId: user.id, channel: { in: ["EMAIL", "SMS"] } },
      orderBy: { sentAt: "desc" },
      take: 100,
      // Light join for the recipient address/number (all rows are the caller's own).
      include: { user: { select: { email: true, phone: true } } },
    });

    const items = rows.map((n) => ({
      id: n.id,
      channel: n.channel as "EMAIL" | "SMS",
      event: n.event,
      title: n.title,
      body: n.body,
      sentAt: n.sentAt,
      read: n.read,
      recipient:
        n.channel === "EMAIL"
          ? n.user.email
          : maskPhone(n.user.phone) ?? "—",
    }));

    return Response.json({ items });
  } catch (error) {
    return apiError(error);
  }
}
