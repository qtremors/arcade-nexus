/**
 * Profile Page - User stats and profile management
 */
import { useEffect, useState } from 'react';
import { User, Trophy, Clock, Gamepad2, Activity, Pencil, Check, X, Plus, LogOut, ChevronDown } from 'lucide-react';
import { useProfileStore } from '../stores/profileStore';
import { formatPlaytime } from '../utils/formatting';
import { SessionHistoryModal } from '../components/SessionHistoryModal';
import { statsApi } from '../api/client';
import type { GameSession, Profile as ProfileInterface } from '../api/client';

export function Profile() {
    const {
        activeProfile,
        profiles,
        updateProfile,
        switchProfile,
        createProfile,
        fetchProfiles,
        overallStats,
        fetchOverallStats
    } = useProfileStore();

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [showProfiles, setShowProfiles] = useState(false);
    const [showNewProfile, setShowNewProfile] = useState(false);
    const [newProfileName, setNewProfileName] = useState('');
    const [userProfiles, setUserProfiles] = useState<ProfileInterface[]>([]); // Added for the new switcher logic

    // Modal State
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historySessions, setHistorySessions] = useState<GameSession[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Fetch stats on mount if needed
    useEffect(() => {
        if (activeProfile) {
            fetchOverallStats();
        }
    }, [activeProfile?.id, fetchOverallStats]);

    // Refresh profiles on mount
    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    // Update userProfiles when profiles from store change
    useEffect(() => {
        setUserProfiles(profiles);
    }, [profiles]);

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

    const [historyModalTitle, setHistoryModalTitle] = useState('Session History');
    const [historyInitialSort, setHistoryInitialSort] = useState<'date' | 'score' | 'duration'>('date');

    const handleOpenHistory = async (title: string = "Session History", sortMode: 'date' | 'score' | 'duration' = 'date') => {
        setHistoryModalTitle(title);
        setHistoryInitialSort(sortMode);
        setHistoryModalOpen(true);
        setHistoryLoading(true);
        try {
            const sessions = await statsApi.getHistory();
            setHistorySessions(sessions);
        } catch (err) {
            console.error('Failed to load history:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Function to handle adding a new profile from the switcher modal
    const handleAddProfile = () => {
        setShowProfiles(false); // Close the switcher modal
        setShowNewProfile(true); // Open the new profile form (if it's still in the main view)
        // Or, if the new profile form is part of the modal, you'd manage that state here.
        // For now, assuming the existing new profile form is used.
    };


    return (
        <div className="h-full w-full overflow-y-auto p-12 pt-24 pb-32 animate-in fade-in zoom-in-95 duration-500">
            {/* Header */}
            <div className="mb-12">
                <div className="flex items-center gap-4 mb-2">
                    <User className="text-cyan-400" size={48} />
                    <h1 className="text-6xl font-black uppercase tracking-tighter text-white">Profile</h1>
                </div>
                <p className="text-white/50 font-mono uppercase tracking-widest text-sm">
                    Neural Identity Configuration
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
                        value={overallStats?.total_games_played ?? 0}
                    />
                    <StatCard
                        icon={<Clock className="text-blue-400" />}
                        label="Play Time"
                        value={overallStats?.total_playtime_seconds ? formatPlaytime(overallStats.total_playtime_seconds) : '0m'}
                        expandable={!!(overallStats?.total_playtime_seconds && overallStats.total_playtime_seconds > 0)}
                        onClick={() => handleOpenHistory('Play Time History', 'duration')}
                        overrideExpand={true}
                    />
                    <StatCard
                        icon={<Activity className="text-green-400" />}
                        label="Sessions"
                        value={overallStats?.total_sessions ?? 0}
                        expandable={!!(overallStats?.total_sessions && overallStats.total_sessions > 0)}
                        onClick={() => handleOpenHistory('Session History', 'date')}
                        overrideExpand={true}
                    />
                    <StatCard
                        icon={<Trophy className="text-yellow-400" />}
                        label="High Scores"
                        value={overallStats?.games.filter(g => g.high_score > 0).length ?? 0}
                        expandable={!!(overallStats?.games.some(g => g.high_score > 0))}
                        onClick={() => handleOpenHistory('High Score History', 'score')}
                        overrideExpand={true}
                    />
                </div>
            </div>

            {/* Profile Switcher Panel */}
            {showProfiles && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#1a1b26] border border-white/10 rounded-2xl p-8 max-w-2xl w-full shadow-2xl relative">
                        <button
                            onClick={() => setShowProfiles(false)}
                            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                            <User size={24} className="text-cyan-400" />
                            Select Profile
                        </h2>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {userProfiles.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handleSwitchProfile(p.id)}
                                    className={`
                                        p-4 rounded-xl border text-left transition-all group relative overflow-hidden
                                        ${p.id === activeProfile?.id // Changed from `profile?.id` to `activeProfile?.id`
                                            ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/50'
                                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30'}
                                    `}
                                >
                                    <div className="text-2xl mb-2 group-hover:scale-110 transition-transform origin-left">
                                        {p.avatar || '👤'}
                                    </div>
                                    <div className="font-bold text-white truncate">{p.username}</div>
                                    {p.id === activeProfile?.id && ( // Changed from `profile?.id` to `activeProfile?.id`
                                        <div className="absolute top-2 right-2 text-cyan-400">
                                            <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                                        </div>
                                    )}
                                </button>
                            ))}

                            <button
                                onClick={handleAddProfile}
                                className="p-4 rounded-xl border border-dashed border-white/20 hover:border-white/40 hover:bg-white/5 transition-all flex flex-col items-center justify-center gap-2 text-white/50 hover:text-white"
                            >
                                <Plus size={24} />
                                <span className="text-sm font-medium">New Profile</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Profile Form (kept for existing functionality, could be integrated into modal) */}
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

            {/* Game Stats */}
            {overallStats && overallStats.games.length > 0 && (
                <div className="mt-12">
                    <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
                        <Activity size={20} className="text-white/50" />
                        Game Statistics
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {overallStats.games.map((game) => (
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

            <SessionHistoryModal
                isOpen={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                title={historyModalTitle}
                initialSort={historyInitialSort}
                sessions={historySessions}
                loading={historyLoading}
            />
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    expandable = false,
    overrideExpand = false, // Triggers onClick but doesn't show inline expand arrow
    onClick,
    children
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    expandable?: boolean;
    overrideExpand?: boolean;
    onClick?: () => void;
    children?: React.ReactNode;
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    const handleClick = () => {
        if (onClick) {
            onClick();
        } else if (expandable) {
            setIsExpanded(!isExpanded);
        }
    };

    return (
        <div
            className={`bg-white/5 border border-white/10 p-6 rounded-2xl transition-all group ${expandable || onClick ? 'cursor-pointer hover:bg-white/10 hover:border-white/20' : ''}`}
            onClick={handleClick}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 opacity-70 group-hover:opacity-100 transition-opacity">
                    {icon}
                    <div className="text-xs font-mono uppercase tracking-wider text-white/50">{label}</div>
                </div>
                {expandable && !overrideExpand && (
                    <ChevronDown
                        size={16}
                        className={`text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                )}
                {/* External Link Indicator for modal triggers */}
                {overrideExpand && (
                    <div className="text-white/30 group-hover:text-cyan-400 transition-colors">
                        <Activity size={16} />
                    </div>
                )}
            </div>
            <div className="text-4xl font-bold text-white group-hover:scale-105 transition-transform origin-left">
                {value}
            </div>

            {/* Expandable Content (only if not overridden) */}
            {expandable && isExpanded && !overrideExpand && children && (
                <div className="mt-4 pt-4 border-t border-white/10 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
}
