/**
 * Profile Page - User stats and profile management
 */
import { useEffect, useState } from 'react';
import { User, Trophy, Clock, Gamepad2, Activity, Pencil, Check, X, Plus, LogOut } from 'lucide-react';
import { useProfileStore } from '../stores/profileStore';
import { statsApi } from '../api/client';
import type { OverallStats } from '../api/client';

export function Profile() {
    const { activeProfile, profiles, updateProfile, switchProfile, createProfile, fetchProfiles } = useProfileStore();
    const [stats, setStats] = useState<OverallStats | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [showProfiles, setShowProfiles] = useState(false);
    const [showNewProfile, setShowNewProfile] = useState(false);
    const [newProfileName, setNewProfileName] = useState('');

    // Fetch real stats from backend
    useEffect(() => {
        const loadStats = async () => {
            try {
                const data = await statsApi.getOverall();
                setStats(data);
            } catch (err) {
                console.error('Failed to load stats:', err);
            }
        };
        loadStats();
    }, [activeProfile?.id]);

    // Refresh profiles on mount
    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    const handleEditStart = () => {
        setEditName(activeProfile?.username || '');
        setIsEditing(true);
    };

    const handleEditSave = async () => {
        if (!activeProfile || !editName.trim()) return;
        try {
            await updateProfile(activeProfile.id, { username: editName.trim() });
            setIsEditing(false);
        } catch (err) {
            console.error('Failed to update profile:', err);
        }
    };

    const handleEditCancel = () => {
        setIsEditing(false);
        setEditName('');
    };

    const handleSwitchProfile = async (id: number) => {
        try {
            await switchProfile(id);
            setShowProfiles(false);
        } catch (err) {
            console.error('Failed to switch profile:', err);
        }
    };

    const handleCreateProfile = async () => {
        if (!newProfileName.trim()) return;
        try {
            const newProfile = await createProfile(newProfileName.trim());
            await switchProfile(newProfile.id);
            setShowNewProfile(false);
            setNewProfileName('');
        } catch (err) {
            console.error('Failed to create profile:', err);
        }
    };

    const formatPlaytime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) return `${hours}h ${mins}m`;
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
    };

    return (
        <div className="h-full w-full overflow-y-auto p-12 pt-24 pb-32 animate-in fade-in zoom-in-95 duration-500">
            {/* Header */}
            <div className="mb-12">
                <h1 className="text-6xl font-black uppercase tracking-tighter text-white mb-2">Profile</h1>
                <p className="text-white/50 font-mono uppercase tracking-widest text-sm">
                    Neural Identity • Local Access Only
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ID Card */}
                <div className="col-span-1 lg:col-span-1 bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 p-[2px] mb-6 shadow-lg shadow-cyan-500/20">
                        <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-white text-5xl">
                            {activeProfile?.avatar || <User size={48} />}
                        </div>
                    </div>

                    <div className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1">Local Player</div>

                    {/* Editable Name */}
                    {isEditing ? (
                        <div className="flex items-center gap-2 mb-4">
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xl font-bold text-white text-center w-40"
                                autoFocus
                            />
                            <button onClick={handleEditSave} className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg">
                                <Check size={20} />
                            </button>
                            <button onClick={handleEditCancel} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 mb-4">
                            <h2 className="text-3xl font-bold text-white">{activeProfile?.username || 'Player'}</h2>
                            <button onClick={handleEditStart} className="p-2 text-white/30 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                                <Pencil size={16} />
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-full border border-green-500/20">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs font-mono text-green-400 uppercase">System Online</span>
                    </div>

                    {/* Profile Switcher Button */}
                    <button
                        onClick={() => setShowProfiles(!showProfiles)}
                        className="mt-6 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/70 text-sm font-mono uppercase transition-all flex items-center gap-2"
                    >
                        <LogOut size={14} />
                        Switch Profile
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="col-span-1 lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatCard
                        icon={<Gamepad2 className="text-purple-400" />}
                        label="Games Played"
                        value={stats?.total_games_played ?? 0}
                    />
                    <StatCard
                        icon={<Clock className="text-blue-400" />}
                        label="Play Time"
                        value={stats ? formatPlaytime(stats.total_playtime_seconds) : '0m'}
                    />
                    <StatCard
                        icon={<Activity className="text-green-400" />}
                        label="Sessions"
                        value={stats?.total_sessions ?? 0}
                    />
                    <StatCard
                        icon={<Trophy className="text-yellow-400" />}
                        label="High Scores Set"
                        value={stats?.games.filter(g => g.high_score > 0).length ?? 0}
                    />
                </div>
            </div>

            {/* Profile Switcher Panel */}
            {showProfiles && (
                <div className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <User size={20} className="text-white/50" />
                        All Profiles
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {profiles.map((profile) => (
                            <button
                                key={profile.id}
                                onClick={() => handleSwitchProfile(profile.id)}
                                className={`p-4 rounded-xl text-center transition-all ${profile.is_default
                                    ? 'bg-cyan-500/20 border-2 border-cyan-500'
                                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                    }`}
                            >
                                <div className="text-3xl mb-2">{profile.avatar || '👤'}</div>
                                <div className="text-white font-medium">{profile.username}</div>
                                {profile.is_default && (
                                    <div className="text-cyan-400 text-xs font-mono mt-1">ACTIVE</div>
                                )}
                            </button>
                        ))}

                        {/* Add New Profile */}
                        <button
                            onClick={() => setShowNewProfile(true)}
                            className="p-4 rounded-xl bg-white/5 border border-dashed border-white/20 hover:bg-white/10 transition-all flex flex-col items-center justify-center text-white/50 hover:text-white"
                        >
                            <Plus size={32} />
                            <span className="text-sm mt-2">Add Profile</span>
                        </button>
                    </div>

                    {/* New Profile Form */}
                    {showNewProfile && (
                        <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                            <input
                                type="text"
                                value={newProfileName}
                                onChange={(e) => setNewProfileName(e.target.value)}
                                placeholder="Profile name..."
                                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/30 mb-3"
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCreateProfile}
                                    className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-lg transition-all"
                                >
                                    Create
                                </button>
                                <button
                                    onClick={() => { setShowNewProfile(false); setNewProfileName(''); }}
                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Game Stats */}
            {stats && stats.games.length > 0 && (
                <div className="mt-12">
                    <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
                        <Activity size={20} className="text-white/50" />
                        Game Statistics
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {stats.games.map((game) => (
                            <div key={game.game_slug} className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <h4 className="font-bold text-white mb-2">{game.game_title}</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-white/50">High Score</div>
                                    <div className="text-white font-mono">{game.high_score}</div>
                                    <div className="text-white/50">Play Time</div>
                                    <div className="text-white font-mono">{formatPlaytime(game.total_playtime_seconds)}</div>
                                    <div className="text-white/50">Sessions</div>
                                    <div className="text-white font-mono">{game.sessions_count}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) {
    return (
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all group">
            <div className="flex items-center gap-3 mb-4 opacity-70 group-hover:opacity-100 transition-opacity">
                {icon}
                <div className="text-xs font-mono uppercase tracking-wider text-white/50">{label}</div>
            </div>
            <div className="text-4xl font-bold text-white group-hover:scale-105 transition-transform origin-left">
                {value}
            </div>
        </div>
    );
}
