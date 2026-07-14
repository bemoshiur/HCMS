// Notifications — in-app records plus mocked EMAIL/SMS entries (visible log).
// Real SMTP/SMS gateways are intentionally not wired in the demo build.
import { prisma } from "@/lib/db";
import type { NotificationChannel } from "@prisma/client";

export type NotifyEvent =
  | "APPLICATION_SUBMITTED"
  | "APPLICATION_ENDORSED"
  | "APPLICATION_RETURNED"
  | "APPLICATION_ASSIGNED"
  | "REVIEW_COMPLETED"
  | "STUDY_COMPLETED"
  | "DECISION_MADE"
  | "CERTIFICATE_ISSUED"
  | "CERTIFICATE_REVOKED"
  | "CERTIFICATE_EXPIRING"
  | "OBSTACLE_FLAGGED";

export async function notify(options: {
  userId: string;
  event: NotifyEvent;
  title: string;
  body: string;
  link?: string;
  channels?: NotificationChannel[]; // defaults to IN_APP + EMAIL (mock)
}): Promise<void> {
  const channels = options.channels ?? ["IN_APP", "EMAIL"];
  await prisma.notification.createMany({
    data: channels.map((channel) => ({
      userId: options.userId,
      channel,
      event: options.event,
      title: options.title,
      body: options.body,
      link: options.link ?? null,
    })),
  });
}

/** Notify several users at once (queue assignments, decisions). */
export async function notifyMany(
  userIds: string[],
  options: Omit<Parameters<typeof notify>[0], "userId">
): Promise<void> {
  await Promise.all(userIds.map((userId) => notify({ ...options, userId })));
}
