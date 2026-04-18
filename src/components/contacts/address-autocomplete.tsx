"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Suggestion {
  id: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function AddressAutocomplete({ value, onChange, onBlur, placeholder = "Start typing an address…", className, style }: Props) {
  const [query, setQuery] = useState(value ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Track whether the user is actively editing so we don't clobber their input
  const isTypingRef = useRef(false);

  // Only sync external value changes when the field is not being edited
  useEffect(() => {
    if (!isTypingRef.current) {
      setQuery(value ?? "");
    }
  }, [value]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      // Photon (Komoot) — Elasticsearch on OSM, much better residential coverage than Nominatim
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=7&lang=en`,
        { headers: { "Accept": "application/json" } }
      );
      const data = await res.json();
      const items: Suggestion[] = (data.features ?? []).map((f: Record<string, unknown>) => {
        const p = f.properties as Record<string, string>;
        const parts = [
          p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street ?? p.name,
          p.city ?? p.town ?? p.village,
          p.state,
          p.country,
        ].filter(Boolean);
        return { id: String(f.id ?? Math.random()), label: parts.join(", ") };
      }).filter((s: Suggestion) => s.label);
      setSuggestions(items);
      setOpen(items.length > 0);
    } catch {
      setSuggestions([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    isTypingRef.current = true;
    setQuery(v);
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 400);
  }

  function handleSelect(suggestion: Suggestion) {
    isTypingRef.current = false;
    setQuery(suggestion.label);
    onChange(suggestion.label);
    setOpen(false);
    setSuggestions([]);
  }

  function handleBlur() {
    isTypingRef.current = false;
    onBlur?.();
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", ...style }}>
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        style={{ width: "100%" }}
      />
      {loading && (
        <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--color-text-tertiary)", pointerEvents: "none" }}>
          …
        </div>
      )}
      {open && suggestions.length > 0 && (
        <ul style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999,
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.22)", maxHeight: 240, overflowY: "auto",
          padding: "4px 0", margin: 0, listStyle: "none",
        }}>
          {suggestions.map((s) => (
            <li
              key={s.id}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
              style={{
                padding: "9px 14px", fontSize: 12, lineHeight: 1.4,
                color: "var(--color-text-primary)", cursor: "pointer",
                borderBottom: "1px solid var(--color-border)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
