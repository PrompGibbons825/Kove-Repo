"use client";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function TodayFeed() {
  const greeting = getGreeting();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
          {greeting}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* AI Morning Brief */}
      <div className="rounded-2xl border border-[var(--color-accent)]/20 bg-gradient-to-r from-[var(--color-accent-soft)] to-transparent p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-text)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5Z" />
              <path d="M12 19v3" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {greeting} — here&apos;s your brief
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              No data yet. Import your contacts to get started with AI-powered lead prioritization.
            </p>
            <button className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[var(--color-accent-hover)] transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" x2="19" y1="8" y2="14" />
                <line x1="22" x2="16" y1="11" y2="11" />
              </svg>
              Import Contacts
            </button>
          </div>
        </div>
      </div>

      {/* Task Queue (empty state) */}
      <div>
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
          Priority Queue
        </h2>
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface-hover)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-tertiary)]">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-medium text-[var(--color-text-secondary)]">
            No tasks yet
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            Your AI-ranked call queue and follow-ups will appear here.
          </p>
        </div>
      </div>

      {/* Appointments */}
      <div>
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
          Appointments Today
        </h2>
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface-hover)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-tertiary)]">
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-medium text-[var(--color-text-secondary)]">
            No appointments scheduled
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            Calendar integration coming soon.
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-all hover:shadow-sm hover:border-[var(--color-accent)]/20">
          <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
            Contacts
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">0</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-all hover:shadow-sm hover:border-[var(--color-accent)]/20">
          <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
            Open Tasks
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">0</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-all hover:shadow-sm hover:border-[var(--color-accent)]/20">
          <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
            Commission MTD
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">$0</p>
        </div>
      </div>
    </div>
  );
}
