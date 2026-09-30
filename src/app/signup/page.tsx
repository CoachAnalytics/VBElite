import Link from "next/link";
import { signup } from "../actions";
import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      <div>
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-ink-2">Next you&apos;ll add your athlete&apos;s details.</p>
      </div>
      <AuthForm action={signup} submitLabel="Create account" passwordAutoComplete="new-password" />
      <p className="text-sm text-ink-2">
        Already have an account? <Link href="/login" className="text-accent-ink underline">Log in</Link>
      </p>
    </div>
  );
}
