import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, BusinessSummary, Profile } from "@/types/domain";

export type Viewer = {
  id: string;
  email: string | null;
  profile: Profile;
  roles: AppRole[];
  businesses: BusinessSummary[];
};

/**
 * The signed-in user with profile, active roles and business memberships.
 * Cached per request. Reads go through RLS, so a user only ever sees their own rows.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: roles }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("role_assignments").select("role").eq("user_id", user.id).is("revoked_at", null),
    supabase
      .from("business_memberships")
      .select(
        "role, business:businesses(id, name, slug, is_supplier, is_logistics_provider, is_buyer_organisation, verification_status, status, state_code, deleted_at)",
      )
      .eq("user_id", user.id),
  ]);

  if (!profile) return null;

  const businesses: BusinessSummary[] = (memberships ?? [])
    .map((m) => {
      const b = (Array.isArray(m.business) ? m.business[0] : m.business) as BusinessSummary | null;
      return b && !b.deleted_at ? { ...b, membership_role: m.role } : null;
    })
    .filter((b): b is BusinessSummary => b !== null);

  return {
    id: user.id,
    email: user.email ?? null,
    profile: profile as Profile,
    roles: (roles ?? []).map((r) => r.role as AppRole),
    businesses,
  };
});

export async function requireViewer(nextPath = "/dashboard"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`);
  return viewer;
}

export function hasRole(viewer: Viewer | null, role: AppRole): boolean {
  return !!viewer && viewer.profile.account_status === "active" && viewer.roles.includes(role);
}

/** UI-level gate for admin pages. The database re-checks every admin action. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer("/dashboard/admin");
  if (!hasRole(viewer, "admin")) redirect("/dashboard?denied=admin");
  return viewer;
}

export async function requireAnalystOrAdmin(): Promise<Viewer> {
  const viewer = await requireViewer("/dashboard/analytics");
  if (!hasRole(viewer, "agency_analyst") && !hasRole(viewer, "admin")) redirect("/dashboard?denied=analytics");
  return viewer;
}

export function supplierBusinesses(viewer: Viewer) {
  return viewer.businesses.filter((b) => b.is_supplier);
}

export function logisticsBusinesses(viewer: Viewer) {
  return viewer.businesses.filter((b) => b.is_logistics_provider);
}

export function managedBusinesses(viewer: Viewer) {
  return viewer.businesses.filter((b) => b.membership_role === "owner" || b.membership_role === "manager");
}
