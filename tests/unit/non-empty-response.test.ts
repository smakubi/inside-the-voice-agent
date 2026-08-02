import { describe, expect, it, vi } from "vitest";
import { generateNonEmptyResponse } from "@/lib/non-empty-response";

describe("generateNonEmptyResponse", () => {
  it("retries an empty model result once", async () => {
    const generate = vi.fn().mockResolvedValueOnce("  ").mockResolvedValueOnce("Answer");

    await expect(generateNonEmptyResponse(generate)).resolves.toBe("Answer");
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("fails after both attempts return empty", async () => {
    const generate = vi.fn().mockResolvedValue("");

    await expect(generateNonEmptyResponse(generate)).rejects.toThrow("empty response");
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
