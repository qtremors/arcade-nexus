/**
 * Audio Manager - Placeholder for sound system
 */
export class AudioManager {
    private static instance: AudioManager;
    private volume: number = 1.0;

    private constructor() { }

    static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    playSfx(id: string): void {
        console.log(`[Audio] Playing SFX: ${id}`);
    }

    playMusic(id: string): void {
        console.log(`[Audio] Playing Music: ${id}`);
    }

    setVolume(value: number): void {
        this.volume = Math.max(0, Math.min(1, value));
    }
}
