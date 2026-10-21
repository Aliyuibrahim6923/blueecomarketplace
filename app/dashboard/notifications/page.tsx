import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/form/action-form";
import { SubmitButton } from "@/components/form/fields";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { markNotificationsReadAction } from "@/features/account/actions";
import { requireViewer } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDateTime } from "@/lib/utils";
import type { NotificationRow } from "@/types/domain";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const viewer = await requireViewer("/dashboard/notifications");
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, is_read, created_at")
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const items = (data ?? []) as NotificationRow[];

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          items.some((n) => !n.is_read) ? (
            <ActionForm action={markNotificationsReadAction}>
              <SubmitButton variant="outline" size="sm" pendingText="…">
                Mark all as read
              </SubmitButton>
            </ActionForm>
          ) : null
        }
      />
      {items.length === 0 ? (
        <EmptyState title="No notifications yet" description="Updates about your orders, enquiries and account appear here." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-white">
          {items.map((n) => (
            <li key={n.id} className={cn("flex items-start justify-between gap-3 px-4 py-3", !n.is_read && "bg-ocean-50/60")}>
              <div>
                <p className={cn("text-sm", !n.is_read && "font-semibold")}>
                  {n.link ? (
                    <Link href={safeRedirectPath(n.link)} className="hover:underline">
                      {n.title}
                    </Link>
                  ) : (
                    n.title
                  )}
                </p>
                {n.body ? <p className="text-sm text-muted-foreground">{n.body}</p> : null}
                <p className="text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
              </div>
              {!n.is_read ? (
                <ActionForm action={markNotificationsReadAction} hidden={{ id: n.id }}>
                  <SubmitButton variant="ghost" size="sm" pendingText="…">
                    Mark read
                  </SubmitButton>
                </ActionForm>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
