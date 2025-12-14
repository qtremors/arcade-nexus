/**
 * GamePlayer Page - Play a game using the Game SDK
 * Fullscreen game experience - NO UI elements during gameplay
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gamesApi } from '../api/client';
import type { Game } from '../api/client';
import { GameCanvas } from '../components/GameCanvas';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Import games to register them
import '../games';

export function GamePlayer() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const [game, setGame] = useState<Game | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadGame = async () => {
            if (!slug) return;
            try {
                const gameData = await gamesApi.get(slug);
                setGame(gameData);
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setIsLoading(false);
            }
        };
        loadGame();
    }, [slug]);

    const handleGameOver = (score: number) => {
        if (import.meta.env.DEV) {
            console.log(`[GamePlayer] Game over with score: ${score}`);
        }
    };

    // Fullscreen container - NO top bar, NO borders
    const containerStyle: React.CSSProperties = {
        position: 'fixed',
        inset: 0,
        background: '#0a0a0f',
        overflow: 'hidden',
    };

    const centerStyle: React.CSSProperties = {
        ...containerStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
    };

    if (isLoading) {
        return (
            <div style={centerStyle}>
                <div style={{ fontSize: '1.5rem', opacity: 0.5 }}>Loading...</div>
            </div>
        );
    }

    if (error || !game) {
        return (
            <div style={centerStyle}>
                <h2 style={{ color: '#ff4466', marginBottom: '1rem' }}>Failed to load game</h2>
                <p style={{ opacity: 0.6, marginBottom: '2rem' }}>{error || 'Game not found'}</p>
                <button
                    onClick={() => navigate('/home')}
                    style={{
                        padding: '0.75rem 2rem',
                        background: '#222',
                        border: '1px solid #444',
                        color: '#fff',
                        borderRadius: '8px',
                        cursor: 'pointer',
                    }}
                >
                    ← Back to Console
                </button>
            </div>
        );
    }

    // Clean fullscreen - GameCanvas handles ALL overlays
    return (
        <div style={containerStyle}>
            <ErrorBoundary
                fallback={
                    <div style={centerStyle}>
                        <h2 style={{ color: '#ff4466', marginBottom: '1rem' }}>Game crashed</h2>
                        <button
                            onClick={() => navigate('/home')}
                            style={{
                                padding: '0.75rem 2rem',
                                background: '#222',
                                border: '1px solid #444',
                                color: '#fff',
                                borderRadius: '8px',
                                cursor: 'pointer',
                            }}
                        >
                            ← Back to Console
                        </button>
                    </div>
                }
            >
                <GameCanvas
                    slug={slug!}
                    title={game.title}
                    onGameOver={handleGameOver}
                />
            </ErrorBoundary>
        </div>
    );
}
