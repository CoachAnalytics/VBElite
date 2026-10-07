"use client";

import { useActionState } from "react";
import { addAdmin } from "@/app/admin/actions";

export function AddAdminForm() {
  const [state, action, pending] = useActionState(addAdmin, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="admin-email" className="label">Email</label>
          <input id="admin-email" name="email" type="email" required autoComplete="off" className="input" />
        </div>
        <div>
          <label htmlFor="admin-password" className="label">Starting password</label>
          <input
            id="admin-password"
            name="password"
            type="text"
            minLength={8}
            autoComplete="off"
            className="input"
            aria-describedby="admin-password-help"
          />
          <p id="admin-password-help" className="mt-1 text-xs text-ink-3">
            Only needed if they don&apos;t have an account yet. They can change it on their Profile page.
          </p>
        </div>
      </div>
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      {state?.message && <p className="text-sm text-good" role="status">{state.message}</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : "Add admin"}
      </button>
    </form>
  );
}
