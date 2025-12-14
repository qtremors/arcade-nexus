import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Clock, Zap } from 'lucide-react';
import { statsApi } from '../../api/client';
import type { Game, GameStats } from '../../api/client';

// Helper to generate a stable aesthetic for dynamic games
const getGameTheme = (gameId: number) => {
    const themes = [
        { bg: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)", color: "#00f3ff" },
        { bg: "linear-gradient(135deg, #200122, #6f0000)", color: "#ff0055" },
        { bg: "linear-gradient(135deg, #134e5e, #71b280)", color: "#00ff9d" },
        { bg: "linear-gradient(135deg, #23074d, #cc5333)", color: "#ffaa00" },
        { bg: "linear-gradient(135deg, #000000, #434343)", color: "#ffffff" },
    ];
    return themes[gameId % themes.length];
};

// Format playtime
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
    const radius = 400;
    const theta = 360 / Math.max(games.length, 1);

    // Fetch stats for all games
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
        <div className="relative w-full h-[50vh] perspective-1000 transform-style-3d flex items-center justify-center mb-20">
            <div
                className="relative w-full h-full transform-style-3d transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: `translateZ(-${radius}px) rotateY(${-activeIndex * theta}deg)` }}
            >
                {games.map((game, i) => {
                    const angle = theta * i;
                    const isActive = i === activeIndex;
                    const theme = getGameTheme(game.id);
                    const stats = gameStats[game.slug];

                    return (
                        <div
                            key={game.id}
                            className={`absolute top-1/2 left-1/2 -ml-[200px] -mt-[200px] w-[400px] h-[400px] transition-all duration-300 cursor-pointer`}
                            style={{
                                transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
                                opacity: isActive ? 1 : 0.3,
                                pointerEvents: isActive ? 'auto' : 'none',
                                willChange: 'transform, opacity',
                            }}
                            onClick={() => onSelect(i)}
                        >
                            {/* Card Container */}
                            <div
                                className={`w-full h-full rounded-3xl overflow-hidden relative border transition-all duration-300 group
                ${isActive ? 'border-white/50 scale-100' : 'border-transparent scale-90'}`}
                            >
                                {/* Background */}
                                <div
                                    className="absolute inset-0 bg-cover bg-center"
                                    style={{
                                        backgroundImage: `url(${game.thumbnail || 'https://images.unsplash.com/photo-1542751371-adc38448a05e'})`,
                                        backgroundColor: '#111'
                                    }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

                                {/* Content */}
                                <div className={`absolute bottom-0 left-0 right-0 p-6 transform transition-all duration-300 ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                                    <div
                                        className="w-10 h-1 mb-4 rounded-full transition-colors duration-300"
                                        style={{ backgroundColor: theme.color }}
                                    />

                                    <h2 className="text-3xl font-black text-white mb-1 leading-none uppercase tracking-tight">
                                        {game.title}
                                    </h2>
                                    <p className="text-white/50 font-mono text-xs tracking-widest uppercase mb-4">
                                        {game.category}
                                    </p>

                                    {/* Real Stats Grid */}
                                    <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
                                        <div>
                                            <div className="text-white/40 text-[9px] font-mono uppercase mb-1">Playtime</div>
                                            <div className="text-white font-bold text-sm flex items-center gap-1">
                                                <Clock size={10} className="text-cyan-400" />
                                                {stats ? formatPlaytime(stats.total_playtime_seconds) : '--'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-white/40 text-[9px] font-mono uppercase mb-1">High Score</div>
                                            <div className="text-white font-bold text-sm flex items-center gap-1">
                                                <Trophy size={10} className="text-yellow-500" />
                                                {stats?.high_score ?? '--'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-white/40 text-[9px] font-mono uppercase mb-1">Sessions</div>
                                            <div className="text-white font-bold text-sm flex items-center gap-1">
                                                <Zap size={10} className="text-purple-400" />
                                                {stats?.sessions_count ?? '--'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Play Button */}
                                    <div
                                        className="mt-5 flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/play/${game.slug}`);
                                        }}
                                    >
                                        <div className="w-7 h-7 rounded-full border border-white/30 flex items-center justify-center bg-white/10">
                                            <span className="text-white text-xs font-bold">▶</span>
                                        </div>
                                        <span className="text-white/80 text-sm font-semibold tracking-wide">PLAY NOW</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
