import { useEffect, useState, useCallback, useMemo } from 'react';
import { gamesApi, statsApi } from '../api/client';
import type { Game, GameStats } from '../api/client';
import { GameCarousel } from '../components/arcus/GameCarousel';

const getGameTheme = (gameId: number) => {
    const themes = [
        { bg: "#00f3ff", opacity: 0.15 },
        { bg: "#ff00ff", opacity: 0.15 },
        { bg: "#00ff88", opacity: 0.15 },
        { bg: "#ffcc00", opacity: 0.15 },
    ];
    return themes[gameId % themes.length];
};

export function Dashboard() {
    const [games, setGames] = useState<Game[]>([]);
    const [recentStats, setRecentStats] = useState<GameStats[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [gamesRes, statsRes] = await Promise.all([
                    gamesApi.list(),
                    statsApi.getOverall()
                ]);
                setGames(gamesRes.games);
                setRecentStats(statsRes.games);
                setActiveIndex(0);
            } catch (err) {
                console.error('Failed to load data:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const recentGames = useMemo(() => {
        return recentStats
            .filter(s => s.last_session)
            .sort((a, b) => new Date(b.last_session!).getTime() - new Date(a.last_session!).getTime())
            .slice(0, 5)
            .map(stat => games.find(g => g.slug === stat.game_slug))
            .filter((g): g is Game => !!g);
    }, [recentStats, games]);

    const displayGames = recentGames.length > 0 ? recentGames : games;

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (displayGames.length === 0) return;
        if (e.key === 'ArrowRight') {
            setActiveIndex((prev) => (prev + 1) % displayGames.length);
        } else if (e.key === 'ArrowLeft') {
            setActiveIndex((prev) => (prev - 1 + displayGames.length) % displayGames.length);
        }
    }, [displayGames]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const activeGame = displayGames[activeIndex];
    const theme = useMemo(() => {
        return activeGame ? getGameTheme(activeGame.id) : { bg: '#00f3ff', opacity: 0.15 };
    }, [activeGame]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-6">
                <div className="w-16 h-16 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                <div className="text-cyan-400 font-pixel text-[10px] tracking-widest animate-pulse">CONNECTING TO NEXUS...</div>
            </div>
        );
    }

    if (displayGames.length === 0) {
        return <div className="flex items-center justify-center h-full text-white/20 font-mono tracking-[1em]">NO DATA FOUND</div>;
    }

    return (
        <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
            {/* Immersive Ambient Glow */}
            <div
                className="fixed inset-0 transition-colors duration-1000 ease-in-out z-[-1]"
                style={{
                    background: `radial-gradient(circle at 50% 50%, ${theme.bg}22 0%, transparent 70%)`,
                }}
            />

            <div className="w-full flex flex-col items-center gap-12">
                <div className="flex flex-col items-center gap-2">
                    <span className="text-[10px] font-pixel text-white/30 tracking-widest uppercase italic">Select Experience</span>
                    <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-cyan-400 transition-all duration-500 ease-out"
                            style={{ width: `${((activeIndex + 1) / displayGames.length) * 100}%` }}
                        />
                    </div>
                </div>

                <GameCarousel
                    games={displayGames}
                    activeIndex={activeIndex}
                    onSelect={setActiveIndex}
                />

                {/* Navigation Hint */}
                <div className="flex items-center gap-12 text-white/20">
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[9px] font-mono tracking-widest">PREV</span>
                        <div className="w-8 h-[1px] bg-white/10" />
                    </div>
                    <div className="flex gap-4">
                        {displayGames.map((_, i) => (
                            <div
                                key={i}
                                className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${i === activeIndex ? 'bg-cyan-400 scale-125 shadow-[0_0_8px_#00f3ff]' : 'bg-white/10'}`}
                            />
                        ))}
                    </div>
                    <div className="flex flex-col items-start gap-1">
                        <span className="text-[9px] font-mono tracking-widest">NEXT</span>
                        <div className="w-8 h-[1px] bg-white/10" />
                    </div>
                </div>
            </div>
        </div>
    );
}

