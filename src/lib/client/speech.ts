"use client";

export type MicStatus = "off" | "listening" | "restarting" | "denied" | "unsupported";

type RecResult = { isFinal: boolean; 0: { transcript: string } };
type RecEvent = { resultIndex: number; results: ArrayLike<RecResult> };
type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
};
type RecCtor = new () => Rec;
type SpeechWindow = { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };

export function speechSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as SpeechWindow;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export type Listener = { start(): void; stop(): void; setLang(lang: string): void };

/**
 * Continuous Web Speech listener with honest auto-restart.
 * Only FINAL results go to onFinal; interim text goes to onInterim (shown greyed).
 */
export function createListener(opts: {
  lang: string;
  onFinal: (text: string) => void;
  onInterim: (text: string) => void;
  onStatus: (s: MicStatus) => void;
}): Listener {
  const w = window as unknown as SpeechWindow;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  let lang = opts.lang;
  let wanted = false;
  let rec: Rec | null = null;
  let backoff = 250;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let wake: { release(): Promise<void> } | null = null;

  const requestWake = async () => {
    try {
      const nav = navigator as unknown as { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } };
      if (wanted && !wake && nav.wakeLock) wake = await nav.wakeLock.request("screen");
    } catch {
      wake = null;
    }
  };
  const onVisible = () => {
    if (document.visibilityState === "visible" && wanted) {
      wake = null;
      void requestWake();
    }
  };

  const retry = () => {
    opts.onStatus("restarting");
    timer = setTimeout(spawn, backoff);
    backoff = Math.min(2000, backoff * 2);
  };

  function spawn() {
    if (!Ctor || !wanted) return;
    rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => {
      backoff = 250;
      opts.onStatus("listening");
    };
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript.trim();
        if (r.isFinal) {
          if (text) opts.onFinal(text);
        } else interim += text + " ";
      }
      opts.onInterim(interim.trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wanted = false;
        opts.onStatus("denied");
      }
    };
    rec.onend = () => {
      opts.onInterim("");
      if (wanted) retry();
    };
    try {
      rec.start();
    } catch {
      retry();
    }
  }

  return {
    start() {
      if (!Ctor) return opts.onStatus("unsupported");
      if (wanted) return;
      wanted = true;
      document.addEventListener("visibilitychange", onVisible);
      void requestWake();
      spawn();
    },
    stop() {
      wanted = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      try {
        rec?.stop();
      } catch {}
      void wake?.release().catch(() => {});
      wake = null;
      opts.onInterim("");
      opts.onStatus("off");
    },
    setLang(l: string) {
      lang = l;
      if (wanted) {
        try {
          rec?.stop(); // onend restarts with the new language
        } catch {}
      }
    },
  };
}
