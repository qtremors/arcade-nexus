import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { progressApi } from "../api/client";
import type { ModeRecord } from "../api/client";
import { PageHeading } from "../components/ConsoleUI";
import { SessionHistoryModal } from "../components/SessionHistoryModal";
import { getDescriptor, gameSlugs } from "../games/descriptors";
export function Progress() {
  const [household, setHousehold] = useState(false),
    [records, setRecords] = useState<ModeRecord[]>([]),
    [history, setHistory] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void progressApi
      .records(household)
      .then((data) => {
        if (active) {
          setRecords(data);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [household, retry]);
  return (
    <div className="console-page">
      <PageHeading kicker="SOMETHING TO BEAT" title="Your progress">
        Personal bests stay separate by game, mode, difficulty, and rules.
      </PageHeading>
      <div className="catalog-tools">
        <button
          className="secondary-action"
          aria-pressed={!household}
          onClick={() => setHousehold(false)}
        >
          Your records
        </button>
        <button
          className="secondary-action"
          aria-pressed={household}
          onClick={() => setHousehold(true)}
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
      {error ? (
        <p role="alert">
          {error}{" "}
          <button onClick={() => setRetry((n) => n + 1)}>Retry records</button>
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
                    {r.high_score.toLocaleString()}{" "}
                    {r.game_slug === "stellar-flight" && r.mode === "classic"
                      ? "m/s"
                      : gameSlugs.includes(r.game_slug)
                        ? getDescriptor(r.game_slug).scoreUnit
                        : "points"}
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
        sessions={[]}
      />
    </div>
  );
}
