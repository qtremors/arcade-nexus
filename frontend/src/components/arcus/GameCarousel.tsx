import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { statsApi } from '../../api/client';
import type { Game, GameStats } from '../../api/client';
import { useGamepad } from '../../hooks/useGamepad';
import { formatPlaytime } from '../../utils/formatting';

interface GameCarouselProps {
    games: Game[];
    activeIndex: number;
    onSelect: (index: number) => void;
}

export function GameCarousel({ games, activeIndex, onSelect }: GameCarouselProps) {
    const navigate = useNavigate();
    const [gameStats, setGameStats] = useState<Record<string, GameStats>>({});

    useGamepad((button) => {
        if (games.length === 0) return;
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
                            {/* Game Card - Console Solid Style */}
                            <div className={`w-[360px] h-[520px] rounded-[24px] overflow-hidden relative flex flex-col transition-all duration-500
                                ${isActive ? 'scale-100 shadow-2xl shadow-cyan-900/40' : 'scale-95 grayscale-[0.5]'}`}
                            >
                                {/* Image Section */}
                                <div className="relative h-[65%] w-full bg-zinc-900 overflow-hidden">
                                    <div
                                        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110"
                                        style={{
                                            backgroundImage: `url(${game.thumbnail || 'https://images.unsplash.com/photo-1542751371-adc38448a05e'})`,
                                        }}
                                    />
                                </div>

                                {/* Content Section - Solid Panel */}
                                <div className={`flex-1 w-full bg-[#1e1e24] p-6 flex flex-col justify-between border-t-4 ${isActive ? 'border-cyan-500' : 'border-zinc-700'}`}>
                                    <div>
                                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">{game.category}</div>
                                        <h2 className="text-2xl font-bold text-white leading-tight truncate">{game.title}</h2>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-4 my-2">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Score</span>
                                            <span className="text-sm font-bold text-emerald-400">{stats?.high_score ?? '0'}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Time</span>
                                            <span className="text-sm font-bold text-zinc-400">{stats ? formatPlaytime(stats.total_playtime_seconds) : '--'}</span>
                                        </div>
                                    </div>

                                    {/* Console Launch Button */}
                                    <button
                                        className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 font-bold tracking-wider text-xs transition-all
                                        ${isActive
                                                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 transform hover:-translate-y-1'
                                                : 'bg-zinc-800 text-zinc-500 cursor-default'}`}
                                        onClick={(e) => {
                                            if (!isActive) return;
                                            e.stopPropagation();
                                            navigate(`/play/${game.slug}`);
                                        }}
                                    >
                                        <Play size={16} className={isActive ? "fill-black" : "fill-zinc-500"} />
                                        {isActive ? 'START GAME' : 'SELECT'}
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
