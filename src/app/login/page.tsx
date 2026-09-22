"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { bg, border, fill, ink, inkSoft, navy, surface } from "@/lib/design-tokens";

type Stage = "signin" | "reset";

export default function LoginPage() {
  const router = useRouter();
  // One client instance for the whole page — verifyOtp() and the updateUser()
  // that follows it must run against the same in-memory GoTrueClient (see
  // the identical fix on /auth/set-password).
  const [supabase] = useState(() => createClient());
  const [stage, setStage] = useState<Stage>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
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

  // Sends a 6-digit code instead of a clickable reset link. A link is a
  // one-time token that a lot of corporate email (Microsoft 365 Safe Links
  // and similar) auto-visits to scan every incoming link for malware — that
  // burns the token before the person ever clicks it themselves, so the
  // link always shows "expired" by the time they get to it. A code typed in
  // by hand has nothing for a scanner to click, so it isn't vulnerable to
  // that at all.
  const handleSendCode = async () => {
    if (!email.trim()) {
      setError("Enter your email above first, then tap this again.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo(null);
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setStage("reset");
  };

  const handleResetPassword = async () => {
    if (!code.trim()) {
      setError("Enter the code from your email.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "recovery",
    });
    if (verifyError) {
      setLoading(false);
      setError(verifyError.message);
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  const backToSignIn = () => {
    setStage("signin");
    setError(null);
    setInfo(null);
    setPassword("");
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const inputStyle = {
    border: `1px solid ${border}`,
    color: ink,
    background: fill,
  } as const;

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
            {stage === "signin"
              ? "Sign in to see today's rota, checklists, and updates"
              : "Enter the code we emailed you, plus a new password"}
          </div>
        </div>

        {stage === "signin" ? (
          <>
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
              style={inputStyle}
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
              style={inputStyle}
            />

            {error && (
              <div className="text-xs mb-3" style={{ color: "#000000" }}>
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
              onClick={handleSendCode}
              disabled={loading}
              className="w-full text-xs mt-4 text-center"
              style={{ color: inkSoft }}
            >
              Forgot your password?
            </button>
          </>
        ) : (
          <>
            <div className="text-xs mb-4" style={{ color: inkSoft }}>
              Sent a code to <strong>{email.trim()}</strong>.
            </div>

            <label className="text-xs font-medium block mb-1" style={{ color: inkSoft }}>
              6-digit code
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="w-full text-sm px-4 py-2.5 rounded-full mb-4 outline-none"
              style={inputStyle}
            />

            <label className="text-xs font-medium block mb-1" style={{ color: inkSoft }}>
              New password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full text-sm px-4 py-2.5 rounded-full mb-4 outline-none"
              style={inputStyle}
            />

            <label className="text-xs font-medium block mb-1" style={{ color: inkSoft }}>
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
              placeholder="••••••••"
              className="w-full text-sm px-4 py-2.5 rounded-full mb-4 outline-none"
              style={inputStyle}
            />

            {error && (
              <div className="text-xs mb-3" style={{ color: "#000000" }}>
                {error}
              </div>
            )}

            <button
              onClick={handleResetPassword}
              disabled={loading}
              className="w-full text-sm font-medium py-3 rounded-full disabled:opacity-60"
              style={{ background: navy, color: "#FFFFFF" }}
            >
              {loading ? "Saving…" : "Reset password"}
            </button>

            <div className="flex items-center justify-between mt-4">
              <button onClick={handleSendCode} disabled={loading} className="text-xs" style={{ color: inkSoft }}>
                Resend code
              </button>
              <button onClick={backToSignIn} disabled={loading} className="text-xs" style={{ color: inkSoft }}>
                Back to sign in
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
