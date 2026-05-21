import { useEffect, type RefObject } from "react";

type Options = {
  audioRef: RefObject<HTMLAudioElement | null>;
  enabled: boolean;
  onNext: () => void;
};

export function usePlayerKeyboard({ audioRef, enabled, onNext }: Options) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      const a = audioRef.current;
      if (!a) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (a.paused) void a.play().catch(() => {});
        else a.pause();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        onNext();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        a.muted = !a.muted;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [audioRef, enabled, onNext]);
}
