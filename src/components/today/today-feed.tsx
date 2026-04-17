"use client";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function TodayFeed() {
  const greeting = getGreeting();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="animate-fade-up">
        <p className="text-sm font-medium text-[var(--color-accent)]">{today}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
          {greeting} 👋
        </h1>
        <p className="mt-2 text-base text-[var(--color-text-secondary)]">
          Here&apos;s what needs your attention today.
        </p>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-3 gap-5 animate-fade-up stagger-1">
        {[
          { label: "Contacts", value: "0", icon: "👥", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
          { label: "Open Tasks", value: "0", icon: "✓", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
          { label: "Commission MTD", value: "$0", icon: "💰", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-xs)] transition-all duration-200 hover:shadow-[var(--shadow-md)] hover:border-[var(--color-accent)]/20 hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
                {stat.label}
              </p>
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${stat.color}`}>
                {stat.icon}
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* AI Morning Brief — Onboarding Card */}
      <div className="animate-fade-up stagger-2 overflow-hidden rounded-xl border border-[var(--color-accent)]/15 bg-gradient-to-br from-[var(--color-accent-soft)] via-[var(--color-surface)] to-[var(--color-surface)] shadow-[var(--shadow-sm)]">
        <div className="p-7">
          <div className="flex items-start gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] shadow-lg shadow-[var(--color-accent)]/20">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-[17px] font-semibold text-[var(--color-text-primary)]">
                  Your AI Brief
                </p>
                <span className="rounded-full bg-[var(--color-accent)]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-accent)] uppercase tracking-wider">
                  AI
                </span>
              </div>
              <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                Welcome to kove! Import your contacts to unlock AI-powered lead scoring, 
                automated call queuing, and daily briefings tailored to your sales territory.
              </p>
              <div className="flex items-center gap-4 pt-2">
                <button className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm shadow-[var(--color-accent)]/20 hover:bg-[var(--color-accent-hover)] transition-all duration-150 hover:shadow-md hover:-translate-y-px active:translate-y-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" x2="19" y1="8" y2="14" />
                    <line x1="22" x2="16" y1="11" y2="11" />
                  </svg>
                  Import Contacts
                </button>
                <button className="text-[14px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                  Learn more →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column: Priority Queue + Appointments */}
      <div className="grid grid-cols-2 gap-6 animate-fade-up stagger-3">
        {/* Priority Queue */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-xs)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-6 py-4">
            <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
              Priority Queue
            </h2>
            <span className="text-[13px] font-medium text-[var(--color-text-tertiary)]">0 leads</span>
          </div>
          <div className="flex flex-col items-center justify-center py-14 px-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-hover)]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-tertiary)]">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <p className="mt-5 text-[15px] font-medium text-[var(--color-text-secondary)]">
              No leads queued yet
            </p>
            <p className="mt-2 max-w-[240px] text-center text-[14px] text-[var(--color-text-tertiary)] leading-relaxed">
              AI will rank your hottest leads here once you import contacts.
            </p>
          </div>
        </div>

        {/* Appointments */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-xs)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-6 py-4">
            <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
              Today&apos;s Schedule
            </h2>
            <span className="text-[13px] font-medium text-[var(--color-text-tertiary)]">0 events</span>
          </div>
          <div className="flex flex-col items-center justify-center py-14 px-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-hover)]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-tertiary)]">
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            </div>
            <p className="mt-5 text-[15px] font-medium text-[var(--color-text-secondary)]">
              No appointments today
            </p>
            <p className="mt-2 max-w-[240px] text-center text-[14px] text-[var(--color-text-tertiary)] leading-relaxed">
              Calendar sync coming soon. Your schedule will show here.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="animate-fade-up stagger-4">
        <h2 className="mb-4 text-[15px] font-semibold text-[var(--color-text-primary)]">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Add Contact", emoji: "👤", desc: "Manual entry" },
            { label: "Import CSV", emoji: "📄", desc: "Bulk upload" },
            { label: "Log Activity", emoji: "📝", desc: "Call or visit" },
            { label: "Ask AI", emoji: "✨", desc: "Get help" },
          ].map((action) => (
            <button
              key={action.label}
              className="group flex flex-col items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-xs)] transition-all duration-200 hover:shadow-[var(--shadow-sm)] hover:border-[var(--color-accent)]/20 hover:-translate-y-0.5"
            >
              <span className="text-2xl">{action.emoji}</span>
              <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">{action.label}</span>
              <span className="text-[13px] text-[var(--color-text-tertiary)]">{action.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
