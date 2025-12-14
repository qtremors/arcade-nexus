/**
 * Store Page - Aether OS
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { gamesApi, libraryApi } from '../api/client';
import type { Game } from '../api/client';
import { AetherGameCard } from '../components/aether/AetherGameCard';
import { Search, Tag, Filter, ShoppingBag, Check } from 'lucide-react';

export function Store() {
    const [games, setGames] = useState<Game[]>([]);
    const [libraryGameIds, setLibraryGameIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [addingGameId, setAddingGameId] = useState<number | null>(null);
    const navigate = useNavigate();

    // Fetch games and library
    const fetchData = useCallback(async (search?: string) => {
        try {
            setLoading(true);
            const [gamesResponse, libraryResponse] = await Promise.all([
                gamesApi.list(undefined, search),
                libraryApi.list()
            ]);
            setGames(gamesResponse.games);
            setLibraryGameIds(new Set(libraryResponse.map(entry => entry.game.id)));
        } catch (error) {
            console.error('Failed to load store:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData(searchQuery || undefined);
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [searchQuery, fetchData]);

    // Add game to library
    const handleAddToLibrary = async (game: Game) => {
        if (libraryGameIds.has(game.id)) {
            // Already in library - navigate to play
            navigate(`/play/${game.slug}`);
            return;
        }

        setAddingGameId(game.id);
        try {
            await libraryApi.add(game.id);
            setLibraryGameIds(prev => new Set([...prev, game.id]));
        } catch (error) {
            console.error('Failed to add to library:', error);
        } finally {
            setAddingGameId(null);
        }
    };

    if (loading && games.length === 0) {
        return <div className="flex h-full items-center justify-center text-white/50 font-mono">ESTABLISHING UPLINK...</div>;
    }

    return (
        <div className="h-full w-full overflow-y-auto p-12 pt-24 pb-32">

            {/* Header Area */}
            <div className="mb-12">
                <div className="flex items-center gap-4 mb-2">
                    <ShoppingBag className="text-cyan-400" size={48} />
                    <h1 className="text-6xl font-black uppercase tracking-tighter text-white">Store</h1>
                </div>
                <p className="text-white/50 font-mono uppercase tracking-widest text-sm mb-8 pl-16">
                    Discover new neural experiences.
                </p>

                {/* Filter Bar */}
                <div className="flex flex-wrap items-center gap-4">
                    {/* Search */}
                    <div className="flex-1 min-w-[300px] flex items-center gap-4 bg-white/5 px-6 py-4 rounded-xl border border-white/10 focus-within:border-cyan-500/50 focus-within:bg-white/10 transition-all">
                        <Search className="text-white/50" size={20} />
                        <input
                            type="text"
                            placeholder="SEARCH CATALOG..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent border-none outline-none text-white text-base font-mono placeholder-white/30 w-full"
                        />
                    </div>

                    {/* Category Dropdown (Stub) */}
                    <button className="flex items-center gap-2 px-6 py-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all text-white/70">
                        <Filter size={18} />
                        <span className="font-mono text-sm uppercase">All Categories</span>
                    </button>

                    <button className="flex items-center gap-2 px-6 py-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all text-white/70">
                        <Tag size={18} />
                        <span className="font-mono text-sm uppercase">Top Rated</span>
                    </button>
                </div>
            </div>

            {/* Featured / Grid */}
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <span className="w-2 h-8 bg-cyan-500 block rounded-full"></span>
                FEATURED TITLES
            </h2>

            {games.length === 0 ? (
                <div className="text-center py-20 text-white/50 font-mono uppercase tracking-wider">
                    No games found
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {games.map((game) => {
                        const isInLibrary = libraryGameIds.has(game.id);
                        const isAdding = addingGameId === game.id;

                        return (
                            <AetherGameCard
                                key={game.id}
                                game={game}
                                variant="store"
                                actionLabel={isAdding ? "ADDING..." : isInLibrary ? "PLAY" : "INSTALL"}
                                onClick={() => handleAddToLibrary(game)}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
