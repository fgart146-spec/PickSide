import { createServiceClient } from "@/lib/supabase/service";

/**
 * Creates an in-app notification for another user. Always goes through the
 * service-role client: the actor triggering a notification (e.g. someone
 * leaving a comment) is never the recipient, so a normal RLS-bound insert
 * (which can only write rows matching auth.uid()) would be rejected.
 */
export async function notifyUser(params: {
  userId: string;
  type: string;
  message: string;
  link: string;
}) {
  const service = createServiceClient();
  await service.from("notifications").insert({
    user_id: params.userId,
    type: params.type,
    message: params.message,
    link: params.link,
  });
}
