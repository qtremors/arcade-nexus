import { useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag, Library, User, Trophy, Home, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { useProfileStore } from '../../stores/profileStore';
import { AudioManager } from '../../sdk/AudioManager';
import { useGamepad } from '../../hooks/useGamepad';

interface SystemMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SystemMenu({ isOpen, onClose }: SystemMenuProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const activeProfile = useProfileStore(state => state.activeProfile);

    const menuItems = [
        { label: 'Home', path: '/home', icon: Home },
        { label: 'Store', path: '/store', icon: ShoppingBag },
        { label: 'Library', path: '/library', icon: Library },
        { label: 'Achievements', path: '/achievements', icon: Trophy },
        { label: 'Profile', path: '/profile', icon: User },
    ];

    const handleNav = (path: string) => {
        navigate(path);
        onClose();
    };

    useGamepad((button) => {
        if (!isOpen) return;
        if (button === 'B') onClose();
    }, [isOpen, onClose]);

    return (
        <div
            className={`fixed inset-0 z-50 flex justify-end transition-all duration-500 ${isOpen ? 'bg-black/80' : 'pointer-events-none'}`}
            onClick={onClose}
        >
            <div
                className={`w-96 bg-[#161618] h-full transform transition-transform duration-700 ease-[var(--ease-out-expo)] flex flex-col p-10 border-l border-zinc-800 shadow-2xl ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header: User Profile Segment */}
                <div className="flex flex-col items-center gap-6 mb-12 py-6 border-b border-zinc-800">
                    <div className="relative group">
                        <div className="absolute -inset-4 bg-cyan-900/40 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-24 h-24 rounded-full bg-zinc-800 border-2 border-zinc-700 overflow-hidden flex items-center justify-center text-5xl relative z-10 shadow-lg">
                            {activeProfile?.avatar || '👤'}
                        </div>
                    </div>

                    <div className="text-center">
                        <h3 className="text-2xl font-bold tracking-[0.2em] text-white">
                            {activeProfile?.username?.toUpperCase() || 'ANONYMOUS'}
                        </h3>
                        <div className="flex items-center justify-center gap-2 mt-2">
                            <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-sm shadow-cyan-500" />
                            <span className="text-[10px] text-cyan-500 uppercase">Active</span>
                        </div>
                    </div>
                </div>

                {/* Navigation Menu */}
                <div className="flex-1 flex flex-col gap-3">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                            <button
                                key={item.label}
                                onClick={() => {
                                    AudioManager.getInstance().playSelect();
                                    handleNav(item.path);
                                }}
                                onMouseEnter={() => AudioManager.getInstance().playHover()}
                                className={`group flex items-center gap-5 w-full p-4 rounded-xl transition-all border
                                    ${isActive
                                        ? 'bg-zinc-800 border-cyan-500/50 text-white shadow-lg shadow-cyan-900/20'
                                        : 'border-transparent text-zinc-500 hover:text-white hover:bg-zinc-800/50'
                                    }`}
                            >
                                <Icon size={20} className={`transition-colors ${isActive ? 'text-cyan-400' : 'group-hover:text-cyan-400'}`} />
                                <span className="font-bold tracking-[0.2em] text-xs flex-1">
                                    {item.label}
                                </span>
                                {isActive && (
                                    <div className="w-1 h-4 bg-cyan-400 rounded-full shadow-[0_0_10px_#00f3ff]" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Footer Actions */}
                <div className="pt-10 border-t border-zinc-800 flex flex-col gap-4">
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600 px-2">
                        <span>LATENCY</span>
                        <span className="text-emerald-500">12MS</span>
                    </div>

                    <button onClick={() => navigate('/settings')} className="flex items-center gap-3 text-zinc-500 hover:text-white transition-all px-2 group">
                        <SettingsIcon size={16} className="group-hover:rotate-90 transition-transform duration-500" />
                        <span className="text-[10px] font-bold tracking-widest uppercase">Settings</span>
                    </button>

                    <button className="flex items-center gap-3 text-red-400/50 hover:text-red-400 transition-all px-2 group mt-2">
                        <LogOut size={16} />
                        <span className="text-[10px] font-bold tracking-widest uppercase">Logout</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
