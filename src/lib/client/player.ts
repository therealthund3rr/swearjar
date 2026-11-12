"use client";
// localStorage helpers: always wrapped, the app must work without storage.

const key = (code: string) => `swearjar:player:${code.toUpperCase()}`;
const listenKey = (code: string) => `swearjar:listen:${code.toUpperCase()}`;

export function getPlayerId(code: string): string | null {
  try {
    return localStorage.getItem(key(code));
  } catch {
    return null;
  }
}
export function savePlayer(code: string, playerId: string): void {
  try {
    localStorage.setItem(key(code), playerId);
  } catch {}
}
export function getListenAs(code: string): string | null {
  try {
    return localStorage.getItem(listenKey(code));
  } catch {
    return null;
  }
}
export function saveListenAs(code: string, playerId: string): void {
  try {
    localStorage.setItem(listenKey(code), playerId);
  } catch {}
}
