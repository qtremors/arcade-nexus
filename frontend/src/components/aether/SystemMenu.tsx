import { useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag, Library, User, Trophy, Home } from 'lucide-react';
import { useProfileStore } from '../../stores/profileStore';

interface SystemMenuProps {
    isOpen: boolean;
    activeColor: string;
    onClose: () => void;
}

export function SystemMenu({ isOpen, activeColor, onClose }: SystemMenuProps) {
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

    return (
        <div
            className={`fixed inset-y-0 left-0 w-80 bg-black/60 backdrop-blur-2xl border-r border-white/10 z-40 transform transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col p-8
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
            <div className="flex items-center gap-4 mb-12">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-gray-700 to-gray-900 border border-white/20 overflow-hidden flex items-center justify-center text-2xl">
                    {activeProfile?.avatar || <User className="text-white/50" />}
                </div>
                <div>
                    <h3 className="text-white font-bold tracking-widest text-sm">
                        {activeProfile?.username?.toUpperCase() || 'PLAYER'}
                    </h3>
                    <div className="text-emerald-400 text-xs font-mono flex items-center gap-1">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /> ONLINE
                    </div>
                </div>
            </div>

            <div className="space-y-6 flex-1">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <button
                            key={item.label}
                            onClick={() => handleNav(item.path)}
                            className="group flex items-center gap-4 w-full text-left p-3 rounded-lg hover:bg-white/5 transition-all"
                        >
                            <div
                                className={`w-1 h-1 rounded-full bg-white/20 group-hover:scale-150 transition-all`}
                                style={{ backgroundColor: isActive ? activeColor : undefined }}
                            />
                            <Icon size={18} className={isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'} />
                            <span className={`font-medium tracking-wide transition-colors ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="pt-8 border-t border-white/10 space-y-4">
                <div className="flex justify-between items-center text-gray-500 text-xs font-mono">
                    <span>GPU TEMP</span>
                    <span>--</span>
                </div>
                <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-white/30" />
                </div>
                <div className="flex justify-between items-center text-gray-500 text-xs font-mono">
                    <span>MEM LOAD</span>
                    <span>--</span>
                </div>
            </div>
        </div>
    );
}
