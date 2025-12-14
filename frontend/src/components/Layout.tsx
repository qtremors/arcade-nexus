import { useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Settings, Server, CheckCircle, XCircle } from 'lucide-react';
import { SystemMenu } from './aether/SystemMenu';

interface LayoutProps {
    children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const location = useLocation();

    // Live clock state
    const [time, setTime] = useState(() => new Date());

    // Update clock every minute
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
        // Check every 30 seconds
        const interval = setInterval(checkBackend, 30000);
        return () => clearInterval(interval);
    }, []);

    const activeColor = "#00f3ff";

    // Close menu on route change
    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    // Keyboard shortcuts for menu
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setMenuOpen(prev => !prev);
        }
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
        <div className="relative w-full h-screen overflow-hidden bg-black font-sans select-none text-white">

            {/* Dynamic Background */}
            <div className="absolute inset-0 bg-black z-0">
                {location.pathname !== '/home' && !location.pathname.startsWith('/play') && (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] opacity-50" />
                )}
            </div>

            {/* Top Status Bar */}
            {!location.pathname.startsWith('/play') && !location.pathname.startsWith('/game') && (
                <div className={`absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-30 transition-all duration-500 ${menuOpen ? 'blur-sm opacity-50' : 'blur-0 opacity-100'}`}>
                    <div className="flex gap-6">
                        <div
                            className="flex items-center gap-2 text-white/70 hover:text-white cursor-pointer transition-colors"
                            onClick={() => setMenuOpen(!menuOpen)}
                        >
                            <Settings size={20} className={menuOpen ? "animate-spin" : ""} />
                            <span className="text-xs font-mono tracking-widest hidden sm:block">SYSTEM</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Backend Status */}
                        <div className={`flex items-center gap-2 ${backendStatus === 'online' ? 'text-green-400' :
                            backendStatus === 'offline' ? 'text-red-400' : 'text-white/50'
                            }`}>
                            {backendStatus === 'online' ? (
                                <CheckCircle size={14} />
                            ) : backendStatus === 'offline' ? (
                                <XCircle size={14} />
                            ) : (
                                <Server size={14} className="animate-pulse" />
                            )}
                            <span className="text-xs font-mono uppercase">
                                {backendStatus === 'checking' ? 'Checking...' : backendStatus}
                            </span>
                        </div>

                        {/* Clock */}
                        <div className="text-white font-mono text-xl tracking-widest">
                            {time.getHours()}:{time.getMinutes().toString().padStart(2, '0')}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Layer */}
            <div
                className={`relative z-10 w-full h-full flex flex-col transition-all duration-300 origin-left
                ${menuOpen ? 'translate-x-64 scale-95 opacity-50' : 'translate-x-0 scale-100'}
                ${!location.pathname.startsWith('/play') && !location.pathname.startsWith('/game') ? 'pt-20 px-6 pb-6' : ''}`}
            >
                {children}
            </div>

            {/* System Menu Overlay */}
            <SystemMenu
                isOpen={menuOpen}
                activeColor={activeColor}
                onClose={() => setMenuOpen(false)}
            />

            {/* Version Watermark */}
            {!location.pathname.startsWith('/play') && !location.pathname.startsWith('/game') && (
                <div className="absolute bottom-6 left-6 z-20 pointer-events-none">
                    <div className="flex flex-col gap-1">
                        <div className="w-1 h-20 bg-gradient-to-b from-white/0 via-white/20 to-white/0" />
                        <div className="text-[10px] text-white/20 font-mono rotate-180" style={{ writingMode: 'vertical-rl' }}>
                            ARCADE NEXUS // v1.2
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
