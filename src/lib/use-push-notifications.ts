"use client";

import { useEffect, useState } from "react";

// The Push API needs the VAPID public key as a raw byte array, not the
// base64url string it's stored/shared as everywhere else.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// Shared by Settings (the manual toggle) and NotificationPrompt (the
// on-open nudge) so the subscribe/unsubscribe flow only lives in one place.
export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    setSupported(ok);
    if (!ok) {
      setReady(true);
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const enable = async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setError("Notifications aren't set up for this app yet.");
        return false;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notifications were blocked — check your browser's site settings.");
        return false;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error("Couldn't save that subscription.");
      setEnabled(true);
      return true;
    } catch (err) {
      setError((err as Error).message || "Couldn't enable notifications.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const disable = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEnabled(false);
    } catch (err) {
      setError((err as Error).message || "Couldn't disable notifications.");
    } finally {
      setBusy(false);
    }
  };

  return { supported, ready, enabled, busy, error, enable, disable };
}
