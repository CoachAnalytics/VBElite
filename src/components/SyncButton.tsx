"use client";

import { useFormStatus } from "react-dom";

export function SyncButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-secondary" disabled={disabled || pending}>
      {pending ? "Syncing… (up to a minute)" : "Sync now"}
    </button>
  );
}
