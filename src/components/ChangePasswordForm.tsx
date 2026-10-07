"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="card space-y-4 p-5">
      <h2 className="font-medium">Change password</h2>
      <div>
        <label htmlFor="current" className="label">Current password</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className="input" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="next" className="label">New password</label>
          <input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required className="input" />
        </div>
        <div>
          <label htmlFor="confirm" className="label">Confirm new password</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="input" />
        </div>
      </div>
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      {state?.ok && <p className="text-sm text-good" role="status">Password changed. Other devices have been signed out.</p>}
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
