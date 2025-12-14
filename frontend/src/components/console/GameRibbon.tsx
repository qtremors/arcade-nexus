import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFocusable } from '../../contexts/FocusContext';
import type { Game } from '../../api/client';

interface GameRibbonProps {
    games: Game[];
    onSelect: (game: Game) => void;
}

export function GameRibbon({ games, onSelect }: GameRibbonProps) {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);

    // Scroll container when focus changes
    // We need to listen to focus changes globally or per item. 
    // The items themselves know if they are focused.

    return (
        <div
            ref={containerRef}
            style={{
                display: 'flex',
                gap: '2rem',
                padding: '0 4rem', // Center-ish padding
                overflowX: 'visible', // Allow overflow for "infinite" feel visuals? No, hidden for main scroll
                // overflowX: 'auto', // We will manually transform/scroll
                width: '100%',
                position: 'relative',
                zIndex: 10,
                perspective: '1000px', // key for 3D effect
                height: '400px',
                alignItems: 'center',
                transition: 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
        >
            {games.map((game, index) => (
                <RibbonItem
                    key={game.id}
                    game={game}
                    index={index}
                    onSelect={() => onSelect(game)}
                    onEnter={() => navigate(`/play/${game.slug}`)}
                />
            ))}
        </div>
    );
}

function RibbonItem({ game, index, onSelect, onEnter }: { game: Game, index: number, onSelect: () => void, onEnter: () => void }) {
    const { focused, focus } = useFocusable(`game-${index}`, 'ribbon', onEnter);
    const itemRef = useRef<HTMLDivElement>(null);

    // When focused, tell parent/layout to select this game
    useEffect(() => {
        if (focused) {
            onSelect();
            // Scroll into view logic
            itemRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });
        }
    }, [focused, onSelect]);

    return (
        <div
            ref={itemRef}
            onClick={focus}
            style={{
                minWidth: '260px',
                height: '360px',
                borderRadius: '24px',
                background: focused ? 'white' : 'rgba(255,255,255,0.1)', // Active vs Passive
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
                transform: focused
                    ? 'scale(1.15) translateY(-20px) rotateY(0deg)'
                    : 'scale(0.9) rotateY(5deg)', // Slight 3D rotation for non-focused
                opacity: focused ? 1 : 0.6,
                boxShadow: focused
                    ? '0 20px 50px rgba(0, 243, 255, 0.3), 0 0 0 4px rgba(255,255,255,1)'
                    : '0 10px 20px rgba(0,0,0,0.3)',
                cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.1)'
            }}
        >
            {/* Image Layer */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: game.thumbnail ? `url(${game.thumbnail}) center/cover` : 'linear-gradient(45deg, #333, #111)',
                filter: focused ? 'none' : 'grayscale(60%) brightness(0.7)',
                transition: 'filter 0.4s'
            }}>
                {/* Fallback Icon */}
                {!game.thumbnail && (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem' }}>
                        👾
                    </div>
                )}
            </div>

            {/* Info Layer (Visible on Focus) */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '1.5rem',
                background: 'linear-gradient(to top, rgba(0,0,0,1), transparent)',
                opacity: focused ? 1 : 0,
                transform: focused ? 'translateY(0)' : 'translateY(20px)',
                transition: 'all 0.3s 0.1s'
            }}>
                <div style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    color: 'var(--accent)',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    marginBottom: '0.25rem'
                }}>
                    {game.category}
                </div>
                <h3 style={{ margin: 0, fontSize: '1.5rem', lineHeight: 1.1 }}>{game.title}</h3>
            </div>
        </div>
    );
}
