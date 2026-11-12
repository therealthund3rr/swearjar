"use client";
import { useEffect, useState } from "react";

// Keys are the English strings; the Italian dictionary translates the main labels only.
const it: Record<string, string> = {
  "A swear jar that listens. Pay only for what you said.": "Un barattolo delle parolacce che ascolta. Paghi solo quello che hai detto.",
  "Create a jar": "Crea un barattolo",
  "Join with code": "Entra con un codice",
  Join: "Entra",
  Hold: "Blocca",
  Talk: "Parla",
  Settle: "Salda",
  "Sandbox only. No real money.": "Solo sandbox. Nessun denaro reale.",
  "Your name": "Il tuo nome",
  Language: "Lingua",
  "Jar name": "Nome del barattolo",
  "Cap per player": "Tetto per giocatore",
  "House rules": "Regole di casa",
  "Compile rules": "Compila le regole",
  Recompile: "Ricompila",
  "Looks right": "Va bene così",
  "Continue to lobby": "Vai alla lobby",
  "Start session": "Avvia la sessione",
  "End session & settle": "Termina e salda",
  "Objection!": "Obiezione!",
  "On hold": "Bloccato",
  Voided: "Annullato",
  "Everyone in this jar can see your fines": "Tutti nel barattolo vedono le tue multe",
  Start: "Avvia",
  Stop: "Ferma",
  Scoreboard: "Classifica",
  Players: "Giocatori",
  Receipt: "Ricevuta",
  Retry: "Riprova",
  "Settle failed": "Saldo fallito",
};

export type UiLang = "en" | "it";

export function detectLang(): UiLang {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "it" || q === "en") return q;
    if (navigator.language?.toLowerCase().startsWith("it")) return "it";
  } catch {}
  return "en";
}

/** Hook: returns t(). Starts as English (matches SSR), switches after mount. */
export function useT(): (s: string) => string {
  const [lang, setLang] = useState<UiLang>("en");
  useEffect(() => setLang(detectLang()), []);
  return (s: string) => (lang === "it" ? it[s] ?? s : s);
}
