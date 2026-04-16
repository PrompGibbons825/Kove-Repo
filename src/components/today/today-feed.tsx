"use client";

export function TodayFeed() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Today</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* AI Morning Brief */}
      <div className="rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] text-[var(--color-accent-text)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5Z" />
              <path d="M12 19v3" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Good morning — here&apos;s your brief
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              No data yet. Import your contacts to get started with AI-powered lead prioritization.
            </p>
          </div>
        </div>
      </div>

      {/* Task Queue (empty state) */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
          Priority Queue
        </h2>
        <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No tasks yet. Your AI-ranked call queue and follow-ups will appear here.
          </p>
        </div>
      </div>

      {/* Appointments */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
          Appointments Today
        </h2>
        <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No appointments scheduled. Calendar integration coming soon.
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
            Contacts
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">0</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
            Open Tasks
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">0</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
            Commission MTD
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">$0</p>
        </div>
      </div>
    </div>
  );
}
