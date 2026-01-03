/**
 * Game Registration Module
 * 
 * Registers all available games with the SDK.
 * Games are organized in modular folders under /games/
 */
import { registerGame } from '../sdk';

// Import games from modular folders
import { SnakeGame } from './snake';
import { RaptorRunGame } from './raptor-run';
import { SpaceRunnerGame } from './stellar-drift';
import { SkyAceGame } from './sky-ace';

let registered = false;

export function registerGames(): void {
    if (registered) return;
    registered = true;

    // Register each game with its slug (matches backend seed data)
    registerGame('snake', () => new SnakeGame());
    registerGame('raptor-run', () => new RaptorRunGame());
    registerGame('space-runner', () => new SpaceRunnerGame()); // Changed to match backend slug
    registerGame('sky-ace', () => new SkyAceGame());
}

// Auto-register on import
registerGames();
