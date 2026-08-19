/** Gameplay randomness is saved; visual effects use their own randomness. */
export class Random {
  state: number;
  constructor(seed = Math.floor(Math.random() * 0x100000000)) {
    this.state = seed >>> 0;
  }
  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
}
export function dailySeed(
  slug: string,
  date = new Date().toISOString().slice(0, 10),
): number {
  return [...`${slug}:${date}`].reduce(
    (seed, char) => Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0,
    2166136261,
  );
}
