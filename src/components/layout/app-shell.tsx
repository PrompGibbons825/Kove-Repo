"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { AgentSidebar } from "./agent-sidebar";
import type { User, Organization } from "@/lib/types/database";

interface AppShellProps {
  user: User;
  org: Organization;
  children: React.ReactNode;
}

export function AppShell({ user, org, children }: AppShellProps) {
  const [agentOpen, setAgentOpen] = useState(false);

  const initials = user.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen flex w-full bg-[var(--color-background)]">
      <Sidebar user={user} org={org} />

      <main className="flex-1 flex flex-col min-h-screen transition-[margin] duration-300 ease-in-out" style={{ marginLeft: 68 }}>
        {/* Top Header Bar */}
        <header className="flex items-center justify-end gap-3 px-8 py-4 shrink-0">
          {/* Notification bell */}
          <button className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--color-surface-hover)] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)]">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-[var(--color-background)]" />
          </button>
          {/* Alert bell */}
          <button className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--color-surface-hover)] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)]">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">2</span>
          </button>
          {/* Mail */}
          <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--color-surface-hover)] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)]">
              <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </button>
          {/* Separator */}
          <div className="h-6 w-px bg-[var(--color-border)] mx-1" />
          {/* Company initial */}
          <span className="text-sm font-medium text-[var(--color-text-secondary)]">{org.name.charAt(0)}</span>
          {/* Kove logo small */}
          <span className="text-sm font-bold text-[var(--color-text-tertiary)]">Y⊙</span>
          {/* Profile avatar */}
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-xs font-bold text-white ring-2 ring-[var(--color-border)] ring-offset-2 ring-offset-[var(--color-background)]">
            {initials}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl px-8 pb-10">
            {children}
          </div>
        </div>

        {/* Ask kove pill */}
        {!agentOpen && (
          <button
            onClick={() => setAgentOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] pl-5 pr-2 py-2 shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
          >
            <span className="text-sm text-[var(--color-text-tertiary)]">Ask kove...</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </span>
          </button>
        )}
      </main>

      {agentOpen && (
        <AgentSidebar
          user={user}
          org={org}
          onClose={() => setAgentOpen(false)}
        />
      )}
    </div>
  );
}
