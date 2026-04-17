"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Contact, ContactStatus, Workflow } from "@/lib/types/database";
import { useContactPanel } from "./contact-panel-context";
import { ContactForm } from "./contact-form";
import { CsvImport } from "./csv-import";

const STATUS_CONFIG: Record<ContactStatus, { label: string; bg: string; text: string }> = {
  new:        { label: "New",        bg: "var(--color-info-soft)",    text: "var(--color-info)" },
  qualifying: { label: "Qualifying", bg: "var(--color-warning-soft)", text: "var(--color-warning)" },
  qualified:  { label: "Qualified",  bg: "var(--color-accent-soft)",  text: "var(--color-accent)" },
  closing:    { label: "Closing",    bg: "var(--color-warning-soft)", text: "var(--color-warning)" },
  won:        { label: "Won",        bg: "var(--color-success-soft)", text: "var(--color-success)" },
  lost:       { label: "Lost",       bg: "rgba(150,150,150,0.12)",    text: "var(--color-text-tertiary)" },
  renewal:    { label: "Renewal",    bg: "var(--color-accent-soft)",  text: "var(--color-accent)" },
};

const ALL_STATUSES: ContactStatus[] = ["new", "qualifying", "qualified", "closing", "won", "lost", "renewal"];

function StatusBadge({ status }: { status: ContactStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;
  return (
    <span className="text-[11px] font-medium rounded-full" style={{ padding: "2px 10px", background: cfg.bg, color: cfg.text }}>
      {cfg.label}
    </span>
  );
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function ContactsPage() {
  const { openContact, contact: panelContact } = useContactPanel();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync changes from contact panel back into local contacts list
  useEffect(() => {
    if (!panelContact) return;
    setContacts((prev) =>
      prev.map((c) => (c.id === panelContact.id ? { ...c, ...panelContact } : c))
    );
  }, [panelContact]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">("all");
  const [pipelineFilter, setPipelineFilter] = useState<string | "all">("all");
  const [workflowFilter, setWorkflowFilter] = useState<string | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      setContacts(data.contacts ?? []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  useEffect(() => {
    fetch("/api/workflows").then(r => r.json()).then(d => setWorkflows(d.workflows ?? [])).catch(() => {});
  }, []);

  // Close filter dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilterDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Auto-focus search on mount
  useEffect(() => { searchRef.current?.focus(); }, []);

  // Sort: most recently active first (last_contacted_at desc, then created_at desc)
  const sorted = [...contacts].sort((a, b) => {
    const aTime = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
    const bTime = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
    if (bTime !== aTime) return bTime - aTime;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const filtered = sorted.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (pipelineFilter !== "all" && (c.pipeline_stage ?? "") !== pipelineFilter) return false;
    if (workflowFilter !== "all" && (c.workflow_id ?? "") !== workflowFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.source?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} contact${ids.length > 1 ? "s" : ""}?`)) return;
    await Promise.all(ids.map((id) => fetch(`/api/contacts/${id}`, { method: "DELETE" })));
    setSelectedIds(new Set());
    fetchContacts();
  };

  const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  // Derive pipeline stages from data
  const pipelineStages = [...new Set(contacts.map(c => c.pipeline_stage).filter(Boolean))] as string[];
  const activeFilterCount = (statusFilter !== "all" ? 1 : 0) + (pipelineFilter !== "all" ? 1 : 0) + (workflowFilter !== "all" ? 1 : 0);

  // Inline status change handler
  async function handleInlineStatusChange(contactId: string, newStatus: ContactStatus) {
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, status: newStatus } : c));
    await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  // Inline workflow change handler
  async function handleInlineWorkflowChange(contactId: string, workflowId: string | null) {
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, workflow_id: workflowId } : c));
    await fetch(`/api/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_id: workflowId }),
    });
  }

  return (
    <div style={{ padding: "32px 40px" }}>
      {/* Hero search */}
      <div style={{ marginBottom: 28 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <div>
            <h1 className="text-[24px] font-semibold text-[var(--color-text-primary)]">Contacts</h1>
            <p className="text-[13px] text-[var(--color-text-tertiary)]" style={{ marginTop: 4 }}>
              {contacts.length} total{filtered.length !== contacts.length ? ` · ${filtered.length} shown` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[13px] font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
              style={{ padding: "7px 14px" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import
            </button>
            <button
              onClick={() => { setEditingContact(null); setShowForm(true); }}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[13px] font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
              style={{ padding: "7px 14px" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add
            </button>
          </div>
        </div>

        {/* Search bar — full width, prominent */}
        <div className="relative">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute text-[var(--color-text-tertiary)]" style={{ left: 16, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search by name, phone, email, or source..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40 transition-colors"
            style={{ padding: "12px 16px 12px 44px" }}
          />
        </div>
      </div>

      {/* Secondary filters row */}
      <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-1.5 flex-1">
          {/* Filter dropdown */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] text-[12px] font-medium transition-colors cursor-pointer"
              style={{
                padding: "6px 12px",
                background: activeFilterCount > 0 ? "var(--color-accent-soft)" : "var(--color-surface-hover)",
                color: activeFilterCount > 0 ? "var(--color-accent)" : "var(--color-text-tertiary)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>

            {showFilterDropdown && (
              <div
                className="absolute left-0 z-50 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
                style={{ top: "calc(100% + 6px)", width: 280, padding: "8px 0" }}
              >
                {/* Status section */}
                <FilterSection title="Status">
                  <button onClick={() => setStatusFilter("all")} className="w-full text-left text-[12px] rounded-md cursor-pointer transition-colors" style={{ padding: "4px 12px", color: statusFilter === "all" ? "var(--color-accent)" : "var(--color-text-secondary)", fontWeight: statusFilter === "all" ? 600 : 400 }}>All Statuses</button>
                  {ALL_STATUSES.map(s => (
                    <button key={s} onClick={() => setStatusFilter(statusFilter === s ? "all" : s)} className="w-full text-left text-[12px] rounded-md cursor-pointer transition-colors flex items-center gap-2" style={{ padding: "4px 12px", color: statusFilter === s ? STATUS_CONFIG[s].text : "var(--color-text-secondary)", fontWeight: statusFilter === s ? 600 : 400 }}>
                      <span className="rounded-full" style={{ width: 8, height: 8, background: STATUS_CONFIG[s].bg, border: `1px solid ${STATUS_CONFIG[s].text}` }} />
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </FilterSection>

                {/* Pipeline section */}
                {pipelineStages.length > 0 && (
                  <FilterSection title="Pipeline Stage">
                    <button onClick={() => setPipelineFilter("all")} className="w-full text-left text-[12px] rounded-md cursor-pointer transition-colors" style={{ padding: "4px 12px", color: pipelineFilter === "all" ? "var(--color-accent)" : "var(--color-text-secondary)", fontWeight: pipelineFilter === "all" ? 600 : 400 }}>All Stages</button>
                    {pipelineStages.map(s => (
                      <button key={s} onClick={() => setPipelineFilter(pipelineFilter === s ? "all" : s)} className="w-full text-left text-[12px] rounded-md cursor-pointer transition-colors" style={{ padding: "4px 12px", color: pipelineFilter === s ? "var(--color-accent)" : "var(--color-text-secondary)", fontWeight: pipelineFilter === s ? 600 : 400 }}>{s}</button>
                    ))}
                  </FilterSection>
                )}

                {/* Workflow section */}
                {workflows.length > 0 && (
                  <FilterSection title="Workflow">
                    <button onClick={() => setWorkflowFilter("all")} className="w-full text-left text-[12px] rounded-md cursor-pointer transition-colors" style={{ padding: "4px 12px", color: workflowFilter === "all" ? "var(--color-accent)" : "var(--color-text-secondary)", fontWeight: workflowFilter === "all" ? 600 : 400 }}>All Workflows</button>
                    {workflows.map(w => (
                      <button key={w.id} onClick={() => setWorkflowFilter(workflowFilter === w.id ? "all" : w.id)} className="w-full text-left text-[12px] rounded-md cursor-pointer transition-colors" style={{ padding: "4px 12px", color: workflowFilter === w.id ? "var(--color-accent)" : "var(--color-text-secondary)", fontWeight: workflowFilter === w.id ? 600 : 400 }}>{w.name}</button>
                    ))}
                  </FilterSection>
                )}

                {/* Clear all */}
                {activeFilterCount > 0 && (
                  <div style={{ padding: "6px 12px", borderTop: "1px solid var(--color-border)", marginTop: 4, paddingTop: 8 }}>
                    <button onClick={() => { setStatusFilter("all"); setPipelineFilter("all"); setWorkflowFilter("all"); }} className="text-[11px] font-medium text-[var(--color-error)] cursor-pointer hover:underline">Clear all filters</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active filter pills */}
          {statusFilter !== "all" && (
            <span className="flex items-center gap-1 rounded-full text-[11px] font-medium cursor-pointer" style={{ padding: "3px 10px", background: STATUS_CONFIG[statusFilter].bg, color: STATUS_CONFIG[statusFilter].text }} onClick={() => setStatusFilter("all")}>
              {STATUS_CONFIG[statusFilter].label} ×
            </span>
          )}
          {pipelineFilter !== "all" && (
            <span className="flex items-center gap-1 rounded-full text-[11px] font-medium cursor-pointer" style={{ padding: "3px 10px", background: "var(--color-surface-hover)", color: "var(--color-text-secondary)" }} onClick={() => setPipelineFilter("all")}>
              {pipelineFilter} ×
            </span>
          )}
          {workflowFilter !== "all" && (
            <span className="flex items-center gap-1 rounded-full text-[11px] font-medium cursor-pointer" style={{ padding: "3px 10px", background: "var(--color-surface-hover)", color: "var(--color-text-secondary)" }} onClick={() => setWorkflowFilter("all")}>
              {workflows.find(w => w.id === workflowFilter)?.name ?? "Workflow"} ×
            </span>
          )}
        </div>

        {selectedIds.size > 0 && (
          <button
            onClick={() => handleDelete(Array.from(selectedIds))}
            className="flex items-center gap-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer"
            style={{ padding: "6px 12px", background: "var(--color-error-soft)", color: "var(--color-error)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
            Delete {selectedIds.size}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th style={{ padding: "10px 16px", width: 40 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => {
                    if (allSelected) setSelectedIds(new Set());
                    else setSelectedIds(new Set(filtered.map((c) => c.id)));
                  }}
                  className="cursor-pointer accent-[var(--color-accent)]"
                />
              </th>
              <th className="text-left text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ padding: "10px 16px" }}>Name</th>
              <th className="text-left text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ padding: "10px 16px" }}>Contact</th>
              <th className="text-left text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ padding: "10px 16px" }}>Status</th>
              <th className="text-left text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ padding: "10px 16px" }}>Workflow</th>
              <th className="text-left text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ padding: "10px 16px" }}>Source</th>
              <th className="text-left text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ padding: "10px 16px" }}>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center text-[var(--color-text-tertiary)]" style={{ padding: 40 }}>Loading contacts...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-[var(--color-text-tertiary)]" style={{ padding: 40 }}>
                {contacts.length === 0 ? "No contacts yet. Add one or import a CSV." : "No contacts match your search."}
              </td></tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => openContact(c)}
                  className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-hover)] cursor-pointer transition-colors"
                >
                  <td style={{ padding: "10px 16px" }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => {
                        const next = new Set(selectedIds);
                        if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                        setSelectedIds(next);
                      }}
                      className="cursor-pointer accent-[var(--color-accent)]"
                    />
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center justify-center rounded-full text-[11px] font-semibold text-white shrink-0"
                        style={{ width: 32, height: 32, background: "var(--color-accent)" }}
                      >
                        {c.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-[var(--color-text-primary)]">{c.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 16px" }} className="text-[var(--color-text-secondary)]">
                    <div>{c.phone ?? "—"}</div>
                    <div className="text-[11px] text-[var(--color-text-tertiary)]">{c.email ?? ""}</div>
                  </td>
                  <td style={{ padding: "10px 16px" }} onClick={(e) => e.stopPropagation()}>
                    <InlineSelect
                      value={c.status}
                      options={ALL_STATUSES.map(s => ({ value: s, label: STATUS_CONFIG[s].label }))}
                      onChange={(v) => handleInlineStatusChange(c.id, v as ContactStatus)}
                      renderValue={(v) => <StatusBadge status={v as ContactStatus} />}
                    />
                  </td>
                  <td style={{ padding: "10px 16px" }} onClick={(e) => e.stopPropagation()}>
                    <InlineSelect
                      value={c.workflow_id ?? ""}
                      options={[{ value: "", label: "None" }, ...workflows.map(w => ({ value: w.id, label: w.name }))]}
                      onChange={(v) => handleInlineWorkflowChange(c.id, v || null)}
                    />
                  </td>
                  <td style={{ padding: "10px 16px" }} className="text-[var(--color-text-secondary)]">{c.source ?? "—"}</td>
                  <td style={{ padding: "10px 16px" }} className="text-[var(--color-text-secondary)]">{timeAgo(c.last_contacted_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New / Edit form */}
      {showForm && (
        <ContactForm
          contact={editingContact}
          onClose={() => { setShowForm(false); setEditingContact(null); }}
          onSaved={() => { setShowForm(false); setEditingContact(null); fetchContacts(); }}
        />
      )}

      {/* CSV Import */}
      {showImport && (
        <CsvImport
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); fetchContacts(); }}
        />
      )}
    </div>
  );
}
/* ── Filter Section (collapsible) ── */
function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ padding: "4px 0" }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider cursor-pointer hover:text-[var(--color-text-secondary)]"
        style={{ padding: "4px 12px" }}
      >
        {title}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 150ms" }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <div style={{ padding: "2px 0" }}>{children}</div>}
    </div>
  );
}

/* ── Inline Select (click-to-change dropdown on table rows) ── */
function InlineSelect({
  value,
  options,
  onChange,
  renderValue,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  renderValue?: (v: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const currentLabel = options.find(o => o.value === value)?.label ?? "—";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="text-left text-[12px] rounded-md transition-colors cursor-pointer hover:bg-[var(--color-surface-hover)]"
        style={{ padding: "2px 6px" }}
      >
        {renderValue ? renderValue(value) : (
          <span className="text-[var(--color-text-secondary)]">{currentLabel}</span>
        )}
      </button>
      {open && (
        <div
          className="absolute left-0 z-50 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
          style={{ top: "calc(100% + 2px)", minWidth: 140, padding: "4px 0" }}
        >
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="w-full text-left text-[12px] rounded-md cursor-pointer transition-colors hover:bg-[var(--color-surface-hover)]"
              style={{
                padding: "4px 10px",
                color: o.value === value ? "var(--color-accent)" : "var(--color-text-secondary)",
                fontWeight: o.value === value ? 600 : 400,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}