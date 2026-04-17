"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { AgentSidebar } from "./agent-sidebar";
import { ContactPanelProvider, useContactPanel } from "@/components/contacts/contact-panel-context";
import { ContactDetail } from "@/components/contacts/contact-detail";
import type { User, Organization } from "@/lib/types/database";

interface AppShellProps {
  user: User;
  org: Organization;
  children: React.ReactNode;
}

export function AppShell({ user, org, children }: AppShellProps) {
  return (
    <ContactPanelProvider>
      <AppShellInner user={user} org={org}>{children}</AppShellInner>
    </ContactPanelProvider>
  );
}

function AppShellInner({ user, org, children }: AppShellProps) {
  const [agentOpen, setAgentOpen] = useState(false);
  const [columnWidth, setColumnWidth] = useState(400);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const { contact, viewMode, width: contactWidth, setRightOffset } = useContactPanel();

  const contactSidebarOpen = !!(contact && viewMode === "sidebar");
  const contactFullscreen = !!(contact && viewMode === "fullscreen");
  const bothOpen = contactSidebarOpen && agentOpen;

  // Right column is always a single fixed panel — no offset needed
  useEffect(() => { setRightOffset(0); }, [setRightOffset]);

  const rightColumnWidth = agentOpen ? columnWidth : (contactSidebarOpen ? contactWidth : 0);
  const rightMargin = contactFullscreen ? 0 : rightColumnWidth;

  // ── Column width resize (left edge drag) ──
  const colResizingRef = useRef(false);
  const startColumnResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    colResizingRef.current = true;
    const startX = e.clientX;
    const startW = columnWidth;
    const onMove = (ev: MouseEvent) => {
      if (!colResizingRef.current) return;
      setColumnWidth(Math.max(320, Math.min(800, startW + (startX - ev.clientX))));
    };
    const onUp = () => {
      colResizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [columnWidth]);

  // ── Vertical split resize ──
  const rightColumnRef = useRef<HTMLDivElement>(null);
  const splitResizingRef = useRef(false);
  const startSplitResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    splitResizingRef.current = true;
    const rect = rightColumnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const onMove = (ev: MouseEvent) => {
      if (!splitResizingRef.current) return;
      setSplitRatio(Math.max(0.2, Math.min(0.8, (ev.clientY - rect.top) / rect.height)));
    };
    const onUp = () => {
      splitResizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  return (
    <div className="min-h-screen flex w-full bg-[var(--color-background)]">
      <Sidebar user={user} org={org} />

      <main
        className="flex-1 flex flex-col min-h-screen transition-[margin] duration-300 ease-in-out relative"
        style={{ marginLeft: 68, marginRight: rightMargin }}
      >
        {/* Top-right agent trigger — hidden when agent open */}
        {!agentOpen && (
          <button
            onClick={() => setAgentOpen(true)}
            aria-label="Open AI assistant"
            className="fixed top-4 z-40 flex items-center justify-center rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm hover:shadow-md hover:border-[var(--color-accent)]/30 transition-all duration-200 cursor-pointer"
            style={{ right: (contactSidebarOpen ? contactWidth : 0) + 20, width: 40, height: 40 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)]">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M14.5 7.5l0.5-1.5 0.5 1.5L17 8l-1.5 0.5L15 10l-0.5-1.5L13 8z" fill="currentColor" stroke="none" />
              <path d="M10 9.5l0.35-1 0.35 1L11.7 9.85l-1 0.35L10.35 11.2l-0.35-1L9 9.85z" fill="currentColor" stroke="none" />
            </svg>
          </button>
        )}
        <div className="flex-1 overflow-auto">
          {contactFullscreen && <ContactDetail />}
          {!contactFullscreen && children}
        </div>
      </main>

      {/* Single right column — contact + agent share it, split top/bottom when both open */}
      {(contactSidebarOpen || agentOpen) && !contactFullscreen && (
        <div
          ref={rightColumnRef}
          className="fixed top-0 right-0 h-screen z-40 flex flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
          style={{ width: rightColumnWidth, transition: "width 250ms cubic-bezier(0.16,1,0.3,1)" }}
        >
          {/* Left-edge horizontal resize handle */}
          <div
            onMouseDown={startColumnResize}
            className="absolute left-0 top-0 bottom-0 z-10 cursor-col-resize hover:bg-[var(--color-accent)]/20 transition-colors"
            style={{ width: 6 }}
          />

          {bothOpen ? (
            <>
              {/* Top pane: contact detail */}
              <div style={{ height: `${splitRatio * 100}%`, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <ContactDetail contained />
              </div>
              {/* Horizontal drag divider */}
              <div
                onMouseDown={startSplitResize}
                className="shrink-0 flex items-center justify-center cursor-row-resize hover:bg-[var(--color-accent)]/15 transition-colors group"
                style={{ height: 8, background: "var(--color-border)" }}
              >
                <div className="rounded-full opacity-40 group-hover:opacity-80 transition-opacity" style={{ width: 32, height: 3, background: "var(--color-text-tertiary)" }} />
              </div>
              {/* Bottom pane: agent */}
              <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <AgentSidebar
                  user={user} org={org}
                  width={columnWidth} onWidthChange={setColumnWidth}
                  onClose={() => setAgentOpen(false)}
                  contained
                />
              </div>
            </>
          ) : contactSidebarOpen ? (
            <ContactDetail contained />
          ) : (
            <AgentSidebar
              user={user} org={org}
              width={columnWidth} onWidthChange={setColumnWidth}
              onClose={() => setAgentOpen(false)}
              contained
            />
          )}
        </div>
      )}
    </div>
  );
}
