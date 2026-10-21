import { expect, test } from "@playwright/test";
import { signIn, signOut, USERS } from "./helpers";

/**
 * End-to-end order journey against a LOCAL or TEST Supabase project loaded
 * with supabase/seed.sql. Never run against production.
 */
test.describe.serial("buyer ↔ supplier order journey", () => {
  let orderUrl = "";

  test("sign-in validation shows errors", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await page.getByLabel("Email").fill("buyer@example.test");
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
  });

  test("buyer adds a listing to the cart and sends an order request", async ({ page }) => {
    await signIn(page, USERS.buyer);
    await page.goto("/products/b3333333-3333-4333-8333-333333333333");
    await page.getByLabel(/Quantity \(kg\)/).fill("5");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText(/Minimum order is 20/)).toBeVisible();
    await page.getByLabel(/Quantity \(kg\)/).fill("25");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await page.getByRole("link", { name: "Go to cart" }).click();

    await expect(page.getByText(/Order from Lagoon Fresh/)).toBeVisible();
    await page.getByRole("button", { name: "Send order request" }).click();
    await expect(page).toHaveURL(/\/dashboard\/orders\/[0-9a-f-]{36}\?placed=1/);
    await expect(page.getByText("Requested").first()).toBeVisible();
    orderUrl = page.url().split("?")[0]!;
    await signOut(page);
  });

  test("another buyer cannot open the order", async ({ page }) => {
    await signIn(page, USERS.buyer2);
    const res = await page.goto(orderUrl);
    expect(res?.status()).toBe(404);
    await signOut(page);
  });

  test("supplier accepts with a delivery fee", async ({ page }) => {
    await signIn(page, USERS.farmer);
    await page.goto(orderUrl);
    await page.getByLabel("Delivery fee (₦)").fill("1500");
    await page.getByRole("button", { name: "Accept order" }).click();
    await expect(page.getByText("Order accepted.")).toBeVisible();
    await signOut(page);
  });

  test("buyer confirms totals and pays in sandbox (clearly labelled)", async ({ page }) => {
    await signIn(page, USERS.buyer);
    await page.goto(orderUrl);
    await page.getByRole("button", { name: "Confirm totals and proceed to payment" }).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Simulate payment (sandbox)" }).click();
    await expect(page.getByText("Sandbox — not a real payment").first()).toBeVisible();
    await signOut(page);
  });

  test("supplier fulfils, buyer confirms and reviews", async ({ page }) => {
    await signIn(page, USERS.farmer);
    await page.goto(orderUrl);
    await page.getByRole("button", { name: "Mark as preparing" }).click();
    await page.getByRole("button", { name: "Mark as dispatched" }).click();
    await expect(page.getByText("Dispatched").first()).toBeVisible();
    await signOut(page);

    await signIn(page, USERS.buyer);
    await page.goto(orderUrl);
    await page.getByRole("button", { name: "I have received this order" }).click();
    await page.getByRole("button", { name: "Confirm order complete" }).click();
    await expect(page.getByRole("heading", { name: "Rate this supplier" })).toBeVisible();
    await page.getByLabel("Rating").selectOption("5");
    await page.getByRole("button", { name: "Submit review" }).click();
    await expect(page.getByText("Thank you for your review.")).toBeVisible();
  });
});

test.describe("role isolation", () => {
  test("buyers cannot open admin or analytics pages", async ({ page }) => {
    await signIn(page, USERS.buyer);
    await page.goto("/dashboard/admin");
    await expect(page).toHaveURL(/denied=admin/);
    await page.goto("/dashboard/analytics");
    await expect(page).toHaveURL(/denied=analytics/);
  });

  test("admin CSV export is forbidden to non-admins", async ({ page }) => {
    await signIn(page, USERS.supplier);
    const res = await page.request.get("/api/admin/export/orders");
    expect(res.status()).toBe(403);
  });

  test("analyst sees aggregated analytics only", async ({ page }) => {
    await signIn(page, USERS.analyst);
    await page.goto("/dashboard/analytics");
    await expect(page.getByRole("heading", { name: "Blue economy analytics" })).toBeVisible();
    await expect(page.getByText(/GMV/).first()).toBeVisible();
    await page.goto("/dashboard/admin/users");
    await expect(page).toHaveURL(/denied=admin/);
  });

  test("admin sees the verification queue and operations overview", async ({ page }) => {
    await signIn(page, USERS.admin);
    await page.goto("/dashboard/admin");
    await expect(page.getByText("Marketplace revenue").first()).toBeVisible();
    await page.goto("/dashboard/admin/businesses");
    await expect(page.getByRole("heading", { name: "Businesses & verification" })).toBeVisible();
  });
});
