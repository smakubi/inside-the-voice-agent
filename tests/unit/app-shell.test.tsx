import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/app-shell";

describe("AppShell", () => {
  it("switches between five-stage cascaded and three-stage realtime pipelines", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    expect(screen.getAllByTestId("pipeline-stage")).toHaveLength(5);
    await user.click(screen.getByRole("radio", { name: "Speech-to-Speech" }));
    expect(await screen.findByText("Realtime Model")).toBeInTheDocument();
    expect(screen.getAllByTestId("pipeline-stage")).toHaveLength(3);
  });

  it("updates the teaching prompt when a scenario is selected", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await user.selectOptions(screen.getByLabelText("Choose a demonstration scenario"), "language-tutoring");
    expect(screen.getByText(/ordering coffee in Spanish/i)).toBeInTheDocument();
  });

  it("opens and closes the inspector", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await user.click(screen.getByRole("switch", { name: "Inspector" }));
    expect(screen.getByRole("complementary", { name: "Run inspector" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close inspector" }));
    expect(screen.queryByRole("complementary", { name: "Run inspector" })).not.toBeInTheDocument();
  });

  it("toggles lecture and developer modes without simulating a run", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    const lecture = screen.getByRole("switch", { name: "Lecture Mode" });
    await user.click(lecture);
    expect(lecture).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("switch", { name: "Developer Mode" }));
    expect(screen.getByRole("region", { name: "Developer event log" })).toHaveTextContent("No events yet");
    await user.click(screen.getByRole("button", { name: "Start Demo" }));
    expect(screen.getByText(/Static preview only/)).toBeInTheDocument();
  });
});
