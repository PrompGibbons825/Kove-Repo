import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-[var(--color-background)]">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#1e40af] via-[#2563eb] to-[#3b82f6]">
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <span className="text-2xl font-bold tracking-tight">kove</span>
          </div>
          <div className="max-w-md space-y-6">
            <h2 className="text-4xl font-bold leading-tight">
              Your AI-powered<br />sales operating system
            </h2>
            <p className="text-lg text-white/80 leading-relaxed">
              Stop managing spreadsheets. Start closing deals. Kove turns your
              field sales data into AI-ranked priorities, automated follow-ups,
              and real-time insights.
            </p>
          </div>
          <p className="text-xs text-white/40">&copy; 2026 Kove. All rights reserved.</p>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-4">
            <span className="text-2xl font-bold text-[var(--color-text-primary)]">kove</span>
            <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">beta</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              Welcome back
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Sign in to your account to continue
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
