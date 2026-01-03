/**
 * Format seconds into human readable duration
 * @param seconds Total seconds
 * @returns Formatted string (e.g. "1h 30m" or "5m 20s")
 */
export function formatPlaytime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
}
