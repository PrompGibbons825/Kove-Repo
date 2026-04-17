"use client";

import { useState, useEffect, useCallback } from "react";
import type { Contact, ContactStatus } from "@/lib/types/database";
import { ContactDetail } from "./contact-detail";
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
    <span
      className="text-[11px] font-medium rounded-full"
      style={{ padding: "2px 10px", background: cfg.bg, color: cfg.text }}
    >
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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">("all");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      setContacts(data.contacts ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const filtered = contacts.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
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

  return (
    <div style={{ padding: "32px 40px" }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="text-[24px] font-semibold text-[var(--color-text-primary)]">Contacts</h1>
          <p className="text-[13px] text-[var(--color-text-tertiary)]" style={{ marginTop: 4 }}>
            {contacts.length} total · {filtered.length} shown
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[13px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
            style={{ padding: "8px 16px" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import CSV
          </button>
          <button
            onClick={() => { setEditingContact(null); setShowForm(true); }}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer"
            style={{ padding: "8px 16px" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Contact
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
        {/* Search */}
        <div className="relative flex-1" style={{ maxWidth: 360 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute text-[var(--color-text-tertiary)]" style={{ left: 12, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40 transition-colors"
            style={{ padding: "8px 12px 8px 36px" }}
          />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setStatusFilter("all")}
            className="rounded-full text-[11px] font-medium transition-colors cursor-pointer"
            style={{
              padding: "4px 12px",
              background: statusFilter === "all" ? "var(--color-accent)" : "var(--color-surface-hover)",
              color: statusFilter === "all" ? "white" : "var(--color-text-secondary)",
            }}
          >
            All
          </button>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
              className="rounded-full text-[11px] font-medium transition-colors cursor-pointer"
              style={{
                padding: "4px 12px",
                background: statusFilter === s ? STATUS_CONFIG[s].bg : "var(--color-surface-hover)",
                color: statusFilter === s ? STATUS_CONFIG[s].text : "var(--color-text-tertiary)",
              }}
            >
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <button
            onClick={() => handleDelete(Array.from(selectedIds))}
            className="flex items-center gap-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer"
            style={{ padding: "6px 12px", background: "var(--color-error-soft)", color: "var(--color-error)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
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
              <th className="text-left text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ padding: "10px 16px" }}>Source</th>
              <th className="text-left text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ padding: "10px 16px" }}>Last Contact</th>
              <th className="text-left text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ padding: "10px 16px" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center text-[var(--color-text-tertiary)]" style={{ padding: 40 }}>Loading contacts...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-[var(--color-text-tertiary)]" style={{ padding: 40 }}>
                {contacts.length === 0 ? "No contacts yet. Add one or import a CSV." : "No contacts match your filters."}
              </td></tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelectedContact(c)}
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
                  <td style={{ padding: "10px 16px" }}><StatusBadge status={c.status} /></td>
                  <td style={{ padding: "10px 16px" }} className="text-[var(--color-text-secondary)]">{c.source ?? "—"}</td>
                  <td style={{ padding: "10px 16px" }} className="text-[var(--color-text-secondary)]">{timeAgo(c.last_contacted_at)}</td>
                  <td style={{ padding: "10px 16px" }} className="text-[var(--color-text-tertiary)]">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Contact detail slide-over */}
      {selectedContact && (
        <ContactDetail
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onEdit={(c) => { setEditingContact(c); setShowForm(true); setSelectedContact(null); }}
          onDelete={async (id) => { await handleDelete([id]); setSelectedContact(null); }}
          onRefresh={fetchContacts}
        />
      )}

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
