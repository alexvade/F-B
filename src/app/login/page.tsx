"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { bg, border, ink, inkSoft, navy, surface } from "@/lib/design-tokens";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Enter your email above first, then tap this again.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/set-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo("Check your email for a reset link.");
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen w-full px-4"
      style={{ background: bg }}
    >
      <div
        className="w-full max-w-sm p-8 rounded-2xl"
        style={{ background: surface, border: `1px solid ${border}` }}
      >
        <div className="mb-6">
          <div className="text-base font-semibold" style={{ color: ink }}>
            Team Ops
          </div>
          <div className="text-sm" style={{ color: inkSoft }}>
            Sign in to see today&apos;s rota, checklists, and updates
          </div>
        </div>

        <label className="text-xs font-medium block mb-1" style={{ color: inkSoft }}>
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          placeholder="you@venue.com"
          className="w-full text-sm px-4 py-2.5 rounded-full mb-4 outline-none"
          style={{ border: `1px solid ${border}`, color: ink, background: bg }}
        />

        <label className="text-xs font-medium block mb-1" style={{ color: inkSoft }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          placeholder="••••••••"
          className="w-full text-sm px-4 py-2.5 rounded-full mb-4 outline-none"
          style={{ border: `1px solid ${border}`, color: ink, background: bg }}
        />

        {error && (
          <div className="text-xs mb-3" style={{ color: "#C24A3B" }}>
            {error}
          </div>
        )}
        {info && (
          <div className="text-xs mb-3" style={{ color: navy }}>
            {info}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full text-sm font-medium py-3 rounded-full disabled:opacity-60"
          style={{ background: navy, color: "#FFFFFF" }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <button
          onClick={handleForgotPassword}
          disabled={loading}
          className="w-full text-xs mt-4 text-center"
          style={{ color: inkSoft }}
        >
          Forgot your password?
        </button>
      </div>
    </div>
  );
}
