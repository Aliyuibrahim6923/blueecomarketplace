import { expect, type Page } from "@playwright/test";

/** Fictional accounts from supabase/seed.sql (local / test projects only). */
export const DEMO_PASSWORD = "BlueMarket-Dev-2026!";
export const USERS = {
  admin: "admin@example.test",
  analyst: "analyst@example.test",
  supplier: "supplier@example.test",
  farmer: "farmer@example.test",
  logistics: "logistics@example.test",
  buyer: "buyer@example.test",
  buyer2: "buyer2@example.test",
} as const;

export async function signIn(page: Page, email: string, next = "/dashboard") {
  await page.goto(`/auth/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(next.replace(/[?]/g, "\\?")));
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
}
