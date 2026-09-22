"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// One shared Realtime Presence channel every signed-in tab joins (via
// NavShell, so it covers the whole app) — Supabase merges presence state
// across every client subscribed to the same channel name automatically.
const PRESENCE_TOPIC = "presence:app";

// How stale `lastActiveAt` can be before someone's bucketed as "idle"
// instead of "online" — still connected, just not doing anything.
const IDLE_AFTER_MS = 3 * 60 * 1000;

// How often an open (but possibly inactive) tab re-broadcasts its presence,
// and the minimum gap between two activity-triggered re-tracks.
const HEARTBEAT_MS = 20_000;

const ACTIVITY_EVENTS = ["mousemove", "keydown", "scroll", "touchstart", "click"] as const;

type PresencePayload = { id: string; name: string; lastActiveAt: number };

/** Call once per app (NavShell does this) to announce this tab's presence. */
export function usePresenceTracking(profileId: string, name: string) {
  const lastActiveRef = useRef(0);

  useEffect(() => {
    if (!profileId) return;
    lastActiveRef.current = Date.now();
    const supabase = createClient();
    // Deliberately no `config: { presence: { key } }` here — passing an
    // explicit presence key stalls the subscribe handshake indefinitely on
    // this project (no error, the callback just never fires; smells like a
    // server-side authorization check for a "private" channel that never
    // resolves). Track our own `id` inside the payload instead and dedupe
    // on that in the viewer, which needs no special channel config at all.
    const channel = supabase.channel(PRESENCE_TOPIC);

    const track = (lastActiveAt: number) => {
      channel.track({ id: profileId, name, lastActiveAt } satisfies PresencePayload);
    };

    const onActivity = () => {
      const now = Date.now();
      if (now - lastActiveRef.current < HEARTBEAT_MS) return;
      lastActiveRef.current = now;
      track(now);
    };

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") track(lastActiveRef.current);
    });

    for (const evt of ACTIVITY_EVENTS) window.addEventListener(evt, onActivity, { passive: true });
    document.addEventListener("visibilitychange", onActivity);

    // Keep re-announcing even with no fresh activity, so an idle-but-open
    // tab still shows up as "idle" rather than disappearing entirely.
    const heartbeat = setInterval(() => track(lastActiveRef.current), HEARTBEAT_MS);

    return () => {
      clearInterval(heartbeat);
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, onActivity);
      document.removeEventListener("visibilitychange", onActivity);
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [profileId, name]);
}

export type PresenceStatus = "online" | "idle";

/** Call from an admin view to see everyone else's live status. Returns a
 * map of profile id -> status; anyone absent from the map is offline. */
export function usePresenceViewer(): Map<string, PresenceStatus> {
  const [state, setState] = useState<Map<string, PresenceStatus>>(new Map());

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(PRESENCE_TOPIC);

    const recompute = () => {
      const raw = channel.presenceState<PresencePayload>();
      const now = Date.now();
      const next = new Map<string, PresenceStatus>();
      for (const entries of Object.values(raw)) {
        const latest = entries[0];
        if (!latest) continue;
        next.set(latest.id, now - latest.lastActiveAt < IDLE_AFTER_MS ? "online" : "idle");
      }
      setState(next);
    };

    channel.on("presence", { event: "sync" }, recompute).subscribe();
    // Re-bucket periodically too — someone can go online -> idle purely by
    // elapsed time, with no new presence event to trigger a recompute.
    const ticker = setInterval(recompute, HEARTBEAT_MS);

    return () => {
      clearInterval(ticker);
      supabase.removeChannel(channel);
    };
  }, []);

  return state;
}
