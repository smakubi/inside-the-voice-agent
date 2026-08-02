import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProvidersPage from "@/app/providers/page";

describe("ProvidersPage", () => {
  it("shows native and cascaded provider groups with official links", () => {
    render(<ProvidersPage />);
    expect(screen.getByRole("heading", { name: "Native speech-to-speech providers" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cascaded and hybrid platforms" })).toBeInTheDocument();
    expect(screen.getByText("GPT-Realtime 2.1")).toBeInTheDocument();
    expect(screen.getByText("Voice AI framework")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Read .* documentation/ }).length).toBeGreaterThan(5);
  });
});
