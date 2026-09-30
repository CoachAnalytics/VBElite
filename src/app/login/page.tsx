import Link from "next/link";
import { login } from "../actions";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <AuthForm action={login} submitLabel="Log in" passwordAutoComplete="current-password" />
      <p className="text-sm text-ink-2">
        New here? <Link href="/signup" className="text-accent-ink underline">Create an account</Link>
      </p>
    </div>
  );
}
