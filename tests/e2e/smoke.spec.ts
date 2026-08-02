import { expect, test } from "@playwright/test";

test("voice interface supports its core exploration flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Voice Agent Demo" })).toBeVisible();
  await expect(page.locator('link[rel="icon"][href="/icon.svg"]')).toHaveCount(1);
  await expect(page.getByTestId("pipeline-stage")).toHaveCount(5);
  await page.getByRole("radio", { name: /Speech-to-speech/ }).click();
  await expect(page.getByTestId("pipeline-stage")).toHaveCount(3);
  await page.getByRole("button", { name: "Prefer to type?" }).click();
  await expect(page.getByLabel("Message the voice agent")).toBeVisible();
  await page.getByRole("link", { name: "Providers" }).click();
  await expect(page.getByRole("heading", { name: "Voice AI provider landscape" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Native speech-to-speech providers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cascaded and hybrid platforms" })).toBeVisible();
});
