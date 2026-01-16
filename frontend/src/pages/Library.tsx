import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { libraryApi } from '../api/client';
import type { LibraryEntry } from '../api/client';
import { GameCard } from '../components/arcus/GameCard';
import { Library as LibraryIcon, Search, Download } from 'lucide-react';

export function Library() {
    const [entries, setEntries] = useState<LibraryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const navigate = useNavigate();

    const fetchLibrary = useCallback(async () => {
        try {
            setLoading(true);
            const data = await libraryApi.list();
            setEntries(data);
        } catch (error) {
            console.error('Failed to load library:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLibrary();
    }, [fetchLibrary]);

    const handleRemove = async (gameId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to remove this CORE from your local storage?')) return;

        setRemovingId(gameId);
        try {
            await libraryApi.remove(gameId);
            setEntries(prev => prev.filter(entry => entry.game.id !== gameId));
        } catch (error) {
            console.error('Failed to remove from library:', error);
        } finally {
            setRemovingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-6">
                <div className="w-16 h-16 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                <div className="text-cyan-400 font-mono text-[10px] tracking-widest animate-pulse">Loading games...</div>
            </div>
        );
    }

    return (
        <div className="h-full w-full overflow-y-auto px-12 pt-32 pb-32">
            {/* Header: Command Center Style */}
            <div className="relative mb-20 flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div className="flex items-center gap-8">
                    <div className="w-24 h-24 glass-panel border-cyan-400/30 flex items-center justify-center relative group">
                        <div className="absolute inset-0 bg-cyan-400/10 blur-xl group-hover:bg-cyan-400/20 transition-all" />
                        <LibraryIcon className="text-cyan-400 relative z-10" size={40} />
                    </div>
                    <div>
                        <h1 className="text-5xl font-bold text-white tracking-tight leading-none">My Library</h1>
                        <p className="text-white/40 font-mono text-xs mt-3 tracking-wide">
                            Stored Games // <span className="text-cyan-400/50">{entries.length} items</span> in your vault
                        </p>
                    </div>
                </div>

                {/* Filter/Search Bar Hook */}
                <div className="flex items-center gap-4">
                    <div className="glass-panel h-12 px-6 flex items-center gap-3 border-white/5 focus-within:border-cyan-400/30 transition-all">
                        <Search size={16} className="text-white/20" />
                        <input
                            type="text"
                            placeholder="Search games..."
                            className="bg-transparent border-none text-white font-mono text-xs placeholder-white/10 focus:outline-none w-48"
                        />
                    </div>
                </div>
            </div>

            {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 glass-panel border-white/5 bg-white/[0.02] rounded-[48px]">
                    <div className="w-32 h-32 rounded-full glass-panel border-white/5 flex items-center justify-center mb-10 relative">
                        <div className="absolute inset-0 bg-white/5 blur-3xl" />
                        <Download className="text-white/10 relative z-10" size={48} />
                    </div>
                    <h3 className="text-2xl font-bold text-white tracking-tight uppercase mb-4">Library Empty</h3>
                    <p className="text-white/40 font-mono text-[11px] mb-12 max-w-sm text-center leading-relaxed">
                        No games found in your library. <br /> Add games from the Store to get started.
                    </p>
                    <button
                        onClick={() => navigate('/store')}
                        className="glass-panel px-12 py-5 border-cyan-400/50 hover:neon-border-cyan group"
                    >
                        <span className="text-[10px] font-bold tracking-widest text-cyan-400 group-hover:text-white transition-colors uppercase">Go to Store</span>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    {entries.map((entry) => (
                        <div key={entry.id} className="relative group/card">
                            <GameCard
                                game={entry.game}
                                variant="library"
                                actionLabel="PLAY"
                                onClick={() => navigate(`/play/${entry.game.slug}`)}
                            />
                            {/* Premium Remove Action */}
                            <button
                                onClick={(e) => handleRemove(entry.game.id, e)}
                                disabled={removingId === entry.game.id}
                                className="absolute top-6 right-6 w-10 h-10 glass-panel border-red-500/20 hover:border-red-500 hover:bg-red-500/10 text-red-500/50 hover:text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-all duration-300 backdrop-blur-md"
                                title="Terminate Core"
                            >
                                <span className="text-[8px] font-black">X</span>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
