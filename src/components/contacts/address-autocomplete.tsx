"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Suggestion {
  place_id: string;
  display_name: string;
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

  // Sync external value changes
  useEffect(() => { setQuery(value ?? ""); }, [value]);

  const search = useCallback(async (q: string) => {
    if (q.length < 4) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=6&addressdetails=0&q=${encodeURIComponent(q)}`,
        { headers: { "Accept-Language": "en" } }
      );
      const data: Suggestion[] = await res.json();
      setSuggestions(data);
      setOpen(data.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 350);
  }

  function handleSelect(suggestion: Suggestion) {
    setQuery(suggestion.display_name);
    onChange(suggestion.display_name);
    setOpen(false);
    setSuggestions([]);
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
        onBlur={onBlur}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        style={{ width: "100%" }}
      />
      {loading && (
        <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--color-text-tertiary)" }}>
          …
        </div>
      )}
      {open && suggestions.length > 0 && (
        <ul style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 999,
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.18)", maxHeight: 220, overflowY: "auto",
          padding: "4px 0", margin: 0, listStyle: "none",
        }}>
          {suggestions.map((s) => (
            <li
              key={s.place_id}
              onMouseDown={() => handleSelect(s)}
              style={{
                padding: "8px 12px", fontSize: 12, lineHeight: 1.4,
                color: "var(--color-text-primary)", cursor: "pointer",
                borderBottom: "1px solid var(--color-border)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {s.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
