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
