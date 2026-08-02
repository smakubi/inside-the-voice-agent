import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

afterEach(() => vi.unstubAllGlobals());

describe("AppShell", () => {
  it("switches between five-stage cascaded and three-stage realtime pipelines", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    expect(screen.getAllByTestId("pipeline-stage")).toHaveLength(5);
    expect(screen.getByText(/gpt-transcribe/)).toBeInTheDocument();
    expect(screen.getByText(/zai-org\/GLM-4.7/)).toBeInTheDocument();
    expect(screen.getByText(/gpt-4o-mini-tts/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Speech-to-speech/ }));
    expect(await screen.findByText("Realtime Model")).toBeInTheDocument();
    expect(screen.getByText(/gpt-realtime-2.1/)).toBeInTheDocument();
    expect(screen.getByText("Live stack")).toBeInTheDocument();
    expect(screen.getAllByTestId("pipeline-stage")).toHaveLength(3);
  });

  it("opens a Python example for each pipeline stage", async () => {
    const user = userEvent.setup();
    render(<AppShell />);
    await user.click(screen.getByRole("button", { name: "View Python code for Speech-to-Text" }));
    expect(screen.getByRole("complementary", { name: "Python code inspector" })).toBeInTheDocument();
    expect(screen.getByText("Transcribe speech")).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === "CODE" && Boolean(element.textContent?.includes("client.audio.transcriptions.create")))).toBeInTheDocument();
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

  it("sends earlier turns as conversation memory", async () => {
    const responseRequests: Array<{ history: Array<{ role: string; content: string }> }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (input === "/api/respond") {
        responseRequests.push(JSON.parse(String(init?.body)) as typeof responseRequests[number]);
        return Response.json({ text: `Answer ${responseRequests.length}` });
      }
      return new Response(new Blob(["audio"], { type: "audio/mpeg" }));
    }));
    const NativeURL = URL;
    vi.stubGlobal("URL", class extends NativeURL {
      static createObjectURL() { return "blob:test"; }
      static revokeObjectURL() {}
    });
    vi.stubGlobal("Audio", class {
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      pause() {}
      async play() { queueMicrotask(() => this.onended?.()); }
    });

    const user = userEvent.setup();
    render(<AppShell />);
    await user.click(screen.getByRole("button", { name: "Prefer to type?" }));
    const input = screen.getByLabelText("Message the voice agent");
    await user.type(input, "My name is Ada");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("Answer 1");
    await waitFor(() => expect(screen.getByText(/Start a conversation/)).toBeInTheDocument());
    await user.type(input, "What is my name?");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("Answer 2");

    expect(responseRequests[1].history).toEqual([
      { role: "user", content: "My name is Ada" },
      { role: "assistant", content: "Answer 1" },
    ]);
    expect(screen.getAllByText(/\d+ ms/).length).toBeGreaterThanOrEqual(3);
  });

  it("makes the live recording action prominent", () => {
    render(<AppShell />);
    expect(screen.getByRole("button", { name: "Start conversation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New conversation" })).toBeInTheDocument();
    expect(screen.getByText(/AI-generated/)).toBeInTheDocument();
  });
});
