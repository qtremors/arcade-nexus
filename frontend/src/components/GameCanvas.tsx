/**
 * GameCanvas - Manages game lifecycle with enhanced start screen
 * FULLSCREEN - uses entire viewport
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameEngine, getGame } from '../sdk';
import type { GameConfig } from '../sdk';
import { statsApi } from '../api/client';
import '../games';

interface Props {
    slug: string;
    title: string;
    onGameOver?: (score: number) => void;
}

type State = 'loading' | 'ready' | 'playing' | 'paused' | 'gameover';
type Difficulty = 'easy' | 'normal' | 'hard';

// Game-specific control hints
const CONTROL_HINTS: Record<string, string> = {
    'snake': 'Arrow Keys / WASD to move',
    'raptor-run': 'UP / SPACE to Jump • DOWN to Duck',
    'space-runner': 'Arrow Keys to move • SPACE to Boost',
};

export function GameCanvas({ slug, title, onGameOver }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    const initRef = useRef(false);
    const navigate = useNavigate();

    const [state, setState] = useState<State>('loading');
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [isNewHigh, setIsNewHigh] = useState(false);
    const [difficulty, setDifficulty] = useState<Difficulty>('normal');

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
                    await statsApi.recordSession(slug, Math.floor(totalPlaytimeRef.current));
                }
                const result = await statsApi.submitScore(slug, finalScore);
                setHighScore(result.high_score);
                setIsNewHigh(result.is_new_high_score);
            } catch (e) {
                console.error('Failed to submit stats:', e);
            }
            onGameOver?.(finalScore);
        });

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
    }, [slug, title, onGameOver, difficulty]);

    // Start game
    const start = useCallback(() => {
        if (state !== 'ready') return;
        playStartTimeRef.current = Date.now();
        totalPlaytimeRef.current = 0;
        engineRef.current?.start();
        setState('playing');
    }, [state]);

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
    const restart = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        engineRef.current?.destroy();
        initRef.current = false;

        const game = getGame(slug);
        if (!game) return;

        const engine = new GameEngine();
        engineRef.current = engine;

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
                    await statsApi.recordSession(slug, Math.floor(totalPlaytimeRef.current));
                }
                const result = await statsApi.submitScore(slug, finalScore);
                setHighScore(result.high_score);
                setIsNewHigh(result.is_new_high_score);
            } catch (e) {
                console.error('Failed to submit stats:', e);
            }
            onGameOver?.(finalScore);
        });

        const config: GameConfig = {
            slug,
            title,
            width: sizeRef.current.width,
            height: sizeRef.current.height,
            difficulty
        };
        engine.init(canvas, game, config).then(() => {
            playStartTimeRef.current = Date.now();
            totalPlaytimeRef.current = 0;
            engine.start();
            setState('playing');
            initRef.current = true;
        });
    }, [slug, title, onGameOver, difficulty]);

    // Quit - go back to previous page
    const quit = useCallback(() => {
        engineRef.current?.destroy();
        navigate(-1); // Go back to previous page
    }, [navigate]);

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
        <div ref={containerRef} style={containerStyle}>
            <canvas
                ref={canvasRef}
                width={sizeRef.current.width}
                height={sizeRef.current.height}
                style={{ display: 'block', width: '100%', height: '100%' }}
            />

            {state === 'loading' && <Overlay><p>Loading...</p></Overlay>}

            {state === 'ready' && (
                <Overlay>
                    {/* Game Title */}
                    <h1 style={titleStyle}>{title}</h1>

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
                        style={{
                            marginTop: '1rem',
                            background: 'none',
                            border: 'none',
                            color: 'rgba(255,255,255,0.4)',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                        }}
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
                    <h2>PAUSED</h2>
                    <Button onClick={resume}>▶ Resume</Button>
                    <Button onClick={quit}>← Quit</Button>
                </Overlay>
            )}

            {state === 'gameover' && (
                <Overlay>
                    <h2 style={isNewHigh ? { color: '#ffd700' } : {}}>
                        {isNewHigh ? '🏆 NEW HIGH SCORE!' : 'GAME OVER'}
                    </h2>
                    <div style={{ fontSize: '3rem', fontWeight: 800, margin: '1rem 0' }}>{score}</div>
                    {highScore > 0 && !isNewHigh && (
                        <p style={{ opacity: 0.5 }}>High Score: {highScore}</p>
                    )}
                    <Button onClick={restart}>🔄 Play Again</Button>
                    <Button onClick={quit}>← Back</Button>
                </Overlay>
            )}
        </div>
    );
}

function Overlay({ children }: { children: React.ReactNode }) {
    return <div style={overlayStyle}>{children}</div>;
}

function Button({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '0.75rem 2rem',
                margin: '0.5rem',
                background: primary ? 'linear-gradient(135deg, #00ff88, #00cc66)' : '#333',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: primary ? '1.2rem' : '1rem',
                fontWeight: 600,
                cursor: 'pointer',
            }}
        >
            {children}
        </button>
    );
}

const containerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: '#0a0a0f',
    overflow: 'hidden',
};

const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'rgba(10, 10, 15, 0.95)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    textAlign: 'center',
};

const titleStyle: React.CSSProperties = {
    fontSize: '2.5rem',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #00ff88, #00ccff)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '0.5rem',
};
