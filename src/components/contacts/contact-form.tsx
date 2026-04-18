"use client";

import { useState, useEffect, useCallback } from "react";
import type { Contact, ContactStatus, CustomFieldDef, Json } from "@/lib/types/database";
import { AddressAutocomplete } from "./address-autocomplete";

const STATUS_OPTIONS: { value: ContactStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "qualifying", label: "Qualifying" },
  { value: "qualified", label: "Qualified" },
  { value: "closing", label: "Closing" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "renewal", label: "Renewal" },
];

interface ContactFormProps {
  contact: Contact | null; // null = create
  onClose: () => void;
  onSaved: () => void;
}

export function ContactForm({ contact, onClose, onSaved }: ContactFormProps) {
  const [name, setName] = useState(contact?.name ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [source, setSource] = useState(contact?.source ?? "");
  const [status, setStatus] = useState<ContactStatus>(contact?.status ?? "new");
  const [pipelineStage, setPipelineStage] = useState(contact?.pipeline_stage ?? "");
  const [customValues, setCustomValues] = useState<Record<string, Json>>(() => {
    if (contact?.custom_fields && typeof contact.custom_fields === "object" && !Array.isArray(contact.custom_fields)) {
      return contact.custom_fields as Record<string, Json>;
    }
    return {};
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Org settings
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [pipelineOptions, setPipelineOptions] = useState<string[]>([]);
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/org");
      const data = await res.json();
      setSourceOptions(data.source_options ?? []);
      setPipelineOptions(data.pipeline_options ?? []);
      setCustomFieldDefs(data.custom_field_schema ?? []);
    } catch { /* silent */ } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");

    try {
      const body = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        source: source || null,
        status,
        pipeline_stage: pipelineStage.trim() || null,
        custom_fields: customValues,
      };

      const res = contact
        ? await fetch(`/api/contacts/${contact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save contact");
    } finally {
      setSaving(false);
    }
  }

  function setCustomValue(fieldId: string, value: Json) {
    setCustomValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <div
        className="fixed z-50 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-xl"
        style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 480, maxHeight: "80vh", overflow: "auto" }}
      >
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between border-b border-[var(--color-border)]" style={{ padding: "16px 24px" }}>
            <h2 className="text-[16px] font-semibold text-[var(--color-text-primary)]">
              {contact ? "Edit Contact" : "New Contact"}
            </h2>
            <button type="button" onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <div style={{ padding: "20px 24px" }} className="space-y-4">
            {error && (
              <div className="rounded-lg text-[13px] font-medium" style={{ padding: "8px 12px", background: "var(--color-error-soft)", color: "var(--color-error)" }}>
                {error}
              </div>
            )}

            <Field label="Name *" value={name} onChange={setName} placeholder="Full name" />
            <Field label="Phone" value={phone} onChange={setPhone} placeholder="(555) 123-4567" />
            <Field label="Email" value={email} onChange={setEmail} placeholder="email@example.com" type="email" />

            {/* Source — dropdown from org settings */}
            <div>
              <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ marginBottom: 6, display: "block" }}>Source</label>
              {loadingSettings ? (
                <div className="text-[12px] text-[var(--color-text-tertiary)]">Loading...</div>
              ) : sourceOptions.length > 0 ? (
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]/40 cursor-pointer"
                  style={{ padding: "8px 12px" }}
                >
                  <option value="">Select source</option>
                  {sourceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <div>
                  <input
                    type="text"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="e.g. Referral"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40 transition-colors"
                    style={{ padding: "8px 12px" }}
                  />
                  <p className="text-[11px] text-[var(--color-text-tertiary)]" style={{ marginTop: 4 }}>
                    Tip: Define sources in Settings → Sources for consistent tracking.
                  </p>
                </div>
              )}
            </div>

            {/* Pipeline — dropdown from org settings */}
            <div>
              <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ marginBottom: 6, display: "block" }}>Pipeline</label>
              {loadingSettings ? (
                <div className="text-[12px] text-[var(--color-text-tertiary)]">Loading...</div>
              ) : pipelineOptions.length > 0 ? (
                <select
                  value={pipelineStage}
                  onChange={(e) => setPipelineStage(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]/40 cursor-pointer"
                  style={{ padding: "8px 12px" }}
                >
                  <option value="">Select pipeline</option>
                  {pipelineOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <div>
                  <input
                    type="text"
                    value={pipelineStage}
                    onChange={(e) => setPipelineStage(e.target.value)}
                    placeholder="e.g. Enterprise"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40 transition-colors"
                    style={{ padding: "8px 12px" }}
                  />
                  <p className="text-[11px] text-[var(--color-text-tertiary)]" style={{ marginTop: 4 }}>
                    Tip: Define pipelines in Settings → Pipelines for consistent tracking.
                  </p>
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ marginBottom: 6, display: "block" }}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ContactStatus)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]/40 cursor-pointer"
                style={{ padding: "8px 12px" }}
              >
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Custom fields — dynamically rendered from org schema */}
            {customFieldDefs.length > 0 && (
              <div>
                <div className="border-t border-[var(--color-border)]" style={{ marginTop: 8, paddingTop: 16 }}>
                  <p className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ marginBottom: 12 }}>Custom Fields</p>
                  <div className="space-y-4">
                    {customFieldDefs.map((def) => (
                      <CustomField
                        key={def.id}
                        def={def}
                        value={customValues[def.id]}
                        onChange={(v) => setCustomValue(def.id, v)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)]" style={{ padding: "16px 24px" }}>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--color-border)] text-[13px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
              style={{ padding: "8px 20px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors cursor-pointer"
              style={{ padding: "8px 20px" }}
            >
              {saving ? "Saving..." : contact ? "Save Changes" : "Create Contact"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ marginBottom: 6, display: "block" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40 transition-colors"
        style={{ padding: "8px 12px" }}
      />
    </div>
  );
}

function CustomField({ def, value, onChange }: { def: CustomFieldDef; value: Json | undefined; onChange: (v: Json) => void }) {
  const label = `${def.label}${def.required ? " *" : ""}`;

  if (def.type === "boolean") {
    return (
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="cursor-pointer accent-[var(--color-accent)]"
        />
        <label className="text-[13px] text-[var(--color-text-primary)]">{def.label}</label>
      </div>
    );
  }

  if (def.type === "address") {
    return (
      <div>
        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ marginBottom: 6, display: "block" }}>{label}</label>
        <AddressAutocomplete
          value={String(value ?? "")}
          onChange={(v) => onChange(v || null)}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]/40"
          style={{ padding: "8px 12px" }}
        />
      </div>
    );
  }

  if (def.type === "select" && def.options) {
    return (
      <div>
        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ marginBottom: 6, display: "block" }}>{label}</label>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]/40 cursor-pointer"
          style={{ padding: "8px 12px" }}
        >
          <option value="">Select...</option>
          {def.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  return (
    <Field
      label={label}
      value={String(value ?? "")}
      onChange={(v) => onChange(def.type === "number" ? (v ? Number(v) : null) : v || null)}
      placeholder={def.label}
      type={def.type === "number" ? "number" : "text"}
    />
  );
}
