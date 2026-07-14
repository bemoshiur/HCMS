// Shared types for the notifications centre.
import type { NotifyEvent } from "@/lib/notify";

export interface InAppNotification {
  id: string;
  event: NotifyEvent | string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  sentAt: string;
}

export interface InAppResponse {
  items: InAppNotification[];
  unread: number;
}

export interface DeliveryLogItem {
  id: string;
  channel: "EMAIL" | "SMS";
  event: NotifyEvent | string;
  title: string;
  body: string;
  recipient: string;
  read: boolean;
  sentAt: string;
}

export interface DeliveryLogResponse {
  items: DeliveryLogItem[];
}
