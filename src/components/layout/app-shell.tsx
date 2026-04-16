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
        <div className="mx-auto max-w-4xl px-6 py-6">
          {children}
        </div>

        {/* Floating AI prompt trigger */}
        {!agentOpen && (
          <button
            onClick={() => setAgentOpen(true)}
            className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-text)] shadow-lg hover:bg-[var(--color-accent-hover)] transition-colors z-50"
            aria-label="Open AI Agent"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5Z" />
              <path d="M17 10v1a5 5 0 0 1-10 0v-1" />
              <path d="M12 19v3" />
              <path d="M8 22h8" />
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
