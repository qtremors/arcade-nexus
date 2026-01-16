import { useEffect, useState, useMemo } from 'react';
import {
    Trophy,
    Gamepad2,
    Cpu,
    Wifi,
    Clock,
    HardDrive,
    Users,
    Pencil,
    Check,
    X,
    Plus,
    Star,
    Shield,
    Swords,
    ChevronRight,
    Activity
} from 'lucide-react';
import { useProfileStore } from '../stores/profileStore';
import { useLibraryStore } from '../stores/libraryStore';
import { formatPlaytime } from '../utils/formatting';
import { SessionHistoryModal } from '../components/SessionHistoryModal';
import { statsApi } from '../api/client';
import type { GameSession } from '../api/client';

// --- Custom SVG Chart Components for Zero-Dependency Visuals ---

const RadarChart = ({ data, size = 200, color = "#22d3ee" }: { data: Record<string, number>; size?: number; color?: string }) => {
    const center = size / 2;
    const radius = (size / 2) - 30;
    const categories = Object.keys(data);
    const total = categories.length;
    const angleSlice = (Math.PI * 2) / total;

    const points = categories.map((key, i) => {
        const value = data[key]; // 0 to 100
        const angle = i * angleSlice - Math.PI / 2;
        const r = (value / 100) * radius;
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        return `${x},${y}`;
    }).join(' ');

    const gridLevels = [0.25, 0.5, 0.75, 1];

    return (
        <div className="relative flex items-center justify-center">
            <svg width={size} height={size} className="overflow-visible">
                {/* Background Grid */}
                {gridLevels.map((level, i) => (
                    <polygon
                        key={i}
                        points={categories.map((_, idx) => {
                            const angle = idx * angleSlice - Math.PI / 2;
                            const r = radius * level;
                            return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
                        }).join(' ')}
                        fill="none"
                        stroke="white"
                        strokeWidth="1"
                        className="opacity-5"
                    />
                ))}

                {/* Axis Lines */}
                {categories.map((_, i) => {
                    const angle = i * angleSlice - Math.PI / 2;
                    const x = center + radius * Math.cos(angle);
                    const y = center + radius * Math.sin(angle);
                    return (
                        <line
                            key={i}
                            x1={center}
                            y1={center}
                            x2={x}
                            y2={y}
                            stroke="white"
                            strokeWidth="1"
                            className="opacity-5"
                        />
                    );
                })}

                {/* Data Shape */}
                <polygon
                    points={points}
                    fill={color}
                    fillOpacity="0.1"
                    stroke={color}
                    strokeWidth="2"
                    className="drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                />

                {/* Labels */}
                {categories.map((key, i) => {
                    const angle = i * angleSlice - Math.PI / 2;
                    const x = center + (radius + 20) * Math.cos(angle);
                    const y = center + (radius + 20) * Math.sin(angle);
                    return (
                        <text
                            key={i}
                            x={x}
                            y={y}
                            fill="rgba(255,255,255,0.3)"
                            fontSize="9"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="uppercase tracking-[0.2em] font-mono italic"
                        >
                            {key}
                        </text>
                    );
                })}
            </svg>
        </div>
    );
};

const TinyLineChart = ({ data, color = "#22d3ee", height = 40 }: { data: number[]; color?: string; height?: number }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const width = 100;

    const points = data.map((val: number, i: number) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <path d={`M0,${height} L${points} L${width},${height} Z`} fill={color} fillOpacity="0.05" />
        </svg>
    );
};

// --- Sub Components ---

const Badge = ({ icon: Icon, text, color }: { icon: any; text: string; color: string }) => (
    <span className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold border glass-panel transition-all hover:scale-105 ${color}`}>
        <Icon size={12} />
        {text}
    </span>
);

const StatCompact = ({ label, value }: { label: string; value: string | number }) => (
    <div>
        <div className="text-[9px] uppercase text-white/20 font-mono tracking-[0.2em] mb-1">{label}</div>
        <div className="text-xl font-bold text-white tracking-tight">{value}</div>
    </div>
);

const SystemBar = ({ label, value, max = 100, color, suffix }: { label: string; value: number; max?: number; color: string; suffix: string }) => (
    <div>
        <div className="flex justify-between items-end mb-1">
            <span className="text-[10px] uppercase font-mono tracking-widest text-white/30">{label}</span>
            <span className="text-[10px] font-mono text-cyan-400">{value.toFixed(0)}{suffix}</span>
        </div>
        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div
                className={`h-full ${color} transition-all duration-1000 ease-out shadow-[0_0_8px_currentColor]`}
                style={{ width: `${(value / max) * 100}%` }}
            />
        </div>
    </div>
);

// --- Main Page Component ---

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

    const { entries: library, fetchLibrary } = useLibraryStore();

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [showProfiles, setShowProfiles] = useState(false);
    const [showNewProfile, setShowNewProfile] = useState(false);
    const [newProfileName, setNewProfileName] = useState('');

    const [recentSessions, setRecentSessions] = useState<GameSession[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [systemLoad, setSystemLoad] = useState({ cpu: 45, gpu: 60, temp: 55 });

    // Stats simulation
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        const statTicker = setInterval(() => {
            setSystemLoad(prev => ({
                cpu: Math.min(100, Math.max(10, prev.cpu + (Math.random() * 10 - 5))),
                gpu: Math.min(100, Math.max(10, prev.gpu + (Math.random() * 10 - 5))),
                temp: Math.min(85, Math.max(35, prev.temp + (Math.random() * 4 - 2)))
            }));
        }, 3000);
        return () => { clearInterval(timer); clearInterval(statTicker); };
    }, []);

    useEffect(() => {
        const loadRecentHistory = async () => {
            try {
                const history = await statsApi.getHistory();
                setRecentSessions(history.slice(0, 5));
            } catch (err) {
                console.error('Failed to load recent sessions:', err);
            }
        };

        if (activeProfile) {
            fetchOverallStats();
            fetchLibrary();
            loadRecentHistory();
        }
        fetchProfiles();
    }, [activeProfile, fetchOverallStats, fetchLibrary, fetchProfiles]);

    const skillMatrix = useMemo(() => {
        if (!overallStats) return { AIM: 50, STRAT: 50, TEAM: 50, AGIL: 50, LUCK: 50, INT: 50 };

        // Highly simplified derivation from backend data
        const totalGames = overallStats.total_games_played || 1;
        const totalSessions = overallStats.total_sessions || 1;
        const highScores = overallStats.games.reduce((acc, g) => acc + g.high_score, 0);

        return {
            AIM: Math.min(100, 30 + (highScores / 500)),
            STRAT: Math.min(100, 40 + (totalGames * 10)),
            TEAM: 75, // Placeholder for local console
            AGIL: Math.min(100, 20 + (totalSessions * 5)),
            LUCK: 40 + Math.floor(Math.random() * 20),
            INT: 85
        };
    }, [overallStats]);

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

    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historySessions, setHistorySessions] = useState<GameSession[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
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

    return (
        <div className="h-full w-full overflow-y-auto p-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* --- HERO SECTION --- */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Profile Card */}
                    <div className="lg:col-span-8 glass-panel border-white/5 rounded-3xl p-8 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

                        <div className="flex flex-col md:flex-row items-center md:items-start gap-10 z-10 relative">
                            <div className="relative group/avatar">
                                <div className="absolute -inset-4 bg-cyan-400/10 rounded-full blur-2xl group-hover/avatar:bg-cyan-400/20 transition-all duration-700" />
                                <div className="w-36 h-36 rounded-3xl glass-panel border-white/10 flex items-center justify-center relative z-10 overflow-hidden group-hover/avatar:scale-105 transition-transform duration-500">
                                    <span className="text-6xl group-hover/avatar:animate-float">{activeProfile?.avatar || '👤'}</span>
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-black/80 border border-white/10 px-3 py-1 rounded-full backdrop-blur-md flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f3ff] animate-pulse" />
                                    <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">Online</span>
                                </div>
                            </div>

                            <div className="flex-1 text-center md:text-left">
                                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                                    {isEditing ? (
                                        <div className="flex items-center gap-2 w-full md:w-auto">
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="bg-white/5 border border-cyan-400/30 rounded-xl px-4 py-2 text-2xl font-bold text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                                                autoFocus
                                            />
                                            <button onClick={handleEditSave} className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg"><Check size={20} /></button>
                                            <button onClick={() => setIsEditing(false)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"><X size={20} /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <h2 className="text-5xl font-bold text-white tracking-tight">{activeProfile?.username || 'GUEST'}</h2>
                                            <button onClick={handleEditStart} className="p-2 text-white/20 hover:text-white hover:bg-white/5 rounded-full transition-all">
                                                <Pencil size={18} />
                                            </button>
                                        </>
                                    )}
                                </div>

                                <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-8">
                                    <Badge icon={Shield} text="Member" color="border-cyan-500/20 text-cyan-400" />
                                    <Badge icon={Star} text="Paragon" color="border-amber-500/20 text-amber-400" />
                                    <Badge icon={Clock} text="Online Now" color="border-blue-500/20 text-blue-400" />
                                </div>

                                <div className="grid grid-cols-3 gap-8 pt-8 border-t border-white/5">
                                    <StatCompact label="Total Playtime" value={overallStats?.total_playtime_seconds ? formatPlaytime(overallStats.total_playtime_seconds) : '0M'} />
                                    <StatCompact label="Games" value={overallStats?.total_games_played ?? 0} />
                                    <StatCompact label="Achievements" value="124" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Profile Actions */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <div className="glass-panel border-white/5 rounded-3xl p-6 flex-1 flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-bold text-white/30 tracking-[0.2em] uppercase">Profiles</span>
                                <button onClick={() => setShowProfiles(true)} className="p-2 text-white/20 hover:text-cyan-400 transition-colors">
                                    <Users size={16} />
                                </button>
                            </div>
                            <div className="flex -space-x-3 overflow-hidden">
                                {profiles.slice(0, 4).map((p) => (
                                    <div key={p.id} className="w-10 h-10 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center text-sm shadow-xl">
                                        {p.avatar || '👤'}
                                    </div>
                                ))}
                                {profiles.length > 4 && (
                                    <div className="w-10 h-10 rounded-full border-2 border-slate-950 bg-slate-950 flex items-center justify-center text-[10px] font-bold text-white/40">
                                        +{profiles.length - 4}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setShowProfiles(true)}
                                className="mt-6 w-full py-3 glass-panel border-white/5 hover:border-cyan-400/30 text-[10px] font-bold tracking-[0.2em] text-white/40 hover:text-white uppercase transition-all"
                            >
                                Switch Experience
                            </button>
                        </div>

                        <div className="glass-panel border-white/5 rounded-3xl p-6 flex flex-col justify-center gap-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-white/30 tracking-[0.2em] uppercase">System Clock</span>
                                <span className="text-xl font-mono text-white">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="h-[1px] w-full bg-white/5" />
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-white/10 tracking-[0.2em] uppercase">Firmware v1.3.1</span>
                                <div className="flex items-center gap-2">
                                    <Wifi size={12} className="text-green-500" />
                                    <span className="text-[9px] font-mono text-green-500">LOCAL_NEXUS</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- STATS GRID --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

                    {/* Radar Chart */}
                    <div className="glass-panel border-white/5 rounded-3xl p-8 flex flex-col items-center relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
                        <div className="w-full flex items-center gap-3 mb-8">
                            <Swords size={16} className="text-white/20" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 italic">Nexus Skill Matrix</span>
                        </div>
                        <RadarChart data={skillMatrix} size={220} />
                        <div className="w-full grid grid-cols-2 gap-4 mt-8">
                            <div className="p-3 glass-panel border-white/5 bg-white/[0.02] rounded-2xl">
                                <div className="text-[8px] text-white/20 uppercase tracking-widest font-mono">Dominant Traits</div>
                                <div className="text-[10px] font-bold text-cyan-400 mt-1 uppercase">Strategy / Agility</div>
                            </div>
                            <div className="p-3 glass-panel border-white/5 bg-white/[0.02] rounded-2xl">
                                <div className="text-[8px] text-white/20 uppercase tracking-widest font-mono">Current Tier</div>
                                <div className="text-[10px] font-bold text-amber-400 mt-1 uppercase">Veteran</div>
                            </div>
                        </div>
                    </div>

                    {/* Hardware Telemetry */}
                    <div className="glass-panel border-white/5 rounded-3xl p-8 space-y-8 relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
                        <div className="w-full flex items-center gap-3 mb-4">
                            <Cpu size={16} className="text-white/20" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 italic">System Telemetry</span>
                        </div>

                        <SystemBar label="GPU Compute" value={systemLoad.gpu} color="bg-cyan-400" suffix="%" />
                        <SystemBar label="CPU Engine" value={systemLoad.cpu} color="bg-blue-400" suffix="%" />
                        <SystemBar label="Thermal Core" value={systemLoad.temp} color={systemLoad.temp > 70 ? "bg-red-500" : "bg-cyan-400"} suffix="°C" />

                        <div className="pt-8 border-t border-white/5 grid grid-cols-2 gap-6">
                            <div>
                                <div className="text-[9px] text-white/10 uppercase tracking-widest mb-1">Fan Curve</div>
                                <TinyLineChart data={[40, 42, 45, 43, 48, 55, 60, 58, 52, 50]} color="#22d3ee" height={24} />
                            </div>
                            <div className="flex flex-col justify-center">
                                <div className="text-[9px] text-white/10 uppercase tracking-widest mb-1">Status</div>
                                <div className="text-xs font-bold text-green-500 uppercase tracking-tighter">OPTIMIZED</div>
                            </div>
                        </div>
                    </div>

                    {/* Storage & Net */}
                    <div className="glass-panel border-white/5 rounded-3xl p-8 relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
                        <div className="w-full flex items-center gap-3 mb-8">
                            <HardDrive size={16} className="text-white/20" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 italic">Cloud Sync / Storage</span>
                        </div>

                        <div className="flex items-center justify-center mb-10">
                            <div className="w-28 h-28 rounded-full border-[6px] border-white/5 relative flex items-center justify-center">
                                <svg className="absolute inset-0 w-full h-full -rotate-90">
                                    <circle cx="56" cy="56" r="50" fill="none" stroke="rgba(34, 211, 238, 0.4)" strokeWidth="6" strokeDasharray="314" strokeDashoffset={314 * (1 - 0.72)} className="transition-all duration-1000" />
                                </svg>
                                <div className="text-center">
                                    <div className="text-xl font-bold text-white">72%</div>
                                    <div className="text-[8px] text-white/20 uppercase tracking-widest">Full</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-white/30 flex items-center gap-2"><div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" /> Game Local</span>
                                <span className="font-mono text-white/60">4.2 GB</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-white/30 flex items-center gap-2"><div className="w-1.5 h-1.5 bg-white/20 rounded-full" /> OS Reserves</span>
                                <span className="font-mono text-white/60">1.8 GB</span>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] font-bold text-white/10 uppercase tracking-widest">Net Latency</span>
                                <span className="text-[10px] font-mono text-green-400">12ms</span>
                            </div>
                            <TinyLineChart data={[12, 14, 11, 15, 12, 13, 22, 12, 11, 12]} color="#10b981" />
                        </div>
                    </div>
                </div>

                {/* --- RECENT MISSIONS --- */}
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <Activity size={20} className="text-white/20" />
                        <h3 className="text-[11px] text-white/30 tracking-[0.3em] uppercase italic">Recent Missions</h3>
                        <div className="h-[1px] flex-1 bg-white/5" />
                        <button
                            onClick={() => handleOpenHistory('Global Log', 'date')}
                            className="text-[9px] font-bold text-cyan-400/50 hover:text-cyan-400 uppercase tracking-widest transition-colors"
                        >
                            Log Database
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                        {recentSessions.length > 0 ? (
                            recentSessions.map((session) => (
                                <div
                                    key={session.id}
                                    className="glass-panel border-white/5 bg-white/[0.01] rounded-2xl p-4 flex items-center justify-between hover:border-cyan-400/20 transition-all group"
                                >
                                    <div className="flex items-center gap-6">
                                        <div className="w-10 h-10 rounded-xl bg-cyan-400/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                                            <Gamepad2 size={16} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors uppercase tracking-tight">{session.game_title}</div>
                                            <div className="text-[9px] text-white/20 font-mono uppercase tracking-widest">
                                                {new Date(session.start_time).toLocaleDateString()} // {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-12 mr-4">
                                        <div className="text-right">
                                            <div className="text-[8px] text-white/20 uppercase tracking-[0.2em] mb-1 font-mono">Score</div>
                                            <div className="text-base font-bold text-white tracking-tighter">{session.score}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[8px] text-white/20 uppercase tracking-[0.2em] mb-1 font-mono">Duration</div>
                                            <div className="text-base font-bold text-white/40 tracking-tighter">{Math.floor((session.duration_seconds || 0) / 60)}M</div>
                                        </div>
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white/10 group-hover:text-cyan-400 group-hover:bg-cyan-400/10 transition-all cursor-pointer">
                                            <ChevronRight size={16} />
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-12 text-center glass-panel border-dashed border-white/10 rounded-3xl">
                                <span className="text-[10px] text-white/20 uppercase tracking-[0.3em] italic">No active mission data found in local storage</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- PERFORMANCE MATRIX (Full Collection Breakdown) --- */}
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <Trophy size={20} className="text-white/20" />
                        <h3 className="text-[11px] text-white/30 tracking-[0.3em] uppercase italic">Performance Matrix</h3>
                        <div className="h-[1px] flex-1 bg-white/5" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {overallStats?.games.map((game) => (
                            <div
                                key={game.game_slug}
                                onClick={() => handleOpenHistory(`${game.game_title} Data`, 'score')}
                                className="glass-panel p-8 border-white/5 bg-white/[0.01] hover:border-white/20 transition-all group rounded-[32px] cursor-pointer"
                            >
                                <div className="flex items-center justify-between mb-8">
                                    <h4 className="font-bold text-white text-lg tracking-tight uppercase group-hover:text-cyan-400 transition-all">{game.game_title}</h4>
                                    <div className="w-8 h-8 rounded-lg glass-panel flex items-center justify-center text-white/20 group-hover:text-cyan-400 transition-colors">
                                        <Gamepad2 size={16} />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-end border-b border-white/5 pb-2">
                                        <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">High Score</span>
                                        <span className="text-white font-mono text-xl font-bold group-hover:text-amber-400 transition-colors">{game.high_score}</span>
                                    </div>
                                    <div className="flex justify-between items-end border-b border-white/5 pb-2">
                                        <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">Total Playtime</span>
                                        <span className="text-white/60 font-mono text-sm">{formatPlaytime(game.total_playtime_seconds)}</span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">Combat Sessions</span>
                                        <span className="text-white/60 font-mono text-sm">{game.sessions_count}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- LIBRARY MINI GRID --- */}
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <Gamepad2 size={20} className="text-white/20" />
                        <h3 className="text-[11px] text-white/30 tracking-[0.3em] uppercase italic">My Collection</h3>
                        <div className="h-[1px] flex-1 bg-white/5" />
                        <button
                            onClick={() => handleOpenHistory('My Collection', 'date')}
                            className="text-[9px] font-bold text-cyan-400/50 hover:text-cyan-400 uppercase tracking-widest transition-colors"
                        >
                            View All
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {library.slice(0, 4).map((entry) => (
                            <div key={entry.id} className="glass-panel border-white/5 rounded-2xl p-4 hover:border-cyan-400/30 transition-all cursor-pointer group">
                                <div className="h-28 bg-white/5 rounded-xl mb-4 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-cyan-400/5 group-hover:bg-cyan-400/10 transition-all" />
                                    <div className="absolute bottom-3 left-3 font-bold text-white/20 text-xs italic tracking-tighter uppercase group-hover:text-cyan-400/50 group-hover:scale-105 transition-all">{entry.game.title.split(' ')[0]}</div>
                                </div>
                                <h4 className="font-bold text-white text-sm truncate uppercase tracking-tight group-hover:text-cyan-400 transition-colors">{entry.game.title}</h4>
                                <div className="flex justify-between items-center mt-3 text-[10px] text-white/20 font-mono">
                                    <span className="flex items-center gap-1.5"><Clock size={10} className="text-cyan-400/50" /> {formatPlaytime(overallStats?.games.find(g => g.game_slug === entry.game.slug)?.total_playtime_seconds || 0)}</span>
                                    <span className="flex items-center gap-1.5 group-hover:text-amber-400 transition-colors"><Trophy size={10} className="text-amber-400/50" /> {overallStats?.games.find(g => g.game_slug === entry.game.slug)?.high_score || 0}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Switcher Modal */}
            {showProfiles && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
                    <div className="glass-panel w-full max-w-2xl rounded-[48px] p-12 border-white/10 relative shadow-[0_0_100px_rgba(0,243,255,0.1)]">
                        <button onClick={() => setShowProfiles(false)} className="absolute top-10 right-10 p-3 glass-panel border-white/5 hover:border-cyan-400/30 text-white/20 hover:text-white rounded-full transition-all">
                            <X size={20} />
                        </button>

                        <div className="text-center mb-12">
                            <h2 className="text-4xl font-bold text-white tracking-[0.2em] uppercase mb-2">Switch Profile</h2>
                            <p className="text-cyan-400/40 font-mono text-[9px] uppercase tracking-[0.3em] italic">Select identity core for current session</p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                            {profiles.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handleSwitchProfile(p.id)}
                                    className={`
                                        p-8 rounded-[40px] glass-panel border transition-all duration-500 group relative
                                        ${p.id === activeProfile?.id
                                            ? 'border-cyan-400/50 bg-cyan-400/[0.05] shadow-[0_0_40px_rgba(0,243,255,0.1)]'
                                            : 'border-white/5 hover:border-white/30 hover:bg-white/[0.05]'}
                                    `}
                                >
                                    <div className="text-5xl mb-6 group-hover:scale-110 group-hover:animate-float transition-all origin-center">
                                        {p.avatar || '👤'}
                                    </div>
                                    <div className="font-bold text-white uppercase tracking-widest text-xs group-hover:text-cyan-400 transition-colors">{p.username}</div>
                                    {p.id === activeProfile?.id && (
                                        <div className="absolute top-6 right-6">
                                            <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#00f3ff] animate-pulse" />
                                        </div>
                                    )}
                                </button>
                            ))}

                            <button
                                onClick={() => { setShowProfiles(false); setShowNewProfile(true); }}
                                className="p-8 rounded-[40px] glass-panel border border-dashed border-white/10 hover:border-cyan-400/30 hover:bg-cyan-400/[0.03] transition-all flex flex-col items-center justify-center gap-4 text-white/10 hover:text-cyan-400"
                            >
                                <Plus size={32} />
                                <span className="text-[10px] font-bold tracking-widest uppercase">Add Core</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Profile Form Modal Wrapper */}
            {showNewProfile && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
                    <div className="glass-panel w-full max-w-lg rounded-[48px] p-12 border-white/10">
                        <h2 className="text-3xl font-bold text-white tracking-[0.2em] uppercase mb-10 text-center">Register New Core</h2>
                        <input
                            type="text"
                            value={newProfileName}
                            onChange={(e) => setNewProfileName(e.target.value)}
                            placeholder="CORE_ID_NAME..."
                            className="w-full bg-white/5 border border-white/5 focus:border-cyan-400/50 rounded-2xl px-8 py-5 text-white placeholder-white/10 mb-10 focus:outline-none transition-all uppercase font-mono tracking-widest"
                            autoFocus
                        />
                        <div className="flex gap-4">
                            <button
                                onClick={handleCreateProfile}
                                className="flex-1 h-16 bg-cyan-500 hover:bg-cyan-400 rounded-2xl text-black font-black tracking-[0.3em] uppercase transition-all shadow-[0_0_30px_rgba(34,211,238,0.2)]"
                            >
                                Initialize
                            </button>
                            <button
                                onClick={() => { setShowNewProfile(false); setNewProfileName(''); }}
                                className="px-8 h-16 glass-panel border-white/5 hover:border-white/20 text-white/30 hover:text-white rounded-2xl transition-all"
                            >
                                Abort
                            </button>
                        </div>
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
