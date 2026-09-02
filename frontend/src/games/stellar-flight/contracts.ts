export type JourneyCounters = {
  gates: number;
  sectors: number;
  closePasses: number;
  distance: number;
  races: number;
};
export const contracts = [
  {
    counter: "gates",
    target: 5,
    title: "Race rings",
    detail: "Clear race rings",
    reward: 600,
  },
  {
    counter: "sectors",
    target: 3,
    title: "Chart new sectors",
    detail: "Discover new sectors",
    reward: 700,
  },
  {
    counter: "closePasses",
    target: 3,
    title: "Close passes",
    detail: "Fly close to asteroids",
    reward: 600,
  },
  {
    counter: "distance",
    target: 8,
    title: "Long haul",
    detail: "Travel kilometres",
    reward: 800,
  },
  {
    counter: "races",
    target: 2,
    title: "Back-to-back races",
    detail: "Finish ring races",
    reward: 1000,
  },
] as const;
export function contractFor(
  index: number,
  baseline: JourneyCounters,
  counters: JourneyCounters,
  choice = index % contracts.length,
) {
  const contract = contracts[choice];
  const cycle = Math.floor(index / contracts.length);
  const target = contract.target + cycle * 2;
  const progress = Math.max(
    0,
    Math.min(target, counters[contract.counter] - baseline[contract.counter]),
  );
  return {
    ...contract,
    target,
    progress,
    reward: contract.reward + cycle * 150,
  };
}
