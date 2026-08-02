import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ArchitectureExplorer } from "@/components/architecture-explorer";

describe("ArchitectureExplorer", () => {
  it("walks through cascaded components and switches architectures", async () => {
    const user = userEvent.setup();
    render(<ArchitectureExplorer />);

    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
    expect(screen.getByText("Capture user audio")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next component" }));
    expect(screen.getByText("Transcribe speech")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Speech-to-speech/ }));
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Speech-to-speech execution flow")).toBeInTheDocument();
  });
});
