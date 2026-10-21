import { describe, expect, it } from "vitest";
import { allowedNextStatuses, canTransition, ORDER_STATUSES, requiresReason } from "@/lib/orders/state-machine";
import { uiOrderActions } from "@/lib/permissions";

describe("order state machine", () => {
  it("allows the happy path with the right actors", () => {
    const path: [string, string, string][] = [
      ["requested", "accepted", "seller"],
      ["accepted", "awaiting_payment", "buyer"],
      ["awaiting_payment", "paid", "system"],
      ["paid", "preparing", "seller"],
      ["preparing", "dispatched", "seller"],
      ["dispatched", "delivered", "buyer"],
      ["delivered", "completed", "buyer"],
    ];
    for (const [from, to, actor] of path) {
      expect(canTransition(from as never, to as never, actor as never)).toBe(true);
    }
  });

  it("blocks skipping steps and wrong actors", () => {
    expect(canTransition("requested", "completed", "buyer")).toBe(false);
    expect(canTransition("requested", "accepted", "buyer")).toBe(false);
    expect(canTransition("awaiting_payment", "paid", "buyer")).toBe(false);
    expect(canTransition("paid", "cancelled", "buyer")).toBe(false);
    expect(canTransition("completed", "cancelled", "admin")).toBe(false);
  });

  it("has no transitions out of final states except via dispute resolution", () => {
    for (const status of ["completed", "cancelled", "rejected", "refunded"] as const) {
      for (const actor of ["buyer", "seller", "admin", "system"] as const) {
        expect(allowedNextStatuses(status, actor)).toEqual([]);
      }
    }
  });

  it("only knows real statuses", () => {
    expect(ORDER_STATUSES).toContain("awaiting_payment");
    expect(ORDER_STATUSES).toHaveLength(13);
  });

  it("requires reasons for rejection, cancellation and refunds", () => {
    expect(requiresReason("rejected")).toBe(true);
    expect(requiresReason("cancelled")).toBe(true);
    expect(requiresReason("refunded")).toBe(true);
    expect(requiresReason("dispatched")).toBe(false);
  });
});

describe("UI order actions", () => {
  it("hides dedicated actions (accept, pay, dispute) from the generic buttons", () => {
    expect(uiOrderActions("requested", "seller", "owner")).toEqual(["rejected"]);
    expect(uiOrderActions("paid", "buyer")).toEqual([]);
  });
  it("lets only managers reject or cancel as seller", () => {
    expect(uiOrderActions("requested", "seller", "staff")).toEqual([]);
    expect(uiOrderActions("accepted", "seller", "staff")).toEqual([]);
    expect(uiOrderActions("accepted", "seller", "manager")).toEqual(["cancelled"]);
  });
  it("gives nothing to non-participants", () => {
    expect(uiOrderActions("requested", null)).toEqual([]);
  });
});
