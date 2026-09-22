"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { bg, border, fill, ink, inkSoft, navy, surface } from "@/lib/design-tokens";

export default function SetPasswordPage() {
  const router = useRouter();
  // One client instance for the whole page — setSession() below and
  // updateUser() in handleSubmit must run against the same in-memory
  // GoTrueClient. A second createClient() call is a fresh instance that
  // depends on having already re-read the first one's session from cookies,
  // which isn't guaranteed to have landed yet, and reproduced "Auth session
  // missing!" even after setSession() had already succeeded.
  const [supabase] = useState(() => createClient());
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Invite/recovery emails land here with the session in the URL's hash
  // fragment (#access_token=...&refresh_token=...), not a ?code= param.
  // This app's Supabase client is PKCE-only (@supabase/ssr hardcodes
  // flowType: "pkce"), and its automatic hash-detection on init explicitly
  // rejects an implicit-style callback when flowType is PKCE — it doesn't
  // silently ignore it, it throws and discards the session entirely, which
  // is what produced "Auth session missing!" here. Read the hash ourselves
  // and hand it to setSession(), which has no such flow-type check.
  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const linkError = params.get("error_description");

    if (linkError) {
      setError(linkError.replace(/\+/g, " "));
      return;
    }
    if (!accessToken || !refreshToken) {
      setError("This link is invalid or has expired — ask an admin to send a new one.");
      return;
    }

    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) {
        setError(error.message);
        return;
      }
      window.history.replaceState(null, "", window.location.pathname);
      setSessionReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          style={{ border: `1px solid ${border}`, color: ink, background: fill }}
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
          style={{ border: `1px solid ${border}`, color: ink, background: fill }}
        />

        {error && (
          <div className="text-xs mb-3" style={{ color: "#000000" }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !sessionReady}
          className="w-full text-sm font-medium py-3 rounded-full disabled:opacity-60"
          style={{ background: navy, color: "#FFFFFF" }}
        >
          {loading ? "Saving…" : sessionReady ? "Save password" : "Verifying your link…"}
        </button>
      </div>
    </div>
  );
}
