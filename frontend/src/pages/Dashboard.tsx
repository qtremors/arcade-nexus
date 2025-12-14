/**
 * Dashboard - Aether OS Home Screen
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { gamesApi } from '../api/client';
import type { Game } from '../api/client';
import { GameCarousel } from '../components/aether/GameCarousel';


// Helper to get theme for current game
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


export function Dashboard() {
    const [games, setGames] = useState<Game[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Initial Load
    useEffect(() => {
        const loadGames = async () => {
            try {
                const response = await gamesApi.list();
                setGames(response.games);
                // Clamp activeIndex to valid range
                setActiveIndex(prev => Math.min(prev, Math.max(0, response.games.length - 1)));
            } catch (err) {
                console.error('Failed to load games:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadGames();
    }, []);

    // Keyboard Nav (Arrow Keys) for Carousel
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (games.length === 0) return;

        if (e.key === 'ArrowRight') {
            setActiveIndex((prev) => (prev + 1) % games.length);
        } else if (e.key === 'ArrowLeft') {
            setActiveIndex((prev) => (prev - 1 + games.length) % games.length);
        }
    }, [games]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Memoize theme to prevent recalculation on every render
    const activeGame = games[activeIndex];
    const theme = useMemo(() => {
        return activeGame ? getGameTheme(activeGame.id) : { bg: 'linear-gradient(135deg, #0f0c29, #302b63)', color: '#00f3ff' };
    }, [activeGame]);

    if (isLoading) {
        return <div className="flex items-center justify-center h-full text-white font-mono">INITIALIZING...</div>;
    }

    if (games.length === 0) {
        return <div className="flex items-center justify-center h-full text-white font-mono">NO GAMES FOUND</div>;
    }

    return (
        <div className="relative w-full h-full flex flex-col justify-center">
            {/* Dynamic Ambient Background - Optimized with CSS transitions */}
            <div
                className="fixed inset-0 transition-[background] duration-700 ease-out z-[-1]"
                style={{ background: theme.bg }}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                <div className="absolute inset-0 bg-black/20" />
            </div>

            <GameCarousel
                games={games}
                activeIndex={activeIndex}
                onSelect={setActiveIndex}
            />

            {/* Navigation Hints */}
            <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center gap-8 text-white/30 z-20">
                <button
                    className="flex items-center gap-2 hover:text-white transition-colors group"
                    onClick={() => setActiveIndex((prev) => (prev - 1 + games.length) % games.length)}
                >
                    <div className="px-3 py-1 border border-white/20 rounded-lg text-xs font-mono group-hover:border-white">←</div>
                </button>

                <div className="flex gap-2">
                    {games.map((g, i) => (
                        <div
                            key={g.id}
                            className={`w-12 h-1 rounded-full transition-all duration-300 ${i === activeIndex ? 'bg-white' : 'bg-white/10'}`}
                        />
                    ))}
                </div>

                <button
                    className="flex items-center gap-2 hover:text-white transition-colors group"
                    onClick={() => setActiveIndex((prev) => (prev + 1) % games.length)}
                >
                    <div className="px-3 py-1 border border-white/20 rounded-lg text-xs font-mono group-hover:border-white">→</div>
                </button>
            </div>
        </div>
    );
}

