"use client";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Demo data — will be replaced with real data from Supabase
const DEMO_TASKS = [
  { id: 1, label: "Call back John Ramirez", icon: "phone", urgent: true },
  { id: 2, label: "Appointment with Jenny Cole", icon: "calendar", urgent: false },
  { id: 3, label: "Complete handoff with Benjamin Tyler", icon: "handoff", urgent: false },
];

function TaskIcon({ type }: { type: string }) {
  const cls = "w-5 h-5";
  const props = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "phone")
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
        <svg {...props} className={`${cls} text-blue-400`}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
      </div>
    );
  if (type === "calendar")
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
        <svg {...props} className={`${cls} text-purple-400`}><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
      </div>
    );
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
      <svg {...props} className={`${cls} text-emerald-400`}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    </div>
  );
}

function UrgentIcon({ type }: { type: string }) {
  const props = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "phone")
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/15">
        <svg {...props} className="w-[18px] h-[18px] text-red-400"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
      </div>
    );
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-hover)]">
      <svg {...props} className="w-[18px] h-[18px] text-[var(--color-text-tertiary)]"><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
    </div>
  );
}

export function TodayFeed() {
  const greeting = getGreeting();

  return (
    <div className="flex gap-8">
      {/* Left: main content */}
      <div className="flex-1 min-w-0 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            {greeting}, Jeffrey
          </h1>
          <p className="mt-1.5 text-[15px] text-[var(--color-text-secondary)]">
            You have 6 tasks and 1 appointment today
          </p>
        </div>

        {/* AI Insight Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-accent)]/20 bg-gradient-to-r from-indigo-600/30 via-purple-600/20 to-indigo-600/10 p-6">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] shadow-lg shadow-[var(--color-accent)]/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[17px] font-semibold text-white/95">
                You have <span className="text-white font-bold">3</span> hot leads from last week that haven&apos;t been called.
              </p>
              <p className="mt-1 text-[15px] text-white/60">
                Prioritize them now?
              </p>
              <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-[14px] font-semibold text-white shadow-sm hover:brightness-110 transition-all">
                Prioritize leads
              </button>
            </div>
          </div>
        </div>

        {/* Today tasks */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Today</h2>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-tertiary)]"><path d="m9 18 6-6-6-6" /></svg>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden divide-y divide-[var(--color-border-subtle)]">
            {DEMO_TASKS.map((task) => (
              <div key={task.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer group">
                <TaskIcon type={task.icon} />
                <span className="flex-1 text-[15px] font-medium text-[var(--color-text-primary)]">
                  {task.label}
                </span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity"><path d="m9 18 6-6-6-6" /></svg>
              </div>
            ))}
          </div>
        </div>

        {/* Urgent tasks */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-red-400">Urgent</h2>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-tertiary)]"><path d="m9 18 6-6-6-6" /></svg>
          </div>
          <div className="rounded-2xl border border-red-500/15 bg-[var(--color-surface)] overflow-hidden divide-y divide-[var(--color-border-subtle)]">
            {DEMO_TASKS.map((task) => (
              <div key={`urgent-${task.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer group">
                <UrgentIcon type={task.icon} />
                <span className="flex-1 text-[14px] font-medium text-[var(--color-text-primary)]">
                  {task.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right sidebar panel */}
      <div className="w-[260px] shrink-0 space-y-6">
        {/* Urgent summary */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Urgent</h3>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-[var(--color-accent)]">3</span>
            <span className="text-sm text-[var(--color-text-secondary)]">Leads untouched</span>
          </div>
        </div>

        {/* Next Appointment */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Next Appointment</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">10:15 AM</p>
              <p className="text-sm text-[var(--color-text-secondary)]">- Jenny Cole</p>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-tertiary)]"><path d="m9 18 6-6-6-6" /></svg>
          </div>
        </div>

        {/* Pipeline mini */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Pipeline</h3>
          <div className="space-y-3">
            {[
              { stage: "New", dots: 7, fill: 1, color: "bg-gray-400" },
              { stage: "Qualifying", dots: 7, fill: 4, color: "bg-blue-500" },
              { stage: "Closing", dots: 7, fill: 6, color: "bg-emerald-500" },
            ].map((row) => (
              <div key={row.stage} className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${row.color}`} />
                <span className="text-xs text-[var(--color-text-secondary)] w-[70px]">{row.stage}</span>
                <div className="flex-1 flex items-center gap-1">
                  {Array.from({ length: row.dots }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 w-2 rounded-full ${i < row.fill ? row.color : "bg-[var(--color-border)]"}`}
                    />
                  ))}
                  <div className={`flex-1 h-1 rounded-full ml-1 ${row.color}`} style={{ opacity: row.fill / row.dots }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
