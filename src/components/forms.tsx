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
  const [state, formAction, pending] = useActionState(action, null);
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
      {state?.error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>
      )}
      {state?.ok && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.ok}</div>
      )}
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
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? "Saving…" : children}
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
      <button type="button" className={className} onClick={() => setOpen((o) => !o)}>
        {open ? "Close" : label}
      </button>
      {open && <div className="mt-3">{children}</div>}
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
