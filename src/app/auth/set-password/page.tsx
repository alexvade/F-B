"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { bg, border, ink, inkSoft, navy, surface } from "@/lib/design-tokens";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
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
            Set your password
          </div>
          <div className="text-sm" style={{ color: inkSoft }}>
            Choose a password for your Team Ops account.
          </div>
        </div>

        <label className="text-xs font-medium block mb-1" style={{ color: inkSoft }}>
          New password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full text-sm px-4 py-2.5 rounded-full mb-4 outline-none"
          style={{ border: `1px solid ${border}`, color: ink, background: bg }}
        />

        <label className="text-xs font-medium block mb-1" style={{ color: inkSoft }}>
          Confirm password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="••••••••"
          className="w-full text-sm px-4 py-2.5 rounded-full mb-4 outline-none"
          style={{ border: `1px solid ${border}`, color: ink, background: bg }}
        />

        {error && (
          <div className="text-xs mb-3" style={{ color: "#C24A3B" }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full text-sm font-medium py-3 rounded-full disabled:opacity-60"
          style={{ background: navy, color: "#FFFFFF" }}
        >
          {loading ? "Saving…" : "Save password"}
        </button>
      </div>
    </div>
  );
}
