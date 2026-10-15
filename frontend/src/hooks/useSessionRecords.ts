import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { progressApi, type CompletionReceipt } from "../api/client";
import type { RunOptions } from "./useCheckpoint";
export function useSessionRecords({
  slug,
  mode,
  difficulty,
  options,
}: {
  slug: string;
  mode: string;
  difficulty: "easy" | "normal" | "hard";
  options: RefObject<RunOptions>;
}) {
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<CompletionReceipt | null>(null);
  const [highScore, setHighScore] = useState(0),
    [newHigh, setNewHigh] = useState(false);
  const recordsRevision = useRef(0);
  const applyReceipt = useCallback((result: CompletionReceipt) => {
    recordsRevision.current++;
    setReceipt(result);
    setBestTime(result.best_time_ms ?? null);
    setHighScore(result.high_score);
    setNewHigh(result.is_new_high_score);
  }, []);
  const resetReceipt = useCallback(() => {
    setReceipt(null);
    setNewHigh(false);
  }, []);
  useEffect(() => {
    let active = true;
    const revision = recordsRevision.current;
    void progressApi
      .records()
      .then((records) => {
        if (active && revision === recordsRevision.current) {
          const record = records.find(
            (r) =>
              r.game_slug === slug &&
              r.mode ===
                (mode === "daily"
                  ? `daily-${options.current.config.challenge_date ?? new Date().toISOString().slice(0, 10)}`
                  : mode) &&
              r.difficulty === difficulty &&
              r.rules_version === options.current.rules_version,
          );
          setHighScore(record?.high_score ?? 0);
          setBestTime(record?.best_time_ms ?? null);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [slug, mode, difficulty, options]);
  return {
    view: { bestTime, receipt, highScore, newHigh } as const,
    commands: { applyReceipt, resetReceipt },
  };
}
