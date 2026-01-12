import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { statsApi } from '../../api/client';
import type { Game, GameStats } from '../../api/client';
import { useGamepad } from '../../hooks/useGamepad';

const formatPlaytime = (seconds: number) => {
    if (seconds === 0) return '--';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    if (mins > 0) return `${mins}m`;
    return `${seconds}s`;
};

interface GameCarouselProps {
    games: Game[];
    activeIndex: number;
    onSelect: (index: number) => void;
}

export function GameCarousel({ games, activeIndex, onSelect }: GameCarouselProps) {
    const navigate = useNavigate();
    const [gameStats, setGameStats] = useState<Record<string, GameStats>>({});

    useGamepad((button) => {
        if (button === 'Left') {
            onSelect((activeIndex - 1 + games.length) % games.length);
        } else if (button === 'Right') {
            onSelect((activeIndex + 1) % games.length);
        } else if (button === 'A') {
            const game = games[activeIndex];
            if (game) navigate(`/play/${game.slug}`);
        }
    }, [activeIndex, games, onSelect, navigate]);

    useEffect(() => {
        const loadStats = async () => {
            try {
                const overall = await statsApi.getOverall();
                const statsMap: Record<string, GameStats> = {};
                overall.games.forEach(g => {
                    statsMap[g.game_slug] = g;
                });
                setGameStats(statsMap);
            } catch (e) {
                console.error('Failed to load stats:', e);
            }
        };
        loadStats();
    }, []);

    return (
        <div className="relative w-full h-[60vh] flex flex-col justify-center overflow-visible">
            {/* Main Carousel List */}
            <div className="relative flex items-center justify-center h-[400px]">
                {games.map((game, i) => {
                    const offset = i - activeIndex;
                    const isActive = i === activeIndex;
                    const stats = gameStats[game.slug];

                    // Calculate position and scale based on offset
                    const translateX = offset * 420;
                    const scale = isActive ? 1.1 : 0.8;
                    const opacity = Math.max(0, 1 - Math.abs(offset) * 0.5);
                    const zIndex = 10 - Math.abs(offset);

                    return (
                        <div
                            key={game.id}
                            className="absolute transition-all duration-700 ease-[var(--ease-out-expo)] cursor-pointer"
                            style={{
                                transform: `translateX(${translateX}px) scale(${scale})`,
                                opacity,
                                zIndex,
                                filter: isActive ? 'none' : 'blur(4px)',
                            }}
                            onClick={() => onSelect(i)}
                        >
                            {/* Game Card */}
                            <div className={`w-[360px] h-[480px] rounded-[32px] overflow-hidden relative border transition-all duration-500
                                ${isActive ? 'border-cyan-400/50 shadow-[0_0_50px_rgba(0,243,255,0.2)]' : 'border-white/5'}`}
                            >
                                <div
                                    className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110"
                                    style={{
                                        backgroundImage: `url(${game.thumbnail || 'https://images.unsplash.com/photo-1542751371-adc38448a05e'})`,
                                        backgroundColor: '#0a0a0f'
                                    }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#020205] via-[#020205]/40 to-transparent" />

                                {/* Card Content */}
                                <div className={`absolute bottom-0 left-0 right-0 p-8 flex flex-col gap-4 transform transition-all duration-500 ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                                    <div className="flex flex-col">
                                        <div className="text-[10px] font-pixel text-cyan-400 uppercase tracking-tighter mb-2">Category: {game.category}</div>
                                        <h2 className="text-3xl font-bold text-white tracking-wide leading-tight">{game.title}</h2>
                                    </div>

                                    {/* Stats - Hover/Active only */}
                                    <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest">High Score</span>
                                            <span className="text-sm font-bold text-amber-400">{stats?.high_score ?? '0'}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest">Time</span>
                                            <span className="text-sm font-bold text-white/80">{stats ? formatPlaytime(stats.total_playtime_seconds) : '--'}</span>
                                        </div>
                                    </div>

                                    {/* Console Launch Button */}
                                    <button
                                        className="mt-2 glass-panel h-14 rounded-2xl flex items-center justify-center gap-3 hover:neon-border-cyan transition-all active:scale-95 group font-bold tracking-[0.2em] text-xs"
                                        onClick={(e) => { e.stopPropagation(); navigate(`/play/${game.slug}`); }}
                                    >
                                        <Play size={16} className="fill-current" />
                                        PRESS TO START
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
