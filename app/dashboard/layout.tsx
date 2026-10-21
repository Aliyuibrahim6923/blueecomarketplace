import Link from "next/link";
import { redirect } from "next/navigation";
import { BellIcon } from "@/components/icons";
import { Logo } from "@/components/layout/logo";
import { Alert } from "@/components/ui/primitives";
import { requireViewer } from "@/lib/auth";
import { dashboardNav } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer("/dashboard");
  if (!viewer.profile.onboarding_completed) redirect("/onboarding");

  const supabase = await createClient();
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", viewer.id)
    .eq("is_read", false);

  const sections = dashboardNav(viewer.roles, viewer.businesses);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-white">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Logo />
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/notifications"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-ocean-800 hover:bg-ocean-50"
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <BellIcon />
              {unread ? (
                <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-coral-500 px-1 text-[11px] font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
            <span className="hidden text-sm text-muted-foreground sm:inline">{viewer.profile.full_name}</span>
            <form action="/auth/sign-out" method="post">
              <button type="submit" className="h-10 rounded-md px-3 text-sm font-medium text-ocean-800 hover:bg-ocean-50">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="lg:grid lg:grid-cols-[16rem_1fr]">
        <aside className="border-b border-border bg-white lg:min-h-[calc(100vh-3.5rem)] lg:border-b-0 lg:border-r">
          <details className="lg:hidden" open={false}>
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ocean-900">Menu</summary>
            <SideNav sections={sections} />
          </details>
          <div className="hidden lg:block">
            <SideNav sections={sections} />
          </div>
        </aside>
        <main id="main" className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
          {viewer.profile.account_status !== "active" ? (
            <Alert tone="danger" className="mb-6" title={`Your account is ${viewer.profile.account_status}`}>
              {viewer.profile.suspended_reason ?? "Some actions are unavailable."} Contact support through the Help page to appeal.
            </Alert>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}

function SideNav({ sections }: { sections: ReturnType<typeof dashboardNav> }) {
  return (
    <nav aria-label="Dashboard" className="space-y-5 px-3 py-4">
      {sections.map((s) => (
        <div key={s.title}>
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.title}</p>
          <ul className="mt-1 space-y-0.5">
            {s.items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="block rounded-md px-2 py-2 text-sm text-ocean-900 hover:bg-ocean-50">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
