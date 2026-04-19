"use client";

import { useState, useEffect, useCallback } from "react";
import type { CustomFieldDef, CustomFieldType } from "@/lib/types/database";

type Tab = "general" | "team" | "fields" | "sources" | "pipelines" | "comms" | "commissions" | "billing";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "team", label: "Team" },
  { id: "fields", label: "Contact Fields" },
  { id: "sources", label: "Sources" },
  { id: "pipelines", label: "Pipelines" },
  { id: "comms", label: "Communications" },
  { id: "commissions", label: "Commissions" },
  { id: "billing", label: "Billing" },
];

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes / No" },
  { value: "select", label: "Dropdown" },
  { value: "address", label: "Address" },
  { value: "checklist", label: "Checklist" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("sources");
  const [orgName, setOrgName] = useState("");
  const [orgVertical, setOrgVertical] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [pipelines, setPipelines] = useState<string[]>([]);
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSource, setNewSource] = useState("");
  const [newPipeline, setNewPipeline] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>("text");
  const [newFieldOptions, setNewFieldOptions] = useState("");
  const [newFieldItems, setNewFieldItems] = useState("");
  // Communications state
  const [orgPhone, setOrgPhone] = useState<string | null>(null);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [provisioningNumber, setProvisioningNumber] = useState(false);
  const [areaCode, setAreaCode] = useState("");
  const [phoneMode, setPhoneMode] = useState<"buy" | "existing">("buy");
  const [existingNumber, setExistingNumber] = useState("");
  const [importingNumber, setImportingNumber] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  // 10DLC registration state
  const [tcrBrandId, setTcrBrandId] = useState<string | null>(null);
  const [tcrBrandStatus, setTcrBrandStatus] = useState<string | null>(null);
  const [tcrCampaignId, setTcrCampaignId] = useState<string | null>(null);
  const [tcrCampaignStatus, setTcrCampaignStatus] = useState<string | null>(null);
  const [tcrStep, setTcrStep] = useState<"brand" | "campaign">("brand");
  const [tcrSubmitting, setTcrSubmitting] = useState(false);
  const [tcrError, setTcrError] = useState<string | null>(null);
  // Brand form
  const [tcrEntityType, setTcrEntityType] = useState("PRIVATE_PROFIT");
  const [tcrDisplayName, setTcrDisplayName] = useState("");
  const [tcrCompanyName, setTcrCompanyName] = useState("");
  const [tcrEin, setTcrEin] = useState("");
  const [tcrPhone, setTcrPhone] = useState("");
  const [tcrEmail, setTcrEmail] = useState("");
  const [tcrStreet, setTcrStreet] = useState("");
  const [tcrCity, setTcrCity] = useState("");
  const [tcrState, setTcrState] = useState("");
  const [tcrZip, setTcrZip] = useState("");
  const [tcrVertical, setTcrVertical] = useState("TECHNOLOGY");
  const [tcrWebsite, setTcrWebsite] = useState("");
  // Campaign form
  const [tcrUsecase, setTcrUsecase] = useState("CUSTOMER_CARE");
  const [tcrDescription, setTcrDescription] = useState("");
  const [tcrMessageFlow, setTcrMessageFlow] = useState("");
  const [tcrSample1, setTcrSample1] = useState("");
  const [tcrSample2, setTcrSample2] = useState("");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/org");
      const data = await res.json();
      setOrgName(data.name ?? "");
      setOrgVertical(data.vertical ?? "");
      setSources(data.source_options ?? []);
      setPipelines(data.pipeline_options ?? []);
      setFields(data.custom_field_schema ?? []);
      setOrgPhone(data.telnyx_phone ?? null);
      const smtp = data.smtp_config ?? {};
      setSmtpHost(smtp.host ?? "");
      setSmtpPort(String(smtp.port ?? 587));
      setSmtpUser(smtp.user ?? "");
      setSmtpPass(smtp.pass ?? "");
      setSmtpFromName(smtp.from_name ?? "");
      setSmtpFromEmail(smtp.from_email ?? "");
      setTcrBrandId(data.tcr_brand_id ?? null);
      setTcrBrandStatus(data.tcr_brand_status ?? null);
      setTcrCampaignId(data.tcr_campaign_id ?? null);
      setTcrCampaignStatus(data.tcr_campaign_status ?? null);
      if (data.tcr_brand_id) setTcrStep("campaign");
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

  function addPipeline() {
    const p = newPipeline.trim();
    if (!p || pipelines.includes(p)) return;
    const next = [...pipelines, p];
    setPipelines(next);
    setNewPipeline("");
    save({ pipeline_options: next });
  }

  function removePipeline(p: string) {
    const next = pipelines.filter((x) => x !== p);
    setPipelines(next);
    save({ pipeline_options: next });
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
      ...(newFieldType === "checklist" && newFieldItems.trim()
        ? { items: newFieldItems.split(",").map((o) => o.trim()).filter(Boolean) }
        : {}),
    };
    const next = [...fields, def];
    setFields(next);
    setNewFieldLabel("");
    setNewFieldType("text");
    setNewFieldOptions("");
    setNewFieldItems("");
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
        {/* General tab */}
        {tab === "general" && (
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">General</h2>
            <p className="text-[13px] text-[var(--color-text-tertiary)]" style={{ marginTop: 4, marginBottom: 24 }}>
              Basic information about your organization. This is used to personalize the AI agent.
            </p>
            <div className="space-y-5" style={{ maxWidth: 480 }}>
              <div>
                <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 6 }}>Company Name</label>
                <input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Your company name"
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40 transition-colors"
                  style={{ padding: "10px 12px" }}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 6 }}>Industry</label>
                <select
                  value={orgVertical}
                  onChange={(e) => setOrgVertical(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]/40 transition-colors appearance-none cursor-pointer"
                  style={{ padding: "10px 12px" }}
                >
                  <option value="" disabled>Select your industry</option>
                  <option value="solar">Solar</option>
                  <option value="roofing">Roofing</option>
                  <option value="construction">Construction</option>
                  <option value="hvac">HVAC</option>
                  <option value="pest_control">Pest Control</option>
                  <option value="landscaping">Landscaping</option>
                  <option value="real_estate">Real Estate</option>
                  <option value="insurance">Insurance</option>
                  <option value="financial_services">Financial Services</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="saas">SaaS / Software</option>
                  <option value="marketing_agency">Marketing Agency</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <button
                onClick={() => save({ name: orgName.trim(), vertical: orgVertical })}
                disabled={saving || !orgName.trim() || !orgVertical}
                className="rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-30 transition-colors cursor-pointer"
                style={{ padding: "9px 24px" }}
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        )}

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

        {/* Pipelines tab */}
        {tab === "pipelines" && (
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Pipelines</h2>
            <p className="text-[13px] text-[var(--color-text-tertiary)]" style={{ marginTop: 4, marginBottom: 24 }}>
              Define your deal tracks or pipeline types. These appear as a dropdown on every contact.
            </p>

            <div className="space-y-2" style={{ marginBottom: 20 }}>
              {pipelines.length === 0 && (
                <p className="text-[13px] text-[var(--color-text-tertiary)] italic">No pipelines defined yet.</p>
              )}
              {pipelines.map((p) => (
                <div key={p} className="flex items-center justify-between rounded-lg border border-[var(--color-border)]" style={{ padding: "8px 14px" }}>
                  <span className="text-[13px] text-[var(--color-text-primary)]">{p}</span>
                  <button
                    onClick={() => removePipeline(p)}
                    className="text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] transition-colors cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={newPipeline}
                onChange={(e) => setNewPipeline(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPipeline()}
                placeholder="e.g. Enterprise, SMB, Partner"
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40 transition-colors"
                style={{ padding: "8px 12px" }}
              />
              <button
                onClick={addPipeline}
                disabled={!newPipeline.trim() || saving}
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
                      {f.items && f.items.length > 0 ? ` · ${f.items.length} items` : ""}
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

            {/* Presets */}
            <div className="rounded-xl border border-dashed border-[var(--color-border)]" style={{ padding: "16px 20px", marginBottom: 20 }}>
              <p className="text-[12px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ marginBottom: 10 }}>Quick Presets</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (fields.some(f => f.type === "address")) return;
                    const def: CustomFieldDef = { id: crypto.randomUUID(), label: "Address", type: "address" };
                    const next = [...fields, def];
                    setFields(next);
                    save({ custom_field_schema: next });
                  }}
                  disabled={fields.some(f => f.type === "address")}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-30 transition-colors cursor-pointer"
                  style={{ padding: "6px 14px" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  Address
                </button>
                <button
                  onClick={() => {
                    if (fields.some(f => f.label === "Lead Qualifications")) return;
                    const def: CustomFieldDef = { id: crypto.randomUUID(), label: "Lead Qualifications", type: "checklist", items: ["Has budget", "Decision maker", "Timeline defined", "Need identified"] };
                    const next = [...fields, def];
                    setFields(next);
                    save({ custom_field_schema: next });
                  }}
                  disabled={fields.some(f => f.label === "Lead Qualifications")}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-30 transition-colors cursor-pointer"
                  style={{ padding: "6px 14px" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                  Lead Qualifications
                </button>
              </div>
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
              {newFieldType === "checklist" && (
                <input
                  value={newFieldItems}
                  onChange={(e) => setNewFieldItems(e.target.value)}
                  placeholder="Checklist items (comma separated)"
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

        {/* Communications tab */}
        {tab === "comms" && (
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Communications</h2>
            <p className="text-[13px] text-[var(--color-text-tertiary)]" style={{ marginTop: 4, marginBottom: 24 }}>
              Phone and email configuration for your organization.
            </p>

            {/* Phone Section */}
            <div className="rounded-xl border border-[var(--color-border)]" style={{ padding: "20px 24px", marginBottom: 24 }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">Phone Number</h3>
              </div>
              {orgPhone ? (
                <div>
                  <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)]" style={{ padding: "12px 16px" }}>
                    <span className="text-[15px] font-medium text-[var(--color-text-primary)]">{orgPhone}</span>
                    <span className="rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] text-[11px] font-medium" style={{ padding: "2px 10px" }}>Active</span>
                  </div>
                  <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginTop: 8 }}>
                    This is your organization&apos;s shared phone number for calls and SMS.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-[13px] text-[var(--color-text-tertiary)]" style={{ marginBottom: 12 }}>
                    No phone number assigned yet. Provision a new number or connect one you already own in Telnyx.
                  </p>
                  {/* Mode toggle */}
                  <div className="flex gap-1 rounded-lg border border-[var(--color-border)] p-1 w-fit" style={{ marginBottom: 14 }}>
                    <button
                      onClick={() => { setPhoneMode("buy"); setPhoneError(null); }}
                      className="rounded-md text-[12px] font-medium transition-colors cursor-pointer"
                      style={{
                        padding: "5px 14px",
                        background: phoneMode === "buy" ? "var(--color-accent)" : "transparent",
                        color: phoneMode === "buy" ? "white" : "var(--color-text-tertiary)",
                      }}
                    >
                      Buy new number
                    </button>
                    <button
                      onClick={() => { setPhoneMode("existing"); setPhoneError(null); }}
                      className="rounded-md text-[12px] font-medium transition-colors cursor-pointer"
                      style={{
                        padding: "5px 14px",
                        background: phoneMode === "existing" ? "var(--color-accent)" : "transparent",
                        color: phoneMode === "existing" ? "white" : "var(--color-text-tertiary)",
                      }}
                    >
                      Use existing number
                    </button>
                  </div>

                  {phoneMode === "buy" ? (
                    <div className="flex gap-2">
                      <input
                        value={areaCode}
                        onChange={(e) => setAreaCode(e.target.value)}
                        placeholder="Area code (e.g. 415)"
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40"
                        style={{ padding: "8px 12px", width: 160 }}
                      />
                      <button
                        onClick={async () => {
                          setProvisioningNumber(true);
                          setPhoneError(null);
                          try {
                            const res = await fetch("/api/comms/provision-number", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ area_code: areaCode || undefined }),
                            });
                            const data = await res.json();
                            if (data.phone) setOrgPhone(data.phone);
                            else setPhoneError(data.error ?? "Failed to provision number");
                          } catch { setPhoneError("Request failed"); } finally {
                            setProvisioningNumber(false);
                          }
                        }}
                        disabled={provisioningNumber}
                        className="rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors cursor-pointer"
                        style={{ padding: "8px 20px" }}
                      >
                        {provisioningNumber ? "Provisioning..." : "Get Number"}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginBottom: 8 }}>
                        Enter a number already in your Telnyx account. We&apos;ll assign it to the kove connection and messaging profile so calls and SMS route correctly.
                      </p>
                      <div className="flex gap-2">
                        <input
                          value={existingNumber}
                          onChange={(e) => setExistingNumber(e.target.value)}
                          placeholder="+14155551234"
                          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40"
                          style={{ padding: "8px 12px", width: 200 }}
                        />
                        <button
                          onClick={async () => {
                            const num = existingNumber.trim();
                            if (!num) return;
                            setImportingNumber(true);
                            setPhoneError(null);
                            try {
                              const res = await fetch("/api/comms/import-number", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ phone_number: num }),
                              });
                              const data = await res.json();
                              if (data.phone) setOrgPhone(data.phone);
                              else setPhoneError(data.error ?? "Failed to import number");
                            } catch { setPhoneError("Request failed"); } finally {
                              setImportingNumber(false);
                            }
                          }}
                          disabled={importingNumber || !existingNumber.trim()}
                          className="rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors cursor-pointer"
                          style={{ padding: "8px 20px" }}
                        >
                          {importingNumber ? "Connecting..." : "Connect Number"}
                        </button>
                      </div>
                    </div>
                  )}

                  {phoneError && (
                    <p className="text-[12px] text-red-500" style={{ marginTop: 8 }}>{phoneError}</p>
                  )}
                </div>
              )}
            </div>

            {/* 10DLC Registration — only shown once a phone is configured */}
            {orgPhone && (
              <div className="rounded-xl border border-[var(--color-border)]" style={{ padding: "20px 24px", marginBottom: 24 }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12l2 2 4-4"/><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/>
                  </svg>
                  <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">SMS Compliance (10DLC)</h3>
                </div>
                <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginBottom: 16 }}>
                  US carriers require all business SMS to be registered with The Campaign Registry (TCR).
                  Complete brand + campaign registration below so messages are delivered instead of filtered.
                </p>

                {/* Progress steps */}
                <div className="flex items-center gap-2" style={{ marginBottom: 20 }}>
                  {[
                    { key: "brand", label: "1. Brand", done: !!tcrBrandId },
                    { key: "campaign", label: "2. Campaign", done: !!tcrCampaignId },
                  ].map((step, i) => (
                    <div key={step.key} className="flex items-center gap-2">
                      {i > 0 && <div className="w-8 h-px bg-[var(--color-border)]" />}
                      <button
                        onClick={() => { if (step.key === "campaign" && !tcrBrandId) return; setTcrStep(step.key as "brand" | "campaign"); setTcrError(null); }}
                        className="flex items-center gap-1.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer"
                        style={{
                          padding: "4px 12px",
                          background: step.done ? "rgba(34,197,94,0.1)" : tcrStep === step.key ? "var(--color-accent-soft)" : "var(--color-surface)",
                          border: `1px solid ${step.done ? "rgba(34,197,94,0.3)" : tcrStep === step.key ? "var(--color-accent)" : "var(--color-border)"}`,
                          color: step.done ? "#16a34a" : tcrStep === step.key ? "var(--color-accent)" : "var(--color-text-tertiary)",
                        }}
                      >
                        {step.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                        {step.label}
                        {step.done && (
                          <span style={{ marginLeft: 2, opacity: 0.7 }}>
                            {step.key === "brand" ? tcrBrandStatus : tcrCampaignStatus}
                          </span>
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Brand form */}
                {tcrStep === "brand" && !tcrBrandId && (
                  <div>
                    <p className="text-[12px] font-medium text-[var(--color-text-secondary)]" style={{ marginBottom: 12 }}>
                      Register your business with TCR. This must match your legal business registration.
                    </p>
                    <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 12 }}>
                      <div>
                        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>Business Type</label>
                        <select value={tcrEntityType} onChange={(e) => setTcrEntityType(e.target.value)}
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]/40"
                          style={{ padding: "8px 12px" }}>
                          <option value="PRIVATE_PROFIT">Private For-Profit</option>
                          <option value="PUBLIC_PROFIT">Publicly Traded</option>
                          <option value="NON_PROFIT">Non-Profit</option>
                          <option value="GOVERNMENT">Government</option>
                          <option value="SOLE_PROPRIETOR">Sole Proprietor</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>Industry</label>
                        <select value={tcrVertical} onChange={(e) => setTcrVertical(e.target.value)}
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]/40"
                          style={{ padding: "8px 12px" }}>
                          {["TECHNOLOGY","REAL_ESTATE","FINANCIAL","HEALTHCARE","RETAIL","PROFESSIONAL","COMMUNICATION","EDUCATION","INSURANCE","LEGAL","MARKETING","TRANSPORTATION","OTHER"].map(v => (
                            <option key={v} value={v}>{v.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>Display Name</label>
                        <input value={tcrDisplayName} onChange={(e) => setTcrDisplayName(e.target.value)} placeholder="Acme Inc"
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>Legal Company Name</label>
                        <input value={tcrCompanyName} onChange={(e) => setTcrCompanyName(e.target.value)} placeholder="Acme Inc LLC"
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>EIN / Tax ID</label>
                        <input value={tcrEin} onChange={(e) => setTcrEin(e.target.value)} placeholder="12-3456789"
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>Business Phone</label>
                        <input value={tcrPhone} onChange={(e) => setTcrPhone(e.target.value)} placeholder="+12025551234"
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>Business Email</label>
                        <input value={tcrEmail} onChange={(e) => setTcrEmail(e.target.value)} placeholder="contact@company.com"
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>Street Address</label>
                        <input value={tcrStreet} onChange={(e) => setTcrStreet(e.target.value)} placeholder="123 Main St"
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>City</label>
                        <input value={tcrCity} onChange={(e) => setTcrCity(e.target.value)} placeholder="San Francisco"
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>State</label>
                          <input value={tcrState} onChange={(e) => setTcrState(e.target.value)} placeholder="CA" maxLength={2}
                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                        </div>
                        <div className="flex-1">
                          <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>ZIP</label>
                          <input value={tcrZip} onChange={(e) => setTcrZip(e.target.value)} placeholder="94105"
                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>Website (optional)</label>
                        <input value={tcrWebsite} onChange={(e) => setTcrWebsite(e.target.value)} placeholder="https://company.com"
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                      </div>
                    </div>
                    {tcrError && <p className="text-[12px] text-red-500" style={{ marginBottom: 8 }}>{tcrError}</p>}
                    <button
                      onClick={async () => {
                        setTcrSubmitting(true); setTcrError(null);
                        try {
                          const res = await fetch("/api/comms/tcr/brand", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              entityType: tcrEntityType, displayName: tcrDisplayName,
                              companyName: tcrCompanyName, ein: tcrEin, phone: tcrPhone,
                              email: tcrEmail, street: tcrStreet, city: tcrCity,
                              state: tcrState.toUpperCase(), postalCode: tcrZip,
                              vertical: tcrVertical, website: tcrWebsite || undefined,
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok) { setTcrError(data.error ?? "Registration failed"); return; }
                          setTcrBrandId(data.brand_id);
                          setTcrBrandStatus(data.brand_status);
                          setTcrStep("campaign");
                        } catch { setTcrError("Request failed"); }
                        finally { setTcrSubmitting(false); }
                      }}
                      disabled={tcrSubmitting || !tcrDisplayName || !tcrCompanyName || !tcrEin || !tcrPhone || !tcrEmail || !tcrStreet || !tcrCity || !tcrState || !tcrZip}
                      className="rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-30 transition-colors cursor-pointer"
                      style={{ padding: "8px 20px" }}
                    >
                      {tcrSubmitting ? "Submitting..." : "Register Brand"}
                    </button>
                  </div>
                )}

                {/* Brand registered — show status */}
                {tcrBrandId && tcrStep === "brand" && (
                  <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)]" style={{ padding: "12px 16px" }}>
                    <span className="text-[13px] text-[var(--color-text-primary)] font-medium">{tcrBrandId}</span>
                    <span className="rounded-full text-[11px] font-medium" style={{
                      padding: "2px 10px",
                      background: tcrBrandStatus === "VERIFIED" ? "rgba(34,197,94,0.1)" : "rgba(234,179,8,0.1)",
                      color: tcrBrandStatus === "VERIFIED" ? "#16a34a" : "#a16207",
                      border: `1px solid ${tcrBrandStatus === "VERIFIED" ? "rgba(34,197,94,0.3)" : "rgba(234,179,8,0.3)"}`,
                    }}>{tcrBrandStatus ?? "PENDING"}</span>
                    <button onClick={() => setTcrStep("campaign")}
                      className="text-[12px] text-[var(--color-accent)] hover:underline cursor-pointer" style={{ marginLeft: "auto" }}>
                      Next: Campaign →
                    </button>
                  </div>
                )}

                {/* Campaign form */}
                {tcrStep === "campaign" && !tcrCampaignId && (
                  <div>
                    <p className="text-[12px] font-medium text-[var(--color-text-secondary)]" style={{ marginBottom: 12 }}>
                      Describe how you&apos;ll use SMS. Be specific — vague descriptions are rejected.
                    </p>
                    <div className="grid grid-cols-1 gap-3" style={{ marginBottom: 12 }}>
                      <div>
                        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>Use Case</label>
                        <select value={tcrUsecase} onChange={(e) => setTcrUsecase(e.target.value)}
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]/40"
                          style={{ padding: "8px 12px" }}>
                          <option value="CUSTOMER_CARE">Customer Care</option>
                          <option value="MARKETING">Marketing</option>
                          <option value="ACCOUNT_NOTIFICATION">Account Notifications</option>
                          <option value="2FA">Two-Factor Authentication</option>
                          <option value="DELIVERY_NOTIFICATION">Delivery Notifications</option>
                          <option value="FRAUD_ALERT">Fraud Alerts</option>
                          <option value="MIXED">Mixed / General</option>
                          <option value="LOW_VOLUME">Low Volume Mixed</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>Campaign Description</label>
                        <textarea value={tcrDescription} onChange={(e) => setTcrDescription(e.target.value)}
                          placeholder="e.g. CRM platform sending follow-up messages, appointment reminders, and deal updates to existing customers who have opted in via our web form."
                          rows={3}
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40 resize-none"
                          style={{ padding: "8px 12px" }} />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>Message Flow (how recipients opt in)</label>
                        <textarea value={tcrMessageFlow} onChange={(e) => setTcrMessageFlow(e.target.value)}
                          placeholder="e.g. End users provide their phone number and consent to receive SMS messages when signing up on our website at company.com/signup."
                          rows={2}
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40 resize-none"
                          style={{ padding: "8px 12px" }} />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>Sample Message 1</label>
                        <input value={tcrSample1} onChange={(e) => setTcrSample1(e.target.value)}
                          placeholder="Hi [Name], just following up on your inquiry. Are you available for a quick call? Reply STOP to opt out."
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>Sample Message 2</label>
                        <input value={tcrSample2} onChange={(e) => setTcrSample2(e.target.value)}
                          placeholder="Your appointment is confirmed for [Date] at [Time]. Reply STOP to opt out."
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                      </div>
                    </div>
                    {tcrError && <p className="text-[12px] text-red-500" style={{ marginBottom: 8 }}>{tcrError}</p>}
                    <button
                      onClick={async () => {
                        setTcrSubmitting(true); setTcrError(null);
                        try {
                          const res = await fetch("/api/comms/tcr/campaign", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              usecase: tcrUsecase, description: tcrDescription,
                              messageFlow: tcrMessageFlow, sample1: tcrSample1, sample2: tcrSample2,
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok) { setTcrError(data.error ?? "Campaign registration failed"); return; }
                          setTcrCampaignId(data.campaign_id);
                          setTcrCampaignStatus(data.campaign_status);
                        } catch { setTcrError("Request failed"); }
                        finally { setTcrSubmitting(false); }
                      }}
                      disabled={tcrSubmitting || !tcrDescription || !tcrMessageFlow || !tcrSample1 || !tcrSample2}
                      className="rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-30 transition-colors cursor-pointer"
                      style={{ padding: "8px 20px" }}
                    >
                      {tcrSubmitting ? "Submitting..." : "Register Campaign"}
                    </button>
                  </div>
                )}

                {/* Campaign registered — show status */}
                {tcrCampaignId && (
                  <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)]" style={{ padding: "12px 16px", marginTop: tcrStep === "campaign" ? 0 : 12 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tcrCampaignStatus === "ACTIVE" ? "#16a34a" : "#a16207"} strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                    <span className="text-[13px] text-[var(--color-text-primary)] font-medium">Campaign {tcrCampaignId}</span>
                    <span className="rounded-full text-[11px] font-medium" style={{
                      padding: "2px 10px",
                      background: tcrCampaignStatus === "ACTIVE" ? "rgba(34,197,94,0.1)" : "rgba(234,179,8,0.1)",
                      color: tcrCampaignStatus === "ACTIVE" ? "#16a34a" : "#a16207",
                      border: `1px solid ${tcrCampaignStatus === "ACTIVE" ? "rgba(34,197,94,0.3)" : "rgba(234,179,8,0.3)"}`,
                    }}>{tcrCampaignStatus ?? "PENDING"}</span>
                    {tcrCampaignStatus !== "ACTIVE" && (
                      <span className="text-[11px] text-[var(--color-text-tertiary)]" style={{ marginLeft: "auto" }}>
                        Approval takes 1–5 business days
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Email SMTP Section */}
            <div className="rounded-xl border border-[var(--color-border)]" style={{ padding: "20px 24px" }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">Email (SMTP)</h3>
              </div>
              <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginBottom: 16 }}>
                Connect any email account — Gmail, Outlook, or your custom domain. For Gmail, use an App Password (Settings → Security → App Passwords).
              </p>
              <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 12 }}>
                <div>
                  <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>SMTP Host</label>
                  <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>Port</label>
                  <input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>Username / Email</label>
                  <input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="you@company.com"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>Password / App Password</label>
                  <input value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} type="password" placeholder="••••••••"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>From Name</label>
                  <input value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)} placeholder="Acme Sales"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 4 }}>From Email</label>
                  <input value={smtpFromEmail} onChange={(e) => setSmtpFromEmail(e.target.value)} placeholder="sales@company.com"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40" style={{ padding: "8px 12px" }} />
                </div>
              </div>
              <button
                onClick={() => save({
                  smtp_config: {
                    host: smtpHost.trim(),
                    port: parseInt(smtpPort) || 587,
                    user: smtpUser.trim(),
                    pass: smtpPass,
                    from_name: smtpFromName.trim(),
                    from_email: smtpFromEmail.trim(),
                  },
                })}
                disabled={!smtpHost.trim() || !smtpUser.trim() || !smtpPass || saving}
                className="rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-30 transition-colors cursor-pointer"
                style={{ padding: "8px 20px" }}
              >
                {saving ? "Saving..." : "Save Email Settings"}
              </button>
            </div>
          </div>
        )}

        {/* Placeholder tabs */}
        {!['sources', 'fields', 'comms', 'pipelines'].includes(tab) && (
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
