"use client";

import { useI18n } from "@/i18n/client";
import { useRef, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { Button, ButtonLink, Checkbox, Notice, RadioSegments, TextField } from "@/components/ui";
import { lastPage } from "@/lib/lastPage";
import { checkMessage, type DeviceDetails, type FeedbackKindInput } from "@/lib/validation/feedback";
import { sendFeedbackAction } from "./actions";


const noSubscribe = () => () => {};
const noPage = () => null;

/** This device's details, read when sending (never any financial data). */
function deviceDetails(from: string | null): DeviceDetails {
  const theme = document.documentElement.dataset.theme;
  return {
    from,
    viewport: window.matchMedia("(min-width: 768px)").matches ? "desktop" : "phone",
    browser: navigator.userAgent,
    theme: theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/**
 * Report a bug or share an idea. A bug can include device details (on by
 * default), and the line under the box says exactly what they are. Sent,
 * the form gives way to a thank-you; "What you've sent" refreshes from the server.
 */
export function FeedbackForm({ initialKind, from: givenFrom }: { initialKind: FeedbackKindInput; from: string | null }) {
  const i18n = useI18n();
  const f = i18n.m.feedback;
  // The page to report: ?from= when given, else the last page outside Settings this tab
  // visited (none on the server, where there's no sessionStorage).
  const remembered = useSyncExternalStore(noSubscribe, lastPage, noPage);
  const from = givenFrom ?? remembered;
  const [kind, setKind] = useState<FeedbackKindInput>(initialKind);
  const [message, setMessage] = useState("");
  const [includeDevice, setIncludeDevice] = useState(true);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const thanksRef = useRef<HTMLHeadingElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const bug = kind === "bug";

  function submit(e: FormEvent) {
    e.preventDefault();
    const problem = checkMessage(message, i18n);
    setMessageError(problem);
    setError(null);
    if (problem) {
      messageRef.current?.focus();
      return;
    }
    const input = bug && includeDevice ? { kind, message, includeDevice: true, device: deviceDetails(from) } : { kind, message, includeDevice: false };
    startTransition(async () => {
      const result = await sendFeedbackAction(input);
      if ("error" in result) {
        if (result.field === "message") {
          setMessageError(result.error);
          messageRef.current?.focus();
        } else setError(result.error);
        return;
      }
      setSent(true);
      requestAnimationFrame(() => thanksRef.current?.focus());
    });
  }

  function again() {
    setMessage("");
    setMessageError(null);
    setError(null);
    setSent(false);
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <h2 ref={thanksRef} tabIndex={-1} className="text-title font-semibold text-text outline-none">
          {f.thanks}
        </h2>
        <p className="text-body text-muted">{f.followIt}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="primary" onClick={again}>
            {f.sendAnother}
          </Button>
          <ButtonLink href="/settings" variant="secondary">
            {f.backToSettings}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span aria-hidden="true" className="text-caption font-medium text-muted">
          {f.type}
        </span>
        <RadioSegments label={f.type} options={[{ value: "bug" as const, label: f.kinds.bug }, { value: "idea" as const, label: f.kinds.idea }]} value={kind} onChange={setKind} />
      </div>
      <TextField
        multiline
        ref={messageRef}
        rows={7}
        label={bug ? f.whatWentWrong : f.yourIdea}
        placeholder={bug ? f.bugPlaceholder : f.ideaPlaceholder}
        name="message"
        autoComplete="off"
        hint={f.messageHint}
        error={messageError}
        value={message}
        maxLength={2000}
        onChange={(e) => {
          setMessage(e.target.value);
          if (messageError) setMessageError(null);
        }}
      />
      {bug ? (
        <div className="flex flex-col gap-1">
          <Checkbox checked={includeDevice} onChange={setIncludeDevice}>
            <span className="text-body text-text">{f.includeDevice}</span>
          </Checkbox>
          <p className="pl-9 text-caption text-muted">
            {f.deviceNote(from)}
          </p>
        </div>
      ) : null}
      {error ? (
        <div role="alert">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}
      <div className="flex flex-col gap-3 md:flex-row-reverse md:justify-start">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? f.sending : bug ? f.sendReport : f.sendIdea}
        </Button>
      </div>
    </form>
  );
}
