import { expect, test } from "@playwright/test";

test("voice interface supports its core exploration flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Voice Agent Demo" })).toBeVisible();
  await expect(page.getByTestId("pipeline-stage")).toHaveCount(5);
  await page.getByRole("radio", { name: /Speech-to-speech/ }).click();
  await expect(page.getByTestId("pipeline-stage")).toHaveCount(3);
  await page.getByRole("button", { name: "Prefer to type?" }).click();
  await expect(page.getByLabel("Message the voice agent")).toBeVisible();
});
