/**
 * GameCanvas - Manages game lifecycle with enhanced start screen
 * FULLSCREEN - uses entire viewport
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameEngine, getGame } from '../sdk';
import type { GameConfig } from '../sdk';
import { statsApi, savesApi, achievementsApi } from '../api/client';
import type { SaveData, Achievement } from '../api/client';
import { useToast } from './Toast';
import { Clock, Save, Download, Trash2, X } from 'lucide-react';
import '../games';

interface Props {
    slug: string;
    title: string;
    onGameOver?: (score: number) => void;
}

type State = 'loading' | 'ready' | 'playing' | 'paused' | 'gameover' | 'save_menu' | 'load_menu';
type Difficulty = 'easy' | 'normal' | 'hard';

// Game-specific control hints
const CONTROL_HINTS: Record<string, string> = {
    'snake': 'Arrow Keys / WASD to move',
    'raptor-run': 'UP / SPACE to Jump • DOWN to Duck',
    'stellar-flight': 'WASD / Arrows: Pitch & Roll • Q/E: Yaw • Shift/Ctrl: Throttle',
};

export function GameCanvas({ slug, title, onGameOver }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    const initRef = useRef(false);
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [state, setState] = useState<State>('loading');
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [isNewHigh, setIsNewHigh] = useState(false);
    const [difficulty, setDifficulty] = useState<Difficulty>('normal');
    const [saves, setSaves] = useState<SaveData[]>([]);
    const [isLoadingSaves, setIsLoadingSaves] = useState(false);

    const loadSaves = useCallback(async () => {
        setIsLoadingSaves(true);
        try {
            const data = await savesApi.list(slug);
            setSaves(data.saves);
        } catch (e) {
            console.error('Failed to load saves:', e);
        } finally {
            setIsLoadingSaves(false);
        }
    }, [slug]);

    // Use ref for canvas size to avoid re-triggering init effect
    const sizeRef = useRef({ width: 800, height: 600 });
    const [, forceUpdate] = useState(0);

    // Track playtime
    const playStartTimeRef = useRef<number | null>(null);
    const totalPlaytimeRef = useRef(0);

    // Handle window resize
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current && canvasRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const newWidth = Math.floor(rect.width);
                const newHeight = Math.floor(rect.height);
                sizeRef.current = { width: newWidth, height: newHeight };
                canvasRef.current.width = newWidth;
                canvasRef.current.height = newHeight;
                forceUpdate(n => n + 1);
            }
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const checkAchievements = useCallback(async (finalScore: number) => {
        try {
            const { achievements } = await achievementsApi.getForGame(slug);
            const locked = achievements.filter((a: Achievement) => !a.unlocked);

            for (const achievement of locked) {
                let shouldUnlock = false;
                // Simple score-based unlock logic for now
                // In a more complex app, the game might send specific event slugs
                if (achievement.slug.startsWith('score-')) {
                    const requiredScore = parseInt(achievement.slug.split('-')[1]);
                    if (finalScore >= requiredScore) shouldUnlock = true;
                } else if (achievement.slug === 'first-bite' && finalScore > 0) {
                    shouldUnlock = true;
                } else if (achievement.slug === 'first-jump' && finalScore > 0) {
                    shouldUnlock = true;
                } else if (achievement.slug === 'first-dodge' && finalScore > 0) {
                    shouldUnlock = true;
                } else if (achievement.slug === 'takeoff' && finalScore > 0) {
                    shouldUnlock = true;
                }

                if (shouldUnlock) {
                    await achievementsApi.unlock(slug, achievement.slug);
                    if (import.meta.env.DEV) {
                        console.log(`[GameCanvas] Achievement unlocked: ${achievement.title}`);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to check achievements:', e);
        }
    }, [slug]);

    const setupCallbacks = useCallback((engine: GameEngine) => {
        engine.onPause(() => {
            if (playStartTimeRef.current) {
                totalPlaytimeRef.current += (Date.now() - playStartTimeRef.current) / 1000;
                playStartTimeRef.current = null;
            }
            setState('paused');
        });

        engine.onGameOver(async (finalScore) => {
            if (playStartTimeRef.current) {
                totalPlaytimeRef.current += (Date.now() - playStartTimeRef.current) / 1000;
                playStartTimeRef.current = null;
            }
            setState('gameover');
            setScore(finalScore);

            try {
                if (totalPlaytimeRef.current > 0) {
                    await statsApi.recordSession(slug, Math.floor(totalPlaytimeRef.current), finalScore, difficulty);
                }
                const result = await statsApi.submitScore(slug, finalScore);
                setHighScore(result.high_score);
                setIsNewHigh(result.is_new_high_score);

                // Achievement check
                await checkAchievements(finalScore);
            } catch (e) {
                console.error('Failed to submit stats/achievements:', e);
            }
            onGameOver?.(finalScore);
        });
    }, [slug, onGameOver, checkAchievements, difficulty]);

    // Initialize engine
    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const game = getGame(slug);
        if (!game) {
            console.error('Game not found:', slug);
            return;
        }

        const engine = new GameEngine();
        engineRef.current = engine;

        setupCallbacks(engine);

        const config: GameConfig = {
            slug,
            title,
            width: sizeRef.current.width || 800,
            height: sizeRef.current.height || 600,
            difficulty // Pass difficulty to game
        };
        engine.init(canvas, game, config)
            .then(() => setState('ready'))
            .catch(e => console.error('Init failed:', e));

        return () => {
            engineRef.current?.destroy();
            engineRef.current = null;
            initRef.current = false;
        };
    }, [slug, title, difficulty, setupCallbacks]);

    // Start game
    const start = useCallback(async () => {
        if (state !== 'ready') return;
        try {
            await statsApi.startSession(slug);
        } catch (e) {
            console.error('Failed to start session:', e);
        }
        playStartTimeRef.current = Date.now();
        totalPlaytimeRef.current = 0;
        engineRef.current?.start();
        setState('playing');
    }, [state, slug]);

    // Pause/Resume
    const pause = useCallback(() => {
        if (playStartTimeRef.current) {
            totalPlaytimeRef.current += (Date.now() - playStartTimeRef.current) / 1000;
            playStartTimeRef.current = null;
        }
        engineRef.current?.pause();
        setState('paused');
    }, []);

    const resume = useCallback(() => {
        playStartTimeRef.current = Date.now();
        engineRef.current?.resume();
        setState('playing');
    }, []);

    // Restart
    const restart = useCallback(async () => {
        // Record session if restarting mid-game
        if (state === 'playing' || state === 'paused') {
            if (playStartTimeRef.current) {
                totalPlaytimeRef.current += (Date.now() - playStartTimeRef.current) / 1000;
                playStartTimeRef.current = null;
            }
            if (totalPlaytimeRef.current > 0) {
                try {
                    const currentScore = engineRef.current?.getScore() || 0;
                    await statsApi.recordSession(slug, Math.floor(totalPlaytimeRef.current), currentScore, difficulty);
                } catch (e) {
                    console.error('Failed to record session on restart:', e);
                }
            }
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        engineRef.current?.destroy();
        initRef.current = false;

        const game = getGame(slug);
        if (!game) return;

        const engine = new GameEngine();
        engineRef.current = engine;

        setupCallbacks(engine);

        const config: GameConfig = {
            slug,
            title,
            width: sizeRef.current.width,
            height: sizeRef.current.height,
            difficulty
        };
        engine.init(canvas, game, config).then(async () => {
            try {
                await statsApi.startSession(slug);
            } catch (e) {
                console.error('Failed to start session on restart:', e);
            }
            playStartTimeRef.current = Date.now();
            totalPlaytimeRef.current = 0;
            engine.start();
            setState('playing');
            initRef.current = true;
        });
    }, [slug, title, difficulty, setupCallbacks, state]);

    // Quit - go back to previous page
    const quit = useCallback(async () => {
        // Record session if we played
        if (state === 'playing' || state === 'paused') {
            if (playStartTimeRef.current) {
                totalPlaytimeRef.current += (Date.now() - playStartTimeRef.current) / 1000;
                playStartTimeRef.current = null;
            }
            if (totalPlaytimeRef.current > 0) {
                try {
                    const currentScore = engineRef.current?.getScore() || 0;
                    await statsApi.recordSession(slug, Math.floor(totalPlaytimeRef.current), currentScore, difficulty);
                } catch (e) {
                    console.error('Failed to record session on quit:', e);
                }
            }
        }

        engineRef.current?.destroy();
        navigate(-1); // Go back to previous page
    }, [navigate, state, slug, difficulty]);

    // Save/Load handlers
    const onSaveClick = () => {
        setState('save_menu');
        loadSaves();
    };

    const onLoadClick = () => {
        setState('load_menu');
        loadSaves();
    };

    const handleSave = async (slot: number) => {
        if (!engineRef.current) return;
        const gameState = engineRef.current.getState();

        // Simple validation - ensure we have something to save
        if (Object.keys(gameState).length === 0) {
            showToast('Game state is empty', 'error');
            return;
        }

        try {
            // Default name with timestamp
            const date = new Date().toLocaleDateString(undefined, { hour: '2-digit', minute: '2-digit' });
            await savesApi.create(slug, slot, gameState, `${title} - ${date}`);
            await loadSaves();
            showToast(`Game saved to slot ${slot}`, 'success');
        } catch (e) {
            console.error('Failed to save:', e);
            showToast('Failed to save game', 'error');
        }
    };

    const handleLoad = async (slot: number) => {
        const save = saves.find(s => s.slot === slot);
        if (!save || !engineRef.current) return;

        try {
            engineRef.current.setState(save.data);
            setState('paused');
            showToast(`Loaded save from slot ${slot}`, 'success');
        } catch (e) {
            console.error('Failed to load:', e);
            showToast('Failed to load save', 'error');
        }
    };

    const handleDelete = async (slot: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Delete this save?')) return;
        try {
            await savesApi.delete(slug, slot);
            await loadSaves();
        } catch (error) {
            console.error('Failed to delete:', error);
        }
    };

    const backToPause = () => setState('paused');

    // Keyboard controls
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                if (state === 'ready') start();
                else if (state === 'paused') resume();
            }
            if (e.code === 'KeyP' && state === 'playing') pause();
            if (e.code === 'Escape') {
                if (state === 'paused') quit();
                else if (state === 'ready') quit();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [state, start, resume, pause, quit]);

    const controlHint = CONTROL_HINTS[slug] || 'Arrow Keys to move';

    return (
        <div ref={containerRef} className="absolute inset-0 bg-[#0a0a0f] overflow-hidden">
            <canvas
                ref={canvasRef}
                width={sizeRef.current.width}
                height={sizeRef.current.height}
                className="block w-full h-full"
            />

            {state === 'loading' && <Overlay><p>Loading...</p></Overlay>}

            {state === 'ready' && (
                <Overlay>
                    {/* Game Title */}
                    <h1 className="text-5xl font-extrabold bg-gradient-to-br from-[#00ff88] to-[#00ccff] bg-clip-text text-transparent mb-2">
                        {title}
                    </h1>

                    {/* Controls */}
                    <p style={{ opacity: 0.5, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                        {controlHint}
                    </p>

                    {/* Difficulty Selector */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <p style={{ opacity: 0.4, fontSize: '0.75rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Difficulty
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDifficulty(d)}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        background: difficulty === d ? 'linear-gradient(135deg, #00ff88, #00cc66)' : '#222',
                                        border: difficulty === d ? 'none' : '1px solid #444',
                                        borderRadius: '6px',
                                        color: '#fff',
                                        fontSize: '0.8rem',
                                        fontWeight: difficulty === d ? 700 : 400,
                                        cursor: 'pointer',
                                        textTransform: 'capitalize',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Start Button */}
                    <Button onClick={start} primary>▶ START GAME</Button>

                    {/* Back Button */}
                    <button
                        onClick={quit}
                        className="mt-4 bg-transparent border-none text-white/40 text-sm cursor-pointer hover:text-white/60 transition-colors"
                    >
                        ← Back
                    </button>

                    <p style={{ opacity: 0.2, marginTop: '1rem', fontSize: '0.75rem' }}>
                        Press SPACE to start • ESC to go back
                    </p>
                </Overlay>
            )}

            {state === 'paused' && (
                <Overlay>
                    <h2 className="text-2xl font-bold mb-6 tracking-widest">PAUSED</h2>
                    <Button onClick={resume} primary>▶ Resume</Button>
                    <Button onClick={restart}>🔄 Restart</Button>
                    <div className="flex gap-2 my-2">
                        <Button onClick={onSaveClick}>Save Game</Button>
                        <Button onClick={onLoadClick}>Load Game</Button>
                    </div>
                    <Button onClick={quit}>← Quit</Button>
                </Overlay>
            )}

            {(state === 'save_menu' || state === 'load_menu') && (
                <Overlay>
                    <div className="w-full max-w-md bg-[#1a1a20] p-6 rounded-xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {state === 'save_menu' ? <Save className="text-cyan-400" /> : <Download className="text-green-400" />}
                                {state === 'save_menu' ? 'SAVE GAME' : 'LOAD GAME'}
                            </h2>
                            <button onClick={backToPause} className="text-white/50 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map(slot => {
                                const save = saves.find(s => s.slot === slot);
                                const isEmpty = !save;

                                return (
                                    <div key={slot} className="flex items-center gap-2 group">
                                        <button
                                            onClick={() => state === 'save_menu' ? handleSave(slot) : handleLoad(slot)}
                                            disabled={state === 'load_menu' && isEmpty}
                                            className={`
                                                flex-1 flex items-center justify-between p-4 rounded-lg border transition-all text-left
                                                ${!isEmpty
                                                    ? 'bg-white/5 border-white/10 hover:bg-white/10'
                                                    : 'bg-black/30 border-white/5 text-white/30 hover:bg-white/5 hover:border-white/10'}
                                                ${isLoadingSaves ? 'opacity-50 pointer-events-none' : ''}
                                                ${state === 'load_menu' && isEmpty ? 'opacity-30 cursor-not-allowed' : ''}
                                            `}
                                        >
                                            <div className="flex items-center gap-4">
                                                <span className={`
                                                    w-8 h-8 rounded-full flex items-center justify-center font-mono text-sm border
                                                    ${!isEmpty ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-white/5 border-white/10'}
                                                `}>
                                                    {slot}
                                                </span>
                                                <div>
                                                    <div className={`font-bold text-sm ${!isEmpty ? 'text-white' : 'text-white/30'}`}>
                                                        {save ? save.name || 'Untitled Save' : 'Empty Slot'}
                                                    </div>
                                                    {save && (
                                                        <div className="text-xs text-white/40 flex items-center gap-1 mt-1">
                                                            <Clock size={10} />
                                                            {new Date(save.updated_at).toLocaleString()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {state === 'save_menu' ? (
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-mono uppercase bg-white/10 px-2 py-1 rounded">
                                                    Overwrite
                                                </span>
                                            ) : (save && (
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-mono uppercase bg-green-500/20 text-green-400 px-2 py-1 rounded">
                                                    Load
                                                </span>
                                            ))}
                                        </button>

                                        {save && (
                                            <button
                                                onClick={(e) => handleDelete(slot, e)}
                                                className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                                                title="Delete Save"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Overlay>
            )}

            {state === 'gameover' && (
                <Overlay>
                    <h2 className={isNewHigh ? 'text-[#ffd700]' : ''}>
                        {isNewHigh ? '🏆 NEW HIGH SCORE!' : 'GAME OVER'}
                    </h2>
                    <div className="text-5xl font-extrabold my-4">{score}</div>
                    {highScore > 0 && !isNewHigh && (
                        <p className="opacity-50">High Score: {highScore}</p>
                    )}
                    <Button onClick={restart}>🔄 Play Again</Button>
                    <Button onClick={quit}>← Back</Button>
                </Overlay>
            )}
        </div>
    );
}

function Overlay({ children }: { children: React.ReactNode }) {
    return (
        <div className="absolute inset-0 bg-[#0a0a0f]/95 flex flex-col items-center justify-center text-white text-center">
            {children}
        </div>
    );
}

function Button({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
    return (
        <button
            onClick={onClick}
            className={`
                px-8 py-3 m-2 rounded-lg text-white transition-all
                ${primary
                    ? 'bg-gradient-to-br from-[#00ff88] to-[#00cc66] text-xl font-bold hover:opacity-90'
                    : 'bg-[#333] text-base font-semibold hover:bg-[#444]'}
            `}
        >
            {children}
        </button>
    );
}
