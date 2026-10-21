/**
 * UI-only permission helpers (which links and buttons to show).
 * The database enforces the real rules through RLS and RPC checks.
 */
import type { AppRole, BusinessSummary, MembershipRole } from "@/types/domain";
import type { OrderActor, OrderStatus } from "@/lib/orders/state-machine";
import { allowedNextStatuses, DEDICATED_ACTIONS } from "@/lib/orders/state-machine";

export type NavItem = { href: string; label: string };
export type NavSection = { title: string; items: NavItem[] };

export function dashboardNav(roles: AppRole[], businesses: BusinessSummary[]): NavSection[] {
  const sections: NavSection[] = [
    {
      title: "My account",
      items: [
        { href: "/dashboard", label: "Overview" },
        { href: "/dashboard/notifications", label: "Notifications" },
        { href: "/dashboard/account", label: "Account & privacy" },
      ],
    },
    {
      title: "Buying",
      items: [
        { href: "/marketplace", label: "Browse marketplace" },
        { href: "/cart", label: "Cart" },
        { href: "/dashboard/orders?view=buying", label: "My orders" },
        { href: "/dashboard/enquiries?view=buying", label: "Enquiries & quotes" },
        { href: "/dashboard/saved", label: "Saved products" },
        { href: "/dashboard/bookings?view=requested", label: "Logistics bookings" },
        { href: "/dashboard/disputes", label: "Disputes" },
      ],
    },
  ];

  const sells = roles.includes("supplier") || businesses.some((b) => b.is_supplier);
  if (sells) {
    sections.push({
      title: "Selling",
      items: [
        { href: "/dashboard/supplier", label: "Supplier overview" },
        { href: "/dashboard/supplier/listings", label: "Listings" },
        { href: "/dashboard/orders?view=selling", label: "Incoming orders" },
        { href: "/dashboard/enquiries?view=selling", label: "Incoming enquiries" },
      ],
    });
  }
  if (roles.includes("logistics_provider") || businesses.some((b) => b.is_logistics_provider)) {
    sections.push({
      title: "Logistics",
      items: [
        { href: "/dashboard/logistics", label: "Provider overview" },
        { href: "/dashboard/logistics/services", label: "My services" },
        { href: "/dashboard/bookings?view=provider", label: "Booking requests" },
      ],
    });
  }
  if (sells || roles.includes("logistics_provider") || businesses.length > 0) {
    sections.push({ title: "Business", items: [{ href: "/dashboard/business", label: "Business profile & verification" }] });
  }
  if (roles.includes("admin")) {
    sections.push({
      title: "Administration",
      items: [
        { href: "/dashboard/admin", label: "Operations overview" },
        { href: "/dashboard/admin/businesses", label: "Verification queue" },
        { href: "/dashboard/admin/listings", label: "Listing moderation" },
        { href: "/dashboard/admin/reports", label: "Reports & support" },
        { href: "/dashboard/admin/disputes", label: "Disputes" },
        { href: "/dashboard/admin/orders", label: "Orders" },
        { href: "/dashboard/admin/users", label: "Users & roles" },
        { href: "/dashboard/admin/categories", label: "Categories" },
        { href: "/dashboard/admin/settings", label: "Platform settings" },
        { href: "/dashboard/admin/audit", label: "Audit log" },
      ],
    });
  }
  if (roles.includes("agency_analyst") || roles.includes("admin")) {
    sections.push({ title: "Insights", items: [{ href: "/dashboard/analytics", label: "Blue economy analytics" }] });
  }
  return sections;
}

export function isManager(role: MembershipRole | undefined): boolean {
  return role === "owner" || role === "manager";
}

/**
 * Generic transitions (via transition_order) this actor can trigger from the UI.
 * Seller staff can fulfil; only managers reject/cancel.
 */
export function uiOrderActions(status: OrderStatus, actor: OrderActor | null, membership?: MembershipRole): OrderStatus[] {
  if (!actor) return [];
  return allowedNextStatuses(status, actor).filter((to) => {
    if (DEDICATED_ACTIONS.includes(to)) return false;
    if (actor === "seller" && (to === "rejected" || to === "cancelled")) return isManager(membership);
    return true;
  });
}
