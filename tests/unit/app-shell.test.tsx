import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppShell } from "@/components/app-shell";

describe("AppShell", () => {
  it("switches between five-stage cascaded and three-stage realtime pipelines", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    expect(screen.getAllByTestId("pipeline-stage")).toHaveLength(5);
    expect(screen.getByText(/gpt-transcribe/)).toBeInTheDocument();
    expect(screen.getByText(/gpt-5.6-luna/)).toBeInTheDocument();
    expect(screen.getByText(/gpt-4o-mini-tts/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Speech-to-speech/ }));
    expect(await screen.findByText("Realtime Model")).toBeInTheDocument();
    expect(screen.getByText(/gpt-realtime-1.5/)).toBeInTheDocument();
    expect(screen.getByText("Live stack")).toBeInTheDocument();
    expect(screen.getAllByTestId("pipeline-stage")).toHaveLength(3);
  });

  it("opens a Python example for each pipeline stage", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await user.click(screen.getByRole("button", { name: "View Python code for Speech-to-Text" }));
    expect(screen.getByRole("complementary", { name: "Python code inspector" })).toBeInTheDocument();
    expect(screen.getByText("Transcribe speech")).toBeInTheDocument();
    expect(screen.getByText(/client.audio.transcriptions.create/)).toBeInTheDocument();
  });

  it("keeps the pipeline beside the conversation workspace", () => {
    render(<AppShell />);
    expect(screen.getByRole("complementary", { name: "Live architecture view" })).toBeInTheDocument();
    expect(screen.queryByText("Conversation context")).not.toBeInTheDocument();
  });

  it("reveals the text fallback", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await user.click(screen.getByRole("button", { name: "Prefer to type?" }));
    expect(screen.getByLabelText("Message the voice agent")).toBeInTheDocument();
  });

  it("makes the live recording action prominent", () => {
    render(<AppShell />);
    expect(screen.getByRole("button", { name: "Start conversation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New conversation" })).toBeInTheDocument();
    expect(screen.getByText(/AI-generated/)).toBeInTheDocument();
  });
});
