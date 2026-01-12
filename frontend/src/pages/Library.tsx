/**
 * Library Page - Arcus
 * Shows games the user has added to their library
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { libraryApi } from '../api/client';
import type { LibraryEntry } from '../api/client';
import { AetherGameCard } from '../components/aether/AetherGameCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Library as LibraryIcon, Plus, Trash2 } from 'lucide-react';

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
        return <div className="flex h-full items-center justify-center"><LoadingSpinner text="Loading Library..." /></div>;
    }

    return (
        <div className="h-full w-full overflow-y-auto p-12 pt-24 pb-32 animate-in fade-in zoom-in-95 duration-500">
            {/* Header */}
            <div className="mb-12">
                <div className="flex items-center gap-4 mb-2">
                    <LibraryIcon className="text-cyan-400" size={48} />
                    <h1 className="text-6xl font-black uppercase tracking-tighter text-white">Library</h1>
                </div>
                <p className="text-white/50 font-mono uppercase tracking-widest text-sm">
                    Your installed games
                </p>
            </div>

            {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                        <Plus className="text-white/30" size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-white/70 mb-2">Library Empty</h3>
                    <p className="text-white/40 font-mono text-sm mb-6 max-w-md">
                        Visit the Store to discover and install neural experiences.
                    </p>
                    <button
                        onClick={() => navigate('/store')}
                        className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-bold uppercase tracking-wider rounded-lg transition-colors"
                    >
                        Browse Store
                    </button>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-mono text-white/50 uppercase tracking-wider">
                            {entries.length} {entries.length === 1 ? 'Game' : 'Games'} Installed
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {entries.map((entry) => (
                            <div key={entry.id} className="relative group/card">
                                <AetherGameCard
                                    game={entry.game}
                                    variant="library"
                                    actionLabel="LAUNCH"
                                    onClick={() => navigate(`/play/${entry.game.slug}`)}
                                />
                                {/* Remove button - appears on hover */}
                                <button
                                    onClick={(e) => handleRemove(entry.game.id, e)}
                                    disabled={removingId === entry.game.id}
                                    className="absolute top-4 right-4 p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover/card:opacity-100 transition-all disabled:opacity-50"
                                    title="Remove from library"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
