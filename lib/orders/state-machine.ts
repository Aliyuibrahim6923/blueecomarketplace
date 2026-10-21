import matrix from "./order-transitions.json";

export const ORDER_STATUSES = [
  "draft",
  "requested",
  "accepted",
  "rejected",
  "awaiting_payment",
  "paid",
  "preparing",
  "dispatched",
  "delivered",
  "completed",
  "cancelled",
  "disputed",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderActor = "buyer" | "seller" | "admin" | "system";

type Transition = readonly [OrderStatus, OrderStatus, OrderActor];

const TRANSITIONS = matrix.transitions as unknown as Transition[];

/** Same rule set as public.order_transition_allowed() in SQL. */
export function canTransition(from: OrderStatus, to: OrderStatus, actor: OrderActor): boolean {
  return TRANSITIONS.some(([f, t, a]) => f === from && t === to && a === actor);
}

export function allowedNextStatuses(from: OrderStatus, actor: OrderActor): OrderStatus[] {
  return TRANSITIONS.filter(([f, , a]) => f === from && a === actor).map(([, t]) => t);
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Draft",
  requested: "Requested",
  accepted: "Accepted",
  rejected: "Rejected",
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  preparing: "Preparing",
  dispatched: "Dispatched",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  disputed: "Disputed",
  refunded: "Refunded",
};

/** The happy path shown as a progress timeline. */
export const ORDER_HAPPY_PATH: OrderStatus[] = [
  "requested",
  "accepted",
  "awaiting_payment",
  "paid",
  "preparing",
  "dispatched",
  "delivered",
  "completed",
];

export const TERMINAL_STATUSES: OrderStatus[] = ["completed", "cancelled", "rejected", "refunded"];

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export function orderStatusTone(status: OrderStatus): StatusTone {
  switch (status) {
    case "completed":
    case "delivered":
    case "paid":
      return "success";
    case "rejected":
    case "cancelled":
    case "refunded":
      return "danger";
    case "disputed":
    case "awaiting_payment":
      return "warning";
    case "draft":
      return "neutral";
    default:
      return "info";
  }
}

/** Actions that need a dedicated RPC (not transition_order). */
export const DEDICATED_ACTIONS: OrderStatus[] = ["accepted", "paid", "disputed"];

/** Transitions that require a written reason. */
export function requiresReason(to: OrderStatus): boolean {
  return to === "rejected" || to === "cancelled" || to === "refunded";
}

/** Button label for an action the current user can take. */
export function actionLabel(to: OrderStatus, actor: OrderActor): string {
  switch (to) {
    case "requested":
      return "Submit order request";
    case "awaiting_payment":
      return "Confirm totals and proceed to payment";
    case "preparing":
      return "Mark as preparing";
    case "dispatched":
      return "Mark as dispatched";
    case "delivered":
      return actor === "buyer" ? "I have received this order" : "Mark as delivered";
    case "completed":
      return "Confirm order complete";
    case "rejected":
      return "Decline order";
    case "cancelled":
      return "Cancel order";
    case "refunded":
      return "Mark refunded";
    default:
      return ORDER_STATUS_LABEL[to];
  }
}
