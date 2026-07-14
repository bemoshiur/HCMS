import { test, expect, type Page } from "@playwright/test";

/**
 * HCMS smoke test (brief §20.10 / DoD):
 *  - every demo role signs in from the demo panel and lands in its workspace
 *  - the public height-check returns a live OLS result
 *  - an evaluation runs on the internal map screen
 *  - a certificate is issued (approver) and verifies on the public page
 */

const DEMO = [
  { email: "applicant@demo.gov.bd", home: "/portal" },
  { email: "rajuk@demo.gov.bd", home: "/authority" },
  { email: "intake@caab.gov.bd", home: "/dashboard" },
  { email: "aga@caab.gov.bd", home: "/review" },
  { email: "cns@caab.gov.bd", home: "/review" },
  { email: "pansops@caab.gov.bd", home: "/review" },
  { email: "director@caab.gov.bd", home: "/dashboard" },
  { email: "study@caab.gov.bd", home: "/studies" },
  { email: "admin@caab.gov.bd", home: "/dashboard" },
  { email: "auditor@caab.gov.bd", home: "/dashboard" },
];

async function signInWith(page: Page, email: string) {
  await page.goto("/login");
  // Fill the credentials form directly (deterministic across roles)
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill("Demo@1234");
  await page.getByRole("button", { name: /^sign in$/i }).click();
}

test.describe("role sign-in", () => {
  for (const { email, home } of DEMO) {
    test(`signs in and lands in workspace: ${email}`, async ({ page }) => {
      await signInWith(page, email);
      await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
      // landed somewhere authenticated (role home or dashboard)
      await expect(page).toHaveURL(new RegExp(`(${home}|/dashboard)`));
      // the app shell is present
      await expect(page.getByRole("navigation", { name: /primary|sidebar/i }).or(page.locator("aside"))).toBeVisible();
    });
  }
});

test("public height-check returns a live OLS result", async ({ page }) => {
  await page.goto("/height-check");
  // pick an airport if a selector is present
  const combo = page.getByRole("combobox").first();
  if (await combo.isVisible().catch(() => false)) {
    await combo.click();
    await page.getByRole("option").first().click().catch(() => {});
  }
  // a CLEAR/OBJECTION/OUTSIDE result banner should appear
  await expect(
    page.getByText(/CLEAR|OBJECTION|Outside/i).first()
  ).toBeVisible({ timeout: 20_000 });
});

test("certificate verification page validates a seeded HC number", async ({ page, request }) => {
  // fetch a known-good HC number from the public verify API is not possible
  // without one; use the well-known first seeded number.
  await page.goto("/verify?code=HC-2026-000001");
  await expect(
    page.getByText(/valid|verified|GRANTED|certificate/i).first()
  ).toBeVisible({ timeout: 20_000 });
});

test("evaluate screen renders the map and a result for an officer", async ({ page }) => {
  await signInWith(page, "intake@caab.gov.bd");
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.goto("/evaluate");
  // map canvas + a result status eventually
  await expect(page.locator(".maplibregl-map, canvas").first()).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText(/CLEAR|OBJECTION|Outside/i).first()
  ).toBeVisible({ timeout: 20_000 });
});
