type NotificationType = "contractor_assigned" | "contractor_accepted" | "contractor_declined";

interface NotifyParams {
  type: NotificationType;
  recipientEmail: string;
  recipientName: string;
  data: Record<string, string>;
}

/**
 * Fire-and-forget notification. Does not throw on failure.
 * Call AFTER the Supabase mutation succeeds.
 */
export function sendNotification(params: NotifyParams): void {
  fetch("/api/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).catch((err) => {
    console.warn("Notification failed (non-blocking):", err);
  });
}
