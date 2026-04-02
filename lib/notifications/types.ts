export type NotificationSeverity = "info" | "success" | "warning" | "critical";

export type NotificationSourceModule =
  | "audit"
  | "products"
  | "autopilot"
  | "sprint"
  | "competitor"
  | "playbooks"
  | "system";

export type NotificationRow = {
  id: string;
  user_id: string;
  client_id: string;
  type: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  source_module: NotificationSourceModule;
  action_label: string | null;
  action_url: string | null;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CreateNotificationInput = {
  userId: string;
  clientId: string;
  type: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  sourceModule: NotificationSourceModule;
  actionLabel?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

