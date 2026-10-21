"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { initialActionState, type ActionResult } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { ActionFormContext, FormMessage } from "./fields";

export type ServerAction = (prev: ActionResult<unknown>, formData: FormData) => Promise<ActionResult<unknown>>;

/**
 * Form wired to a Server Action with inline success / error messages and
 * per-field errors (read by the field components through context).
 *
 * Submits through a transition instead of the native form action so React does
 * not reset the user's input when validation fails. Without JavaScript the form
 * still posts to the action (progressive enhancement).
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  refreshOnSuccess = true,
  hidden,
  confirm,
}: {
  action: ServerAction;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  refreshOnSuccess?: boolean;
  hidden?: Record<string, string | number | null | undefined>;
  /** Ask the browser to confirm before submitting (irreversible actions). */
  confirm?: string;
}) {
  const [state, dispatch, pending] = React.useActionState(action, initialActionState);
  const [, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);
  const router = useRouter();
  const submitted = React.useRef(false);

  React.useEffect(() => {
    if (!submitted.current || pending) return;
    if (state.ok) {
      if (resetOnSuccess) formRef.current?.reset();
      if (refreshOnSuccess) router.refresh();
    }
  }, [state, pending, resetOnSuccess, refreshOnSuccess, router]);

  return (
    <ActionFormContext.Provider value={{ state, pending }}>
      <form
        ref={formRef}
        action={dispatch}
        className={cn("space-y-4", className)}
        noValidate={false}
        onSubmit={(event) => {
          event.preventDefault();
          if (confirm && !window.confirm(confirm)) return;
          submitted.current = true;
          const formData = new FormData(event.currentTarget);
          startTransition(() => dispatch(formData));
        }}
      >
        {hidden
          ? Object.entries(hidden).map(([k, v]) =>
              v === null || v === undefined ? null : <input key={k} type="hidden" name={k} value={String(v)} />,
            )
          : null}
        <FormMessage state={state} />
        {children}
      </form>
    </ActionFormContext.Provider>
  );
}
