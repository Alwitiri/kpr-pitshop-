"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

type Result = { ok?: string; error?: string } | null;

/** Pending state of the surrounding <ActionForm> (null = not inside one). */
const PendingContext = createContext<boolean | null>(null);

/**
 * Form wrapper for server actions returning {ok, error}.
 * Shows the message and optionally resets the form on success.
 */
export function ActionForm({
  action,
  children,
  className = "",
  resetOnSuccess = false,
  onSuccess,
}: {
  action: (prev: Result, fd: FormData) => Promise<Result>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  // Catch failures (e.g. upload too large, server restarting) and show them in the form
  // instead of letting them crash the page.
  const safeAction = async (prev: Result, fd: FormData): Promise<Result> => {
    try {
      return await action(prev, fd);
    } catch (e) {
      const digest = e && typeof e === "object" && "digest" in e ? String((e as { digest: unknown }).digest) : "";
      if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) throw e; // normal navigation
      const msg = e instanceof Error ? e.message : String(e);
      if (/exceeded|too large|413/i.test(msg)) return { error: "That file is too large to upload. Please choose a smaller file." };
      if (/fetch|network|Failed to/i.test(msg)) return { error: "Could not reach the KPR server. Check that the app is running, then try again." };
      return { error: "Something went wrong while saving. Please try again." };
    }
  };
  const [state, formAction, pending] = useActionState(safeAction, null);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form
      ref={ref}
      className={className}
      // Submit via onSubmit (not the `action` prop) so React does NOT clear the
      // fields automatically – if saving fails, the user keeps what they typed.
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const fd = new FormData(e.currentTarget);
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.name) fd.append(submitter.name, submitter.value);
        startTransition(() => formAction(fd));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
      <div aria-live="polite">
        {state?.error && (
          <div role="alert" className="page-enter mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
            <span>{state.error}</span>
          </div>
        )}
        {state?.ok && (
          <div role="status" className="page-enter mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
            <span>{state.ok}</span>
          </div>
        )}
      </div>
    </form>
  );
}

export function Submit({
  children,
  className = "btn-primary",
  confirm,
  name,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  name?: string;
  value?: string;
}) {
  const status = useFormStatus(); // plain <form action={...}> forms
  const ctx = useContext(PendingContext); // <ActionForm>
  const pending = ctx ?? status.pending;
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? (
        <>
          <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin-fast" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Saving…
        </>
      ) : children}
    </button>
  );
}

/** A collapsible inline panel, e.g. for "Add payment" forms. */
export function Toggle({
  label,
  children,
  className = "btn-outline",
  defaultOpen = false,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" className={className} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? "Close" : label}
      </button>
      {open && <div className="page-enter mt-3">{children}</div>}
    </div>
  );
}

export function PrintButton({ label = "Print", className = "btn-outline" }: { label?: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {label}
    </button>
  );
}

/** Download table rows as CSV (opens in Excel). */
export function ExportCsv({
  rows,
  filename,
  label = "Export Excel (CSV)",
}: {
  rows: (string | number | null | undefined)[][];
  filename: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="btn-outline"
      onClick={() => {
        const csv = rows
          .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
          .join("\r\n");
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      }}
    >
      {label}
    </button>
  );
}

/** Password box with a show / hide button (helps on shop counters and phones). */
export function PasswordInput({ name = "password", autoComplete = "current-password", required = true, minLength }: { name?: string; autoComplete?: string; required?: boolean; minLength?: number }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input name={name} type={show ? "text" : "password"} className="input pr-11" autoComplete={autoComplete} required={required} minLength={minLength} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-gray-400 hover:text-gray-700"
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {show ? (
            <><path d="M17.9 17.9A10 10 0 0 1 12 20c-7 0-10-8-10-8a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.2 3.2" /><path d="m1 1 22 22" /></>
          ) : (
            <><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" /><circle cx="12" cy="12" r="3" /></>
          )}
        </svg>
      </button>
    </div>
  );
}
