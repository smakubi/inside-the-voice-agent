import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/app-shell";

describe("AppShell", () => {
  it("switches between five-stage cascaded and three-stage realtime pipelines", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    expect(screen.getAllByTestId("pipeline-stage")).toHaveLength(5);
    await user.click(screen.getByRole("radio", { name: /Speech-to-speech/ }));
    expect(await screen.findByText("Realtime Model")).toBeInTheDocument();
    expect(screen.getAllByTestId("pipeline-stage")).toHaveLength(3);
  });

  it("updates the conversation context", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await user.selectOptions(screen.getByLabelText("Conversation context"), "language-tutoring");
    expect(screen.getByLabelText("Conversation context")).toHaveValue("language-tutoring");
  });

  it("reveals the text fallback", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await user.click(screen.getByRole("button", { name: "Prefer to type?" }));
    expect(screen.getByLabelText("Message the voice agent")).toBeInTheDocument();
  });

  it("makes the live recording action prominent", () => {
    render(<AppShell />);
    expect(screen.getByRole("button", { name: "Start recording" })).toBeInTheDocument();
    expect(screen.getByText(/AI-generated/)).toBeInTheDocument();
  });
});
