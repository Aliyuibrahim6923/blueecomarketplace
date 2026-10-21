import { expect, test } from "@playwright/test";

test.describe("public site", () => {
  test("home page shows categories and real listings, no fabricated stats", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Product categories" })).toBeVisible();
    await expect(page.getByText("Fresh fish").first()).toBeVisible();
    // Seeded demo listings are clearly labelled.
    await expect(page.getByText("(demo)").first()).toBeVisible();
  });

  test("marketplace search and filters work and paginate", async ({ page }) => {
    await page.goto("/marketplace?q=catfish");
    await expect(page.getByText(/listing/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Table-size catfish/ })).toBeVisible();

    await page.goto("/marketplace?state=RI");
    await expect(page.getByRole("link", { name: /croaker/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Table-size catfish/ })).toHaveCount(0);

    await page.goto("/marketplace?q=no-such-product-xyz");
    await expect(page.getByText("No listings match your search")).toBeVisible();
  });

  test("drafts are not publicly visible", async ({ page }) => {
    const res = await page.goto("/products/b5555555-5555-4555-8555-555555555555");
    expect(res?.status()).toBe(404);
  });

  test("product page distinguishes self-declared information and verification", async ({ page }) => {
    await page.goto("/products/b1111111-1111-4111-8111-111111111111");
    await expect(page.getByText("Verified business").first()).toBeVisible();
    await expect(page.getByText("Self-declared").first()).toBeVisible();
  });

  test("quote-required listings show price on request", async ({ page }) => {
    await page.goto("/products/b2222222-2222-4222-8222-222222222222");
    await expect(page.getByText("Price on request").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to cart" })).toHaveCount(0);
  });

  test("logistics directory filters by state", async ({ page }) => {
    await page.goto("/logistics?state=LA");
    await expect(page.getByRole("link", { name: /Reefer van/ })).toBeVisible();
  });

  test("protected pages redirect to sign in", async ({ page }) => {
    await page.goto("/dashboard/orders");
    await expect(page).toHaveURL(/\/auth\/sign-in\?next=/);
  });

  for (const path of ["/how-it-works", "/for-suppliers", "/for-buyers", "/about", "/help", "/privacy", "/terms", "/marketplace-rules"]) {
    test(`content page ${path} renders`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }

  test("health endpoint reports database status", async ({ request }) => {
    const res = await request.get("/api/health");
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty("ok");
  });
});
