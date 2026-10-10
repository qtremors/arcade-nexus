/**
 * Session History Modal
 * Displays detailed gameplay session history in a modal dialog
 */
import { useEffect, useState, useRef } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import { X, Clock } from "lucide-react";
import { formatPlaytime } from "../utils/formatting";
import { LoadingSpinner } from "./LoadingSpinner";
import type { GameSession } from "../api/client";

interface SessionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  gameId?: number; // Optional filter
  sessions: GameSession[];
  loading?: boolean;
}

export function SessionHistoryModal({
  isOpen,
  onClose,
  title,
  sessions,
  loading = false,
  initialSort = "date",
}: SessionHistoryModalProps & { initialSort?: "date" | "score" | "duration" }) {
  const dialog = useRef<HTMLDivElement>(null);
  useModalFocus(dialog, isOpen);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof GameSession;
    direction: "asc" | "desc";
  }>({
    key:
      initialSort === "score"
        ? "score"
        : initialSort === "duration"
          ? "duration_seconds"
          : "end_time",
    direction: "desc",
  });

  // Handle sort click
  const handleSort = (key: keyof GameSession) => {
    let direction: "asc" | "desc" = "desc";
    if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });
  };

  // Sort sessions
  const sortedSessions = [...sessions].sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (aValue === bValue) return 0;
    if (aValue === undefined || aValue === null) return 1;
    if (bValue === undefined || bValue === null) return -1;

    // Handle dates strings
    if (sortConfig.key === "end_time" || sortConfig.key === "start_time") {
      return sortConfig.direction === "asc"
        ? new Date(aValue as string).getTime() -
            new Date(bValue as string).getTime()
        : new Date(bValue as string).getTime() -
            new Date(aValue as string).getTime();
    }

    // Generic sort
    if (sortConfig.direction === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    if (!isOpen) return;
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="session-history-dialog relative w-full max-w-4xl bg-[#1a1b26] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <Clock className="text-cyan-400" size={24} />
            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">
              {title}
            </h2>
          </div>
          <button
            aria-label="Close session history"
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/50 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-0">
          {loading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner text="Loading History..." />
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-20 text-center text-white/60 flex flex-col items-center">
              <Clock size={48} className="mb-4 opacity-20" />
              <p>No play history found.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#1a1b26] z-10 text-xs uppercase font-mono tracking-wider text-white/40 border-b border-white/5 shadow-md">
                <tr>
                  <th
                    className="px-6 py-4 font-normal cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort("game_title")}
                  >
                    Game
                  </th>
                  <th
                    className="px-6 py-4 font-normal cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort("end_time")}
                  >
                    Date{" "}
                    {sortConfig.key === "end_time" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="px-6 py-4 font-normal cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort("difficulty")}
                  >
                    Difficulty
                  </th>
                  <th
                    className="px-6 py-4 font-normal text-right cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort("duration_seconds")}
                  >
                    Duration{" "}
                    {sortConfig.key === "duration_seconds" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="px-6 py-4 font-normal text-right cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort("score")}
                  >
                    Score{" "}
                    {sortConfig.key === "score" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedSessions.map((session) => (
                  <tr
                    key={session.id}
                    className="group hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-white flex items-center gap-2">
                        {session.game_title}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white/70 font-mono text-sm">
                      <div className="flex flex-col">
                        <span>
                          {new Date(session.end_time).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-white/60">
                          {new Date(session.end_time).toLocaleTimeString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-white/70 font-mono text-sm capitalize">
                      {session.difficulty || "-"}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-cyan-400">
                      {formatPlaytime(session.duration_seconds)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-yellow-500 font-bold">
                      {session.score.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-white/5 flex justify-between items-center text-xs text-white/60 font-mono uppercase tracking-widest">
          <span>Total Sessions: {sessions.length}</span>
          <span>Detailed Log</span>
        </div>
      </div>
    </div>
  );
}
