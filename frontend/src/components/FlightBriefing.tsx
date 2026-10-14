import type { CSSProperties } from "react";

const fleet = [
  {
    name: "Nova Dart",
    tag: "AVAILABLE",
    style: "dart",
    color: "#8ceaff",
    description: "Quick acceleration and turns. Shorter boost.",
    path: "M50 5 59 48 95 78 59 68 50 85 41 68 5 78 41 48Z",
  },
  {
    name: "Legacy Jet",
    tag: "AVAILABLE",
    style: "jet",
    color: "#b8c4e8",
    description: "Efficient engines. Longer boost.",
    path: "M50 5 57 47 92 70 86 78 56 65 57 85 50 79 43 85 44 65 14 78 8 70 43 47Z",
  },
  {
    name: "Vanguard",
    tag: "LEVEL 3",
    style: "twin",
    color: "#ffcf91",
    description: "High speed and strong shields. Wide turns.",
    path: "M24 8 34 34 44 34 50 15 56 34 66 34 76 8 86 38 83 85 66 85 66 53 58 53 60 77 40 77 42 53 34 53 34 85 17 85 14 38Z",
  },
  {
    name: "Star Manta",
    tag: "LEVEL 5",
    style: "crescent",
    color: "#d1b0ff",
    description: "Agile surveyor. Fast boost recharge.",
    path: "M50 8 63 40 97 27 91 65 68 82 50 67 32 82 9 65 3 27 37 40Z",
  },
];
export function FlightBriefing() {
  return (
    <div className="flight-briefing">
      <div className="flight-fleet" aria-label="Stellar Flight fleet">
        {fleet.map((ship) => (
          <div
            className="flight-fleet-card"
            key={ship.style}
            style={{ "--ship-color": ship.color } as CSSProperties}
          >
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <path d={ship.path} />
              <path
                d="M47 36 53 36 55 57 45 57Z"
                className="flight-blueprint-cockpit"
              />
            </svg>
            <span>{ship.tag}</span>
            <strong>{ship.name}</strong>
            <small>{ship.description}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
