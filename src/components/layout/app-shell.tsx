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

  return (
    <div className="min-h-screen flex w-full bg-[var(--color-background)]">
      <Sidebar user={user} org={org} />

      <main className="flex-1 flex flex-col min-h-screen transition-[margin] duration-300 ease-in-out" style={{ marginLeft: 68 }}>
        {/* Top-right agent trigger */}
        <button
          onClick={() => setAgentOpen((v) => !v)}
          aria-label="Open AI assistant"
          className="fixed top-4 z-50 flex items-center justify-center rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm hover:shadow-md hover:border-[var(--color-accent)]/30 transition-all duration-200 cursor-pointer"
          style={{ right: 20, width: 40, height: 40 }}
        >
          {/* Chat-sparkle icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)]">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M14.5 7.5l0.5-1.5 0.5 1.5L17 8l-1.5 0.5L15 10l-0.5-1.5L13 8z" fill="currentColor" stroke="none" />
            <path d="M10 9.5l0.35-1 0.35 1L11.7 9.85l-1 0.35L10.35 11.2l-0.35-1L9 9.85z" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
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
