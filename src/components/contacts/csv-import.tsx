"use client";

import { useState, useRef } from "react";

interface CsvImportProps {
  onClose: () => void;
  onImported: () => void;
}

const CONTACT_FIELDS = [
  { value: "", label: "— Skip —" },
  { value: "name", label: "Name" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "source", label: "Source" },
  { value: "status", label: "Status" },
  { value: "pipeline_stage", label: "Pipeline Stage" },
];

export function CsvImport({ onClose, onImported }: CsvImportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"upload" | "map">("upload");

  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) { setError("CSV must have a header row and at least one data row"); return; }
    const h = lines[0].split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    const r = lines.slice(1).map((l) => l.split(",").map((s) => s.trim().replace(/^"|"$/g, "")));
    setHeaders(h);
    setRows(r);

    // Auto-map by fuzzy header match
    const auto: Record<number, string> = {};
    h.forEach((header, i) => {
      const low = header.toLowerCase().replace(/[^a-z]/g, "");
      if (low.includes("name") || low.includes("fullname")) auto[i] = "name";
      else if (low.includes("phone") || low.includes("mobile") || low.includes("cell")) auto[i] = "phone";
      else if (low.includes("email") || low.includes("mail")) auto[i] = "email";
      else if (low.includes("source") || low.includes("origin") || low.includes("lead")) auto[i] = "source";
      else if (low.includes("status")) auto[i] = "status";
      else if (low.includes("stage") || low.includes("pipeline")) auto[i] = "pipeline_stage";
    });
    setMapping(auto);
    setStep("map");
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => parseCSV(ev.target?.result as string);
    reader.readAsText(file);
  }

  async function handleImport() {
    const nameCol = Object.entries(mapping).find(([, v]) => v === "name");
    if (!nameCol) { setError("You must map at least a Name column"); return; }
    setImporting(true);
    setError("");

    try {
      const mapped = rows.map((row) => {
        const obj: Record<string, string> = {};
        Object.entries(mapping).forEach(([colIdx, field]) => {
          if (field && row[Number(colIdx)]) obj[field] = row[Number(colIdx)];
        });
        return obj;
      }).filter((r) => r.name);

      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: mapped, mapping }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Import failed");
      }
      onImported();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const preview = rows.slice(0, 5);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <div
        className="fixed z-50 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-xl"
        style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 600, maxHeight: "85vh", overflow: "auto" }}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)]" style={{ padding: "16px 24px" }}>
          <h2 className="text-[16px] font-semibold text-[var(--color-text-primary)]">Import Contacts from CSV</h2>
          <button onClick={onClose} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {error && (
            <div className="rounded-lg text-[13px] font-medium" style={{ padding: "8px 12px", marginBottom: 16, background: "var(--color-error-soft)", color: "var(--color-error)" }}>
              {error}
            </div>
          )}

          {step === "upload" && (
            <div
              className="border-2 border-dashed border-[var(--color-border)] rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[var(--color-accent)]/40 transition-colors"
              style={{ padding: "48px 24px" }}
              onClick={() => fileRef.current?.click()}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p className="text-[14px] font-medium text-[var(--color-text-primary)]" style={{ marginTop: 12 }}>Click to upload CSV</p>
              <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginTop: 4 }}>.csv files only</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </div>
          )}

          {step === "map" && (
            <>
              <p className="text-[13px] text-[var(--color-text-secondary)]" style={{ marginBottom: 16 }}>
                Map your CSV columns to contact fields. {rows.length} row{rows.length !== 1 ? "s" : ""} found.
              </p>

              <div className="space-y-2" style={{ marginBottom: 20 }}>
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[13px] text-[var(--color-text-primary)] truncate" style={{ width: 160 }}>{h}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                    <select
                      value={mapping[i] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [i]: e.target.value }))}
                      className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] cursor-pointer focus:outline-none"
                      style={{ padding: "6px 10px" }}
                    >
                      {CONTACT_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {preview.length > 0 && (
                <>
                  <p className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ marginBottom: 8 }}>Preview (first {preview.length} rows)</p>
                  <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="bg-[var(--color-surface-hover)]">
                          {headers.map((h, i) => (
                            <th key={i} className="text-left font-medium text-[var(--color-text-tertiary)] whitespace-nowrap" style={{ padding: "6px 10px" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, ri) => (
                          <tr key={ri} className="border-t border-[var(--color-border)]">
                            {row.map((cell, ci) => (
                              <td key={ci} className="text-[var(--color-text-secondary)] whitespace-nowrap truncate" style={{ padding: "6px 10px", maxWidth: 150 }}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)]" style={{ padding: "16px 24px" }}>
          {step === "map" && (
            <button
              onClick={() => { setStep("upload"); setHeaders([]); setRows([]); setMapping({}); }}
              className="rounded-lg border border-[var(--color-border)] text-[13px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
              style={{ padding: "8px 20px", marginRight: "auto" }}
            >
              Change File
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] text-[13px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
            style={{ padding: "8px 20px" }}
          >
            Cancel
          </button>
          {step === "map" && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors cursor-pointer"
              style={{ padding: "8px 20px" }}
            >
              {importing ? "Importing..." : `Import ${rows.length} Contact${rows.length !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
