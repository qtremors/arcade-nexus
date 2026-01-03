/**
 * Achievements Page - Global achievements list
 */
import { useEffect, useState } from 'react';
import { Trophy, Lock, Medal, Award } from 'lucide-react';
import { achievementsApi } from '../api/client';
import type { Achievement } from '../api/client';

export function Achievements() {
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [stats, setStats] = useState({ total: 0, unlocked: 0 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadAchievements = async () => {
            try {
                const data = await achievementsApi.getAll();
                setAchievements(data.achievements);
                setStats({ total: data.total, unlocked: data.unlocked_count });
            } catch (err) {
                console.error('Failed to load achievements:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadAchievements();
    }, []);

    const progress = stats.total > 0 ? (stats.unlocked / stats.total) * 100 : 0;

    return (
        <div className="h-full w-full overflow-y-auto p-12 pt-24 pb-32 animate-in fade-in zoom-in-95 duration-500">
            {/* Header */}
            <div className="mb-12">
                <h1 className="text-6xl font-black uppercase tracking-tighter text-white mb-2">Achievements</h1>

                {/* Progress Bar */}
                <div className="w-full max-w-xl mt-6">
                    <div className="flex justify-between text-white/50 text-sm font-mono mb-2 uppercase tracking-widest">
                        <span>Total Progress</span>
                        <span>{stats.unlocked} / {stats.total} Unlocked</span>
                    </div>
                    <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/10">
                        <div
                            className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 transition-all duration-1000 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Achievements Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {achievements.map((achievement) => (
                    <div
                        key={`${achievement.game_slug}-${achievement.slug}`}
                        className={`
                            relative p-6 rounded-2xl border transition-all duration-300 group
                            ${achievement.unlocked
                                ? 'bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border-yellow-500/20 hover:border-yellow-500/40'
                                : 'bg-white/5 border-white/10 hover:bg-white/10'}
                        `}
                    >
                        {/* Glow Effect for Unlocked */}
                        {achievement.unlocked && (
                            <div className="absolute inset-0 bg-yellow-500/5 blur-xl rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}

                        <div className="relative flex items-start gap-4">
                            {/* Icon Box */}
                            <div className={`
                                w-16 h-16 rounded-xl flex items-center justify-center text-3xl shadow-lg
                                ${achievement.unlocked
                                    ? 'bg-gradient-to-br from-yellow-500 to-amber-600 text-white shadow-yellow-500/20'
                                    : 'bg-black/40 text-white/20 border border-white/5'}
                            `}>
                                {achievement.unlocked ? (achievement.icon || <Trophy />) : <Lock size={24} />}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className={`font-bold text-lg mb-1 truncate ${achievement.unlocked ? 'text-white' : 'text-white/50'}`}>
                                    {achievement.title}
                                </h3>
                                <p className="text-sm text-white/40 leading-relaxed line-clamp-2">
                                    {achievement.description}
                                </p>

                                <div className="mt-4 flex items-center justify-between">
                                    <div className="text-xs font-mono uppercase tracking-wider px-2 py-1 rounded bg-white/5 text-white/30 border border-white/5">
                                        {achievement.game_slug}
                                    </div>
                                    {achievement.unlocked && (
                                        <div className="text-xs font-mono uppercase tracking-wider text-yellow-500/80 flex items-center gap-1">
                                            <Award size={12} />
                                            Unlocked
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {!isLoading && achievements.length === 0 && (
                <div className="text-center py-24 text-white/30">
                    <Medal size={64} className="mx-auto mb-4 opacity-20" />
                    <h3 className="text-xl font-bold">No Achievements Found</h3>
                    <p className="mt-2">Play games to discover new challenges!</p>
                </div>
            )}
        </div>
    );
}
