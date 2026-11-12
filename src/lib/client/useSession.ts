"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicSession } from "@/lib/types";

/** Live session state: SSE with auto-reconnect, plus an initial GET as fallback. */
export function useSession(code: string, playerId: string | null) {
  const [session, setSession] = useState<PublicSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  // server clock minus local clock, to judge objection windows correctly
  const offset = useRef(0);

  const apply = useCallback((s: PublicSession) => {
    if (typeof s.now === "number") offset.current = s.now - Date.now();
    setSession(s);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${code}?playerId=${encodeURIComponent(playerId ?? "")}`, { cache: "no-store" });
      if (res.status === 404) {
        setError("Jar not found");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      apply((await res.json()) as PublicSession);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot reach the server");
    }
  }, [code, playerId, apply]);

  useEffect(() => {
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      es = new EventSource(`/api/sessions/${code}/events?playerId=${encodeURIComponent(playerId ?? "")}`);
      es.addEventListener("state", (ev) => {
        try {
          apply(JSON.parse((ev as MessageEvent).data) as PublicSession);
          setConnected(true);
        } catch {}
      });
      es.onerror = () => {
        setConnected(false);
        es?.close();
        void refresh();
        timer = setTimeout(connect, 2000);
      };
    };
    void refresh();
    connect();
    return () => {
      closed = true;
      es?.close();
      if (timer) clearTimeout(timer);
    };
  }, [code, playerId, apply, refresh]);

  const serverNow = useCallback(() => Date.now() + offset.current, []);
  return { session, error, connected, refresh, serverNow };
}
