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
        <div className="h-full w-full overflow-y-auto px-12 pt-32 pb-32 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Header: Hall of Fame Style */}
            <div className="relative mb-20 flex flex-col md:flex-row md:items-end justify-between gap-12">
                <div className="flex items-center gap-8">
                    <div className="w-24 h-24 glass-panel border-amber-500/30 flex items-center justify-center relative group">
                        <div className="absolute inset-0 bg-amber-500/10 blur-xl group-hover:bg-amber-500/20 transition-all" />
                        <Trophy className="text-amber-400 relative z-10" size={40} />
                    </div>
                    <div>
                        <h1 className="text-5xl font-bold text-white tracking-tight leading-none">Achievements</h1>
                        <p className="text-white/40 font-mono text-xs mt-3 tracking-wide">
                            Milestones and trophies earned across all titles
                        </p>
                    </div>
                </div>

                {/* Premium Progress Bar */}
                <div className="w-full max-w-md">
                    <div className="flex justify-between text-[10px] font-mono mb-3 uppercase tracking-widest px-2">
                        <span className="text-white/30">Completion</span>
                        <span className="text-amber-400">{stats.unlocked} / {stats.total} Unlocked</span>
                    </div>
                    <div className="h-2 glass-panel border-white/5 bg-white/[0.02] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 mb-12">
                <div className="h-[1px] flex-1 bg-white/5" />
                <h2 className="text-[10px] text-white/20 tracking-[0.3em] uppercase italic px-4">My Trophies</h2>
                <div className="h-[1px] flex-1 bg-white/5" />
            </div>

            {/* Achievements Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8">
                {achievements.map((achievement) => (
                    <div
                        key={`${achievement.game_slug}-${achievement.slug}`}
                        className={`
                            relative p-8 rounded-[32px] glass-panel border transition-all duration-500 group overflow-hidden
                            ${achievement.unlocked
                                ? 'border-amber-500/20 bg-amber-500/[0.02] hover:border-amber-500/40 hover:scale-[1.02]'
                                : 'border-white/5 opacity-50 grayscale hover:opacity-100 hover:grayscale-0'}
                        `}
                    >
                        {/* Background Shine for Unlocked */}
                        {achievement.unlocked && (
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2 group-hover:bg-amber-500/10 transition-all duration-700" />
                        )}

                        <div className="relative flex items-center gap-6">
                            {/* Icon Box: High-Fidelity */}
                            <div className={`
                                w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shadow-2xl relative transition-all duration-500 group-hover:scale-110
                                ${achievement.unlocked
                                    ? 'glass-panel border-amber-500/30 text-white shadow-amber-500/20'
                                    : 'glass-panel border-white/10 text-white/10'}
                            `}>
                                {achievement.unlocked ? (achievement.icon || '🏆') : <Lock size={24} className="text-white/10" />}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${achievement.unlocked ? 'border-amber-500/30 text-amber-500/80 bg-amber-500/5' : 'border-white/10 text-white/20'} uppercase tracking-tighter`}>
                                        {achievement.game_slug}
                                    </span>
                                </div>
                                <h3 className={`font-bold text-xl tracking-tight mb-1 truncate ${achievement.unlocked ? 'text-white' : 'text-white/40'}`}>
                                    {achievement.title}
                                </h3>
                                <p className="text-[11px] text-white/20 font-mono leading-relaxed line-clamp-2 uppercase tracking-tight group-hover:text-white/40 transition-colors">
                                    {achievement.description}
                                </p>
                            </div>
                        </div>

                        {achievement.unlocked && (
                            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                                <div className="text-[8px] text-amber-500/50 tracking-widest flex items-center gap-2">
                                    <Award size={10} />
                                    Unlocked
                                </div>
                                <div className="text-[10px] font-mono text-white/10">{achievement.game_slug}</div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {!isLoading && achievements.length === 0 && (
                <div className="flex flex-col items-center justify-center py-32 glass-panel border-white/5 bg-white/[0.02]">
                    <Medal size={64} className="text-white/10 mb-8" />
                    <h3 className="text-xl font-bold text-white tracking-tight">No achievements yet</h3>
                    <p className="text-white/20 font-mono text-[10px] mt-4 tracking-widest">Play games to unlock milestones</p>
                </div>
            )}
        </div>
    );
}
