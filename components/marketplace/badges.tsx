import { Badge } from "@/components/ui/primitives";
import { CheckBadgeIcon } from "@/components/icons";
import { ORDER_STATUS_LABEL, orderStatusTone, type OrderStatus } from "@/lib/orders/state-machine";
import { humanize } from "@/lib/utils";
import type { VerificationStatus } from "@/types/domain";

const VERIFICATION: Record<VerificationStatus, { label: string; tone: "success" | "neutral" | "warning" | "danger"; title: string }> = {
  verified: {
    label: "Verified business",
    tone: "success",
    title: "Reviewed by the BlueMarket operations team. Not a government endorsement or product-safety guarantee.",
  },
  pending_review: { label: "Verification pending", tone: "warning", title: "Documents submitted, review not finished." },
  unverified: { label: "Unverified", tone: "neutral", title: "Details are self-declared and have not been reviewed." },
  rejected: { label: "Not verified", tone: "neutral", title: "Verification was not approved." },
  suspended: { label: "Suspended", tone: "danger", title: "This business is suspended." },
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const v = VERIFICATION[status];
  return (
    <Badge tone={v.tone} title={v.title}>
      {status === "verified" ? <CheckBadgeIcon width={14} height={14} /> : null}
      {v.label}
    </Badge>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={orderStatusTone(status)}>{ORDER_STATUS_LABEL[status]}</Badge>;
}

export function GenericStatusBadge({ status }: { status: string }) {
  const tone =
    status === "published" || status === "completed" || status === "resolved" || status === "approved" || status === "confirmed"
      ? "success"
      : status === "hidden" || status === "rejected" || status === "declined" || status === "cancelled" || status === "failed"
        ? "danger"
        : status === "draft" || status === "archived" || status === "closed" || status === "expired"
          ? "neutral"
          : status === "paused" || status === "pending_review" || status === "awaiting_evidence" || status === "quoted"
            ? "warning"
            : "info";
  return <Badge tone={tone}>{humanize(status)}</Badge>;
}

/** Marks information the seller entered themselves (PRD §6.8). */
export function SelfDeclared() {
  return (
    <Badge tone="neutral" title="Entered by the seller. Not checked by BlueMarket.">
      Self-declared
    </Badge>
  );
}

export function SandboxBadge() {
  return (
    <Badge tone="warning" title="Simulated payment for testing. No money moved.">
      Sandbox — not a real payment
    </Badge>
  );
}
