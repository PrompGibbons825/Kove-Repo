import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)]">
      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            kove
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Create your account and set up your team
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
