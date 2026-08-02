import { expect, test } from "@playwright/test";

test("teaching interface supports the core static flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Inside the Voice Agent" })).toBeVisible();
  await expect(page.getByTestId("pipeline-stage")).toHaveCount(5);
  await page.getByRole("radio", { name: "Speech-to-Speech" }).click();
  await expect(page.getByTestId("pipeline-stage")).toHaveCount(3);
  await page.getByRole("switch", { name: "Inspector" }).click();
  await expect(page.getByRole("complementary", { name: "Run inspector" })).toBeVisible();
});
