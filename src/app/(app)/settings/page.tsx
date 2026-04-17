"use client";

import { useState, useEffect, useCallback } from "react";
import type { CustomFieldDef, CustomFieldType } from "@/lib/types/database";

type Tab = "general" | "team" | "fields" | "sources" | "commissions" | "billing";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "team", label: "Team" },
  { id: "fields", label: "Contact Fields" },
  { id: "sources", label: "Sources" },
  { id: "commissions", label: "Commissions" },
  { id: "billing", label: "Billing" },
];

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes / No" },
  { value: "select", label: "Dropdown" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("sources");
  const [sources, setSources] = useState<string[]>([]);
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSource, setNewSource] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>("text");
  const [newFieldOptions, setNewFieldOptions] = useState("");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/org");
      const data = await res.json();
      setSources(data.source_options ?? []);
      setFields(data.custom_field_schema ?? []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  async function save(update: Record<string, unknown>) {
    setSaving(true);
    try {
      await fetch("/api/settings/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  }

  function addSource() {
    const s = newSource.trim();
    if (!s || sources.includes(s)) return;
    const next = [...sources, s];
    setSources(next);
    setNewSource("");
    save({ source_options: next });
  }

  function removeSource(s: string) {
    const next = sources.filter((x) => x !== s);
    setSources(next);
    save({ source_options: next });
  }

  function addField() {
    const label = newFieldLabel.trim();
    if (!label) return;
    const def: CustomFieldDef = {
      id: crypto.randomUUID(),
      label,
      type: newFieldType,
      ...(newFieldType === "select" && newFieldOptions.trim()
        ? { options: newFieldOptions.split(",").map((o) => o.trim()).filter(Boolean) }
        : {}),
    };
    const next = [...fields, def];
    setFields(next);
    setNewFieldLabel("");
    setNewFieldType("text");
    setNewFieldOptions("");
    save({ custom_field_schema: next });
  }

  function removeField(id: string) {
    const next = fields.filter((f) => f.id !== id);
    setFields(next);
    save({ custom_field_schema: next });
  }

  function moveField(id: string, dir: -1 | 1) {
    const idx = fields.findIndex((f) => f.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= fields.length) return;
    const next = [...fields];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setFields(next);
    save({ custom_field_schema: next });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ padding: 80 }}>
        <p className="text-[14px] text-[var(--color-text-tertiary)]">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="flex" style={{ padding: "32px 40px", gap: 40, minHeight: "calc(100vh - 0px)" }}>
      {/* Tab nav */}
      <nav className="shrink-0" style={{ width: 180 }}>
        <h1 className="text-[20px] font-semibold text-[var(--color-text-primary)]" style={{ marginBottom: 24 }}>Settings</h1>
        <div className="space-y-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="w-full text-left rounded-lg text-[13px] font-medium transition-colors cursor-pointer"
              style={{
                padding: "8px 12px",
                background: tab === t.id ? "var(--color-surface-hover)" : "transparent",
                color: tab === t.id ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1" style={{ maxWidth: 640 }}>
        {/* Sources tab */}
        {tab === "sources" && (
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Lead Sources</h2>
            <p className="text-[13px] text-[var(--color-text-tertiary)]" style={{ marginTop: 4, marginBottom: 24 }}>
              Define where your contacts come from. These appear as a dropdown when adding contacts.
            </p>

            {/* Existing sources */}
            <div className="space-y-2" style={{ marginBottom: 20 }}>
              {sources.length === 0 && (
                <p className="text-[13px] text-[var(--color-text-tertiary)] italic">No sources defined yet.</p>
              )}
              {sources.map((s) => (
                <div key={s} className="flex items-center justify-between rounded-lg border border-[var(--color-border)]" style={{ padding: "8px 14px" }}>
                  <span className="text-[13px] text-[var(--color-text-primary)]">{s}</span>
                  <button
                    onClick={() => removeSource(s)}
                    className="text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] transition-colors cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Add source */}
            <div className="flex gap-2">
              <input
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSource()}
                placeholder="e.g. Referral, Website, Cold Call"
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40 transition-colors"
                style={{ padding: "8px 12px" }}
              />
              <button
                onClick={addSource}
                disabled={!newSource.trim() || saving}
                className="rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-30 transition-colors cursor-pointer"
                style={{ padding: "8px 20px" }}
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* Contact Fields tab */}
        {tab === "fields" && (
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Custom Contact Fields</h2>
            <p className="text-[13px] text-[var(--color-text-tertiary)]" style={{ marginTop: 4, marginBottom: 24 }}>
              Add custom fields that appear on every contact. Fields like name, phone, and email are built-in.
            </p>

            {/* Existing fields */}
            <div className="space-y-2" style={{ marginBottom: 24 }}>
              {fields.length === 0 && (
                <p className="text-[13px] text-[var(--color-text-tertiary)] italic">No custom fields defined yet.</p>
              )}
              {fields.map((f, i) => (
                <div key={f.id} className="flex items-center gap-3 rounded-lg border border-[var(--color-border)]" style={{ padding: "10px 14px" }}>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveField(f.id, -1)} disabled={i === 0} className="text-[var(--color-text-tertiary)] disabled:opacity-20 cursor-pointer hover:text-[var(--color-text-primary)]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6"/></svg>
                    </button>
                    <button onClick={() => moveField(f.id, 1)} disabled={i === fields.length - 1} className="text-[var(--color-text-tertiary)] disabled:opacity-20 cursor-pointer hover:text-[var(--color-text-primary)]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{f.label}</p>
                    <p className="text-[11px] text-[var(--color-text-tertiary)]">
                      {FIELD_TYPES.find((t) => t.value === f.type)?.label ?? f.type}
                      {f.options && f.options.length > 0 ? ` · ${f.options.join(", ")}` : ""}
                      {f.required ? " · Required" : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => removeField(f.id)}
                    className="text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] transition-colors cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Add field */}
            <div className="rounded-xl border border-[var(--color-border)]" style={{ padding: "16px 20px" }}>
              <p className="text-[12px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ marginBottom: 12 }}>Add Field</p>
              <div className="flex flex-wrap gap-3">
                <input
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  placeholder="Field name"
                  className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40"
                  style={{ padding: "8px 12px", minWidth: 160 }}
                />
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as CustomFieldType)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] cursor-pointer focus:outline-none"
                  style={{ padding: "8px 12px" }}
                >
                  {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {newFieldType === "select" && (
                <input
                  value={newFieldOptions}
                  onChange={(e) => setNewFieldOptions(e.target.value)}
                  placeholder="Options (comma separated)"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40"
                  style={{ padding: "8px 12px", marginTop: 8 }}
                />
              )}
              <button
                onClick={addField}
                disabled={!newFieldLabel.trim() || saving}
                className="rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-30 transition-colors cursor-pointer"
                style={{ padding: "8px 20px", marginTop: 12 }}
              >
                Add Field
              </button>
            </div>
          </div>
        )}

        {/* Placeholder tabs */}
        {!["sources", "fields"].includes(tab) && (
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">{TABS.find((t) => t.id === tab)?.label}</h2>
            <div
              className="rounded-xl border border-dashed border-[var(--color-border)] text-center text-[14px] text-[var(--color-text-tertiary)]"
              style={{ padding: "60px 24px", marginTop: 24 }}
            >
              Coming soon
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
