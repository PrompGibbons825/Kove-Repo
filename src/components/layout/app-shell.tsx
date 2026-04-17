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
      {/* Left sidebar — navigation */}
      <Sidebar user={user} org={org} />

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">
          {children}
        </div>

        {/* Floating AI prompt trigger */}
        {!agentOpen && (
          <button
            onClick={() => setAgentOpen(true)}
            className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] text-white shadow-lg shadow-[var(--color-accent)]/20 hover:shadow-xl hover:shadow-[var(--color-accent)]/30 hover:scale-105 active:scale-95 transition-all z-50"
            aria-label="Open AI Agent"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </button>
        )}
      </main>

      {/* Right sidebar — AI Agent */}
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
