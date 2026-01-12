import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { gamesApi, libraryApi } from '../api/client';
import type { Game } from '../api/client';
import { GameCard } from '../components/arcus/GameCard';
import { Search, Filter, ShoppingBag, Construction } from 'lucide-react';

export function Store() {
    const [games, setGames] = useState<Game[]>([]);
    const [libraryGameIds, setLibraryGameIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [addingGameId, setAddingGameId] = useState<number | null>(null);
    const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const navigate = useNavigate();

    const fetchData = useCallback(async (search?: string, category?: string | null) => {
        try {
            setLoading(true);
            const [gamesResponse, libraryResponse] = await Promise.all([
                gamesApi.list(category || undefined, search),
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

    useEffect(() => {
        gamesApi.getCategories().then(setCategories).catch(console.error);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData(searchQuery || undefined, selectedCategory);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, selectedCategory, fetchData]);

    const handleAddToLibrary = async (game: Game) => {
        if (libraryGameIds.has(game.id)) {
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
        return (
            <div className="flex flex-col items-center justify-center h-full gap-6">
                <div className="w-16 h-16 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                <div className="text-cyan-400 font-mono text-[10px] tracking-widest animate-pulse">Loading games...</div>
            </div>
        );
    }

    return (
        <div className="h-full w-full overflow-y-auto px-12 pt-32 pb-32">

            {/* Header Area */}
            <div className="relative mb-20">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
                    <div className="flex items-center gap-8">
                        <div className="w-24 h-24 glass-panel border-cyan-400/30 flex items-center justify-center relative group">
                            <div className="absolute inset-0 bg-cyan-400/10 blur-xl group-hover:bg-cyan-400/20 transition-all" />
                            <ShoppingBag className="text-cyan-400 relative z-10" size={40} />
                        </div>
                        <div>
                            <h1 className="text-5xl font-bold text-white tracking-tight leading-none">Game Store</h1>
                            <p className="text-white/40 font-mono text-xs mt-3 tracking-wide">
                                Browse Games // Discover and add new titles
                            </p>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="glass-panel h-14 px-6 flex items-center gap-4 border-white/5 focus-within:border-cyan-400/30 transition-all group">
                            <Search size={18} className="text-white/20 group-focus-within:text-cyan-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search games..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-transparent border-none text-white font-mono text-xs placeholder-white/10 focus:outline-none w-64"
                            />
                        </div>

                        <div className="relative glass-panel h-14 px-6 flex items-center gap-4 border-white/5 hover:border-white/20 transition-all cursor-pointer">
                            <Filter size={16} className="text-cyan-400" />
                            <span className="font-mono text-[10px] tracking-widest text-white/50 uppercase">
                                {selectedCategory ? categories.find(c => c.value === selectedCategory)?.label : "All Categories"}
                            </span>
                            <select
                                value={selectedCategory || ''}
                                onChange={(e) => setSelectedCategory(e.target.value || null)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            >
                                <option value="">All Categories</option>
                                {categories.map((cat) => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 mb-10">
                <div className="h-[1px] flex-1 bg-white/5" />
                <h2 className="text-[10px] text-white/20 tracking-[0.3em] uppercase italic px-4">Available Games</h2>
                <div className="h-[1px] flex-1 bg-white/5" />
            </div>

            {games.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 glass-panel border-white/5 bg-white/[0.02]">
                    <Search size={48} className="text-white/10 mb-8" />
                    <h3 className="text-xl font-bold text-white tracking-tight">No games found</h3>
                    <p className="text-white/20 font-mono text-[10px] mt-4 tracking-widest">Try a different search term</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    {games.map((game) => {
                        const isInLibrary = libraryGameIds.has(game.id);
                        const isAdding = addingGameId === game.id;
                        const isComingSoon = game.slug === 'stellar-flight';

                        return (
                            <GameCard
                                key={game.id}
                                game={game}
                                variant="store"
                                actionLabel={isComingSoon ? "UNAVAILABLE" : (isAdding ? "Adding..." : isInLibrary ? "Play" : "Get")}
                                onClick={isComingSoon ? () => { } : () => handleAddToLibrary(game)}
                                icon={isComingSoon ? <Construction size={14} /> : undefined}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
