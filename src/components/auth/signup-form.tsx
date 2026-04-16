"use client";

import { useState } from "react";
import Link from "next/link";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [vertical, setVertical] = useState("solar");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Create org + user via server-side API (uses service role to bypass RLS)
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, orgName, vertical }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Signup failed");
        setLoading(false);
        return;
      }

      // Session cookie set server-side — hard redirect so middleware sees it
      window.location.href = "/";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} action="/api/auth/signup" method="POST" className="space-y-4">
      {error && (
        <div className="rounded-md border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <label htmlFor="fullName" className="text-sm font-medium text-[var(--color-text-primary)]">
          Full Name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          placeholder="First Name Last Name"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="orgName" className="text-sm font-medium text-[var(--color-text-primary)]">
          Company Name
        </label>
        <input
          id="orgName"
          name="orgName"
          type="text"
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          required
          placeholder="Your Company"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="vertical" className="text-sm font-medium text-[var(--color-text-primary)]">
          Industry
        </label>
        <select
          id="vertical"
          name="vertical"
          value={vertical}
          onChange={(e) => setVertical(e.target.value)}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        >
          <option value="solar">Solar</option>
          <option value="roofing">Roofing</option>
          <option value="construction">Construction</option>
          <option value="hvac">HVAC</option>
          <option value="pest_control">Pest Control</option>
          <option value="landscaping">Landscaping</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor="signupEmail" className="text-sm font-medium text-[var(--color-text-primary)]">
          Email
        </label>
        <input
          id="signupEmail"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@company.com"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="signupPassword" className="text-sm font-medium text-[var(--color-text-primary)]">
          Password
        </label>
        <input
          id="signupPassword"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          placeholder="••••••••"
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-[var(--color-accent-text)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
      >
        {loading ? "Creating account..." : "Create Account"}
      </button>
      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--color-accent)] hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
