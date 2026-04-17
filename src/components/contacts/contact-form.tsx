"use client";

import { useState } from "react";
import type { Contact, ContactStatus } from "@/lib/types/database";

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
  contact: Contact | null; // null = create, non-null = edit
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
        source: source.trim() || null,
        status,
        pipeline_stage: pipelineStage.trim() || null,
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
            <Field label="Source" value={source} onChange={setSource} placeholder="e.g. Referral, Website, Cold call" />
            <Field label="Pipeline Stage" value={pipelineStage} onChange={setPipelineStage} placeholder="e.g. Initial Contact" />

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
