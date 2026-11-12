"use client";
import { useEffect, useState } from "react";
import type { AiMode } from "@/lib/types";

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data as T;
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export type AppConfig = { paypalClientId: string; currency: string; beneficiaryName: string; aiMode: AiMode };

let cached: Promise<AppConfig> | null = null;
export function loadConfig(): Promise<AppConfig> {
  if (!cached) {
    cached = api<AppConfig>("/api/config").catch((e) => {
      cached = null;
      throw e;
    });
  }
  return cached;
}

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadConfig().then(setConfig, (e) => setError(errMsg(e)));
  }, []);
  return { config, error };
}
