import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendFeedbackAction } = vi.hoisted(() => ({ sendFeedbackAction: vi.fn() }));
vi.mock("./actions", () => ({ sendFeedbackAction }));

import { HelpSection } from "../HelpSection";
import { FeedbackForm } from "./FeedbackForm";
import { FeedbackList } from "./FeedbackList";

beforeEach(() => {
  sendFeedbackAction.mockReset().mockResolvedValue({ ok: true });
  document.documentElement.dataset.theme = "dark";
  window.matchMedia = vi.fn((query: string) => ({ matches: query === "(min-width: 768px)" }) as MediaQueryList);
});

const message = () => screen.getByRole("textbox", { name: /What went wrong|What's your idea/ });
const typeMessage = (text: string) => fireEvent.change(message(), { target: { value: text } });

describe("HelpSection", () => {
  it("links to the form for a bug and for an idea", () => {
    render(<HelpSection />);
    expect(screen.getByRole("heading", { name: "Help & feedback" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Report a bug/ })).toHaveAttribute("href", "/settings/feedback?kind=bug");
    expect(screen.getByRole("link", { name: /Share an idea/ })).toHaveAttribute("href", "/settings/feedback?kind=idea");
  });
});

describe("FeedbackForm", () => {
  it("for a bug: preselects Bug, and offers device details (on) with what they include", () => {
    render(<FeedbackForm initialKind="bug" from="/budget" />);
    expect(screen.getByRole("radio", { name: "Bug" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "Include device details" })).toBeChecked();
    const included = screen.getByText(/^Adds the page you came from/);
    expect(included).toHaveTextContent(
      "Adds the page you came from (/budget), phone or desktop, your browser, theme, time zone and app version. Never your expenses or amounts.",
    );
  });

  it("for an idea: no device details", () => {
    render(<FeedbackForm initialKind="idea" from="/budget" />);
    expect(screen.getByRole("radio", { name: "Idea" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("checkbox", { name: "Include device details" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Adds the page you came from/)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "What's your idea?" })).toBeInTheDocument();
  });

  it("switching to Idea hides the device details", () => {
    render(<FeedbackForm initialKind="bug" from={null} />);
    expect(screen.getByText(/^Adds the page you came from/)).not.toHaveTextContent("(");
    fireEvent.click(screen.getByRole("radio", { name: "Idea" }));
    expect(screen.queryByRole("checkbox", { name: "Include device details" })).not.toBeInTheDocument();
  });

  it("checks the message before sending", async () => {
    render(<FeedbackForm initialKind="bug" from={null} />);
    typeMessage("   short   ");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    });
    expect(sendFeedbackAction).not.toHaveBeenCalled();
    expect(message()).toHaveFocus();
    expect(message()).toHaveAccessibleDescription("Tell us a little more: at least 10 characters.");
  });

  it("sends a bug with this device's details, then thanks you", async () => {
    render(<FeedbackForm initialKind="bug" from="/budget" />);
    typeMessage("The export button does nothing.");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    });
    expect(sendFeedbackAction).toHaveBeenCalledWith({
      kind: "bug",
      message: "The export button does nothing.",
      includeDevice: true,
      device: {
        from: "/budget",
        viewport: "desktop",
        browser: navigator.userAgent,
        theme: "dark",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
    const thanks = screen.getByRole("status");
    expect(within(thanks).getByRole("heading", { name: "Thanks — we’ve got it." })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send another" }));
    expect(message()).toHaveValue("");
  });

  it("sends no device details when unticked", async () => {
    render(<FeedbackForm initialKind="bug" from="/budget" />);
    typeMessage("The export button does nothing.");
    fireEvent.click(screen.getByRole("checkbox", { name: "Include device details" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    });
    expect(sendFeedbackAction).toHaveBeenCalledWith({
      kind: "bug",
      message: "The export button does nothing.",
      includeDevice: false,
    });
  });

  it("shows the server's refusal and keeps the message", async () => {
    sendFeedbackAction.mockResolvedValue({ error: "You've sent 20 messages today, the most we take in a day. Please try again tomorrow." });
    render(<FeedbackForm initialKind="idea" from={null} />);
    typeMessage("Let me pin a category.");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send idea" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("You've sent 20 messages today");
    expect(message()).toHaveValue("Let me pin a category.");
  });
});

describe("FeedbackList", () => {
  it("lists what was sent with kind, first line, date and status label", () => {
    render(
      <FeedbackList
        items={[
          { id: "3", kind: "idea", firstLine: "Pin a category", status: "done", sentOn: "2026-11-21" },
          { id: "2", kind: "bug", firstLine: "Export does nothing", status: "triaged", sentOn: "2026-11-10" },
          { id: "1", kind: "bug", firstLine: "Calendar skips a day", status: "new", sentOn: "2026-11-02" },
        ]}
      />,
    );
    const rows = screen.getAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      "IdeaPin a category21 Nov 2026Done",
      "BugExport does nothing10 Nov 2026Seen",
      "BugCalendar skips a day2 Nov 2026New",
    ]);
  });

  it("says when nothing has been sent", () => {
    render(<FeedbackList items={[]} />);
    expect(screen.getByText("Nothing sent yet.")).toBeInTheDocument();
  });
});
