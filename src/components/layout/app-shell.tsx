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
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
      <Sidebar user={user} org={org} />

      <main className="relative flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-12 py-12">
          {children}
        </div>

        {/* Floating AI FAB */}
        {!agentOpen && (
          <button
            onClick={() => setAgentOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/25 hover:shadow-xl hover:shadow-[var(--color-accent)]/30 hover:scale-105 active:scale-95 transition-all duration-200"
            aria-label="Open AI Agent"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
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
