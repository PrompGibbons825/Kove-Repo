import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen bg-[var(--color-background)]">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#312e81] via-[#4338ca] to-[#6366f1]">
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <span className="text-2xl font-bold tracking-tight">kove</span>
          </div>
          <div className="max-w-md space-y-6">
            <h2 className="text-4xl font-bold leading-tight">
              Start selling smarter<br />in minutes
            </h2>
            <p className="text-lg text-white/80 leading-relaxed">
              Import your contacts, and Kove&apos;s AI instantly prioritizes your
              leads, queues your calls, and starts learning what works for your team.
            </p>
            <div className="space-y-3 pt-2">
              {[
                "AI-ranked priority call queue",
                "Automatic follow-up scheduling",
                "Commission tracking in real-time",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span className="text-sm text-white/90">{feature}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-white/40">&copy; 2026 Kove. All rights reserved.</p>
        </div>
      </div>

      {/* Right signup form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px] space-y-8">
          <div className="lg:hidden flex items-center gap-2 justify-center mb-4">
            <span className="text-2xl font-bold text-[var(--color-text-primary)]">kove</span>
            <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">beta</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
              Create your account
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Get your team set up in under 2 minutes
            </p>
          </div>
          <SignupForm />
        </div>
      </div>
    </div>
  );
}
