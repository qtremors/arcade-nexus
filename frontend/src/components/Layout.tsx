import { useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLocation, Outlet, Link } from 'react-router-dom';
import { Home, ShoppingBag, Library as LibraryIcon, Trophy, LayoutGrid } from 'lucide-react';
import { SystemMenu } from './arcus/SystemMenu';
import { Background } from './Background';
import { useGamepad } from '../hooks/useGamepad';

interface LayoutProps {
    children?: ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const location = useLocation();

    // Live clock state
    const [time, setTime] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    // Check backend status
    useEffect(() => {
        const checkBackend = async () => {
            try {
                const res = await fetch('http://localhost:8000/health');
                if (res.ok) {
                    setBackendStatus('online');
                } else {
                    setBackendStatus('offline');
                }
            } catch {
                setBackendStatus('offline');
            }
        };

        checkBackend();
        const interval = setInterval(checkBackend, 30000);
        return () => clearInterval(interval);
    }, []);

    // Keyboard/Gamepad shortcuts
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') setMenuOpen(prev => !prev);
    }, []);

    useGamepad((button) => {
        if (button === 'Start' || button === 'Guide' || button === 'Back') {
            setMenuOpen(prev => !prev);
        }
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const isGaming = location.pathname.startsWith('/play') || location.pathname.startsWith('/game');

    return (
        <div className="relative w-full h-screen overflow-hidden bg-[#020205] font-sans select-none text-white">

            <Background />

            {/* Premium Header - Console Style */}
            {!isGaming && (
                <header className={`absolute top-0 left-0 right-0 h-24 px-12 flex justify-between items-center z-30 transition-all duration-500 ${menuOpen ? 'blur-sm opacity-50' : 'opacity-100'}`}>
                    {/* Left: System Status & Branding */}
                    <div className="flex items-center gap-8">
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold tracking-tight text-white">Arcade Nexus</span>
                            <span className="text-[10px] text-white/40 mt-1 uppercase tracking-widest">Online</span>
                        </div>

                        <nav className="flex gap-4 ml-12">
                            <Link to="/home" className={`p-2 rounded-xl transition-all ${location.pathname === '/home' ? 'bg-white/10 text-cyan-400' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                <Home size={20} />
                            </Link>
                            <Link to="/store" className={`p-2 rounded-xl transition-all ${location.pathname === '/store' ? 'bg-white/10 text-cyan-400' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                <ShoppingBag size={20} />
                            </Link>
                            <Link to="/library" className={`p-2 rounded-xl transition-all ${location.pathname === '/library' ? 'bg-white/10 text-cyan-400' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                <LibraryIcon size={20} />
                            </Link>
                            <Link to="/achievements" className={`p-2 rounded-xl transition-all ${location.pathname === '/achievements' ? 'bg-white/10 text-cyan-400' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                <Trophy size={20} />
                            </Link>
                        </nav>
                    </div>

                    {/* Right: Clock & User Info */}
                    <div className="flex items-center gap-8">
                        {/* Backend indicator */}
                        <div className={`flex items-center gap-2 font-mono text-[10px] ${backendStatus === 'online' ? 'text-green-500' : 'text-red-500'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 animate-pulse'}`} />
                            {backendStatus === 'online' ? 'SECURE' : 'OFFLINE'}
                        </div>

                        {/* Beautiful Clock */}
                        <div className="flex flex-col items-end">
                            <span className="text-3xl font-light tracking-widest leading-none">
                                {time.getHours().toString().padStart(2, '0')}:{time.getMinutes().toString().padStart(2, '0')}
                            </span>
                            <span className="text-[10px] text-white/30 uppercase tracking-tighter mt-1">Clock</span>
                        </div>

                        {/* System Button */}
                        <button
                            onClick={() => setMenuOpen(!menuOpen)}
                            className="w-12 h-12 glass-panel rounded-2xl flex items-center justify-center hover:neon-border-cyan transition-all"
                        >
                            <LayoutGrid size={20} className={menuOpen ? "animate-spin" : ""} />
                        </button>
                    </div>
                </header>
            )}

            {/* Main Interactive Stage */}
            <main
                className={`relative z-10 w-full h-full flex flex-col transition-all duration-700 ease-[var(--ease-out-expo)]
                ${menuOpen ? 'scale-90 opacity-20 blur-md pointer-events-none' : 'scale-100 opacity-100'}
                ${!isGaming ? 'pt-24 pb-8' : ''}`}
            >
                {children || <Outlet />}
            </main>

            {/* System Menu */}
            <SystemMenu
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
            />

            {/* Footer Context / Watermark */}
            {!isGaming && (
                <footer className="absolute bottom-8 left-12 right-12 flex justify-between items-end z-20 pointer-events-none opacity-10">
                    <div className="text-[10px] font-mono tracking-widest">
                        Arcade Nexus v1.2
                    </div>
                </footer>
            )}
        </div>
    );
}
