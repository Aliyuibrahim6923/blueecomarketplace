import { requireAdmin } from "@/lib/auth";

/** UX gate only: every admin query and action is re-authorised in the database. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
