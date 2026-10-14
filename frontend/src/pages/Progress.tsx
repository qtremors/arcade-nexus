import { formatTime, timeRanked } from "../games/records";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { progressApi } from "../api/client";
import type { ModeRecord } from "../api/client";
import { PageHeading } from "../components/ConsoleUI";
import { SessionHistoryModal } from "../components/SessionHistoryModal";
import { getDescriptor, gameSlugs } from "../games/descriptors";
export function Progress() {
  const [view, setView] = useState({ household: false, revision: 0 });
  const { household, revision } = view;
  const [history, setHistory] = useState(false);
  const [result, setResult] = useState<{
    revision: number;
    records: ModeRecord[];
    error: string;
  } | null>(null);
  const loading = !result || result.revision !== revision;
  const records = loading ? [] : result.records;
  const error = loading ? "" : result.error;
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void progressApi
      .records(household, controller.signal)
      .then((data) => {
        if (active) {
          setResult({ revision, records: data, error: "" });
        }
      })
      .catch((e) => {
        if (active) setResult({ revision, records: [], error: e.message });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [household, revision]);
  const chooseHousehold = (next: boolean) =>
    setView((current) =>
      current.household === next
        ? current
        : { household: next, revision: current.revision + 1 },
    );
  return (
    <div className="console-page">
      <PageHeading kicker="SOMETHING TO BEAT" title="Your progress">
        Personal bests stay separate by game, mode, difficulty, and rules.
      </PageHeading>
      <div className="catalog-tools">
        <button
          className="secondary-action"
          aria-pressed={!household}
          onClick={() => chooseHousehold(false)}
        >
          Your records
        </button>
        <button
          className="secondary-action"
          aria-pressed={household}
          onClick={() => chooseHousehold(true)}
        >
          Household records
        </button>
        <button className="secondary-action" onClick={() => setHistory(true)}>
          Session history
        </button>
        <Link className="secondary-action" to="/achievements">
          Achievements
        </Link>
      </div>
      {loading ? (
        <p role="status">Loading records…</p>
      ) : error ? (
        <p role="alert">
          {error}{" "}
          <button
            onClick={() =>
              setView((current) => ({
                ...current,
                revision: current.revision + 1,
              }))
            }
          >
            Retry records
          </button>
        </p>
      ) : !records.length ? (
        <p>No records yet. Finish a run to set your first best.</p>
      ) : (
        <div className="table-scroll detail-panel">
          <table>
            <thead>
              <tr>
                <th>Game</th>
                <th>Player</th>
                <th>Mode</th>
                <th>Difficulty</th>
                <th>Personal best</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr
                  key={`${r.profile_id}:${r.game_slug}:${r.mode}:${r.difficulty}:${r.rules_version}`}
                >
                  <td>
                    {gameSlugs.includes(r.game_slug)
                      ? getDescriptor(r.game_slug).title
                      : r.game_slug}
                  </td>
                  <td>{r.player}</td>
                  <td>
                    {gameSlugs.includes(r.game_slug)
                      ? (getDescriptor(r.game_slug).modes.find(
                          (m) => m.id === r.mode,
                        )?.label ?? r.mode)
                      : r.mode}
                    <small>Rules {r.rules_version}</small>
                  </td>
                  <td>{r.difficulty}</td>
                  <td>
                    {timeRanked(r.game_slug, r.mode, r.rules_version) ? (
                      formatTime(r.best_time_ms)
                    ) : (
                      <>
                        {r.high_score.toLocaleString()}{" "}
                        {r.game_slug === "stellar-flight" &&
                        r.mode === "classic"
                          ? "m/s"
                          : gameSlugs.includes(r.game_slug)
                            ? getDescriptor(r.game_slug).scoreUnit
                            : "points"}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="home-footnote">
        Pass the controller, switch players, and try the same daily challenge.
        Daily layouts use the UTC date.
      </p>
      <SessionHistoryModal
        isOpen={history}
        onClose={() => setHistory(false)}
        title="Session history"
      />
    </div>
  );
}
