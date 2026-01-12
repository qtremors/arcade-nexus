import { useState } from 'react';
import { User, Sparkles, ArrowRight } from 'lucide-react';
import { useProfileStore } from '../../stores/profileStore';

interface ProfileSetupProps {
    onComplete: () => void;
}

const AVATARS = ['🎮', '👾', '🚀', '⚡', '🎯', '🔥', '💎', '🌟'];

export function ProfileSetup({ onComplete }: ProfileSetupProps) {
    const [username, setUsername] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState('🎮');
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createProfile = useProfileStore(state => state.createProfile);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) {
            setError('Designation required');
            return;
        }
        setIsCreating(true);
        setError(null);
        try {
            await createProfile(username.trim(), selectedAvatar);
            onComplete();
        } catch (err) {
            setError((err as Error).message || 'Core creation failed');
            setIsCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#020205] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,243,255,0.05)_0%,transparent_70%)]" />

            <div className="relative z-10 w-full max-w-xl">
                <div className="glass-panel rounded-[40px] p-12 border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden relative">
                    {/* Decorative Element */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/10 blur-[60px] rounded-full translate-x-1/2 -translate-y-1/2" />

                    {/* Header */}
                    <div className="text-center mb-12">
                        <div className="w-24 h-24 mx-auto mb-8 relative">
                            <div className="absolute inset-0 bg-cyan-400/20 rounded-full blur-xl animate-pulse" />
                            <div className="w-full h-full glass-panel rounded-full flex items-center justify-center relative z-10 border-white/20">
                                <Sparkles className="w-10 h-10 text-cyan-400" />
                            </div>
                        </div>
                        <h1 className="text-4xl font-bold text-white tracking-[0.1em] mb-3">INITIALIZING_CORE</h1>
                        <p className="text-white/30 font-pixel text-[8px] uppercase tracking-[0.2em]">Designate your prime identity</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-10">
                        {/* Avatar Grid */}
                        <div className="flex flex-col items-center gap-4">
                            <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.3em]">SELECT AVATAR_UNIT</span>
                            <div className="flex justify-center gap-4 flex-wrap">
                                {AVATARS.map((avatar) => (
                                    <button
                                        key={avatar}
                                        type="button"
                                        onClick={() => setSelectedAvatar(avatar)}
                                        className={`w-14 h-14 text-2xl rounded-2xl transition-all duration-500
                                            ${selectedAvatar === avatar
                                                ? 'glass-panel border-cyan-400/50 scale-110 shadow-[0_0_20px_rgba(0,243,255,0.2)]'
                                                : 'glass-panel border-transparent opacity-40 hover:opacity-100'
                                            }`}
                                    >
                                        {avatar}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Input Field */}
                        <div className="flex flex-col gap-4">
                            <label className="text-[10px] font-mono text-white/30 uppercase tracking-[0.3em] ml-2">CORE_DESIGNATION</label>
                            <div className="relative group">
                                <User className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-cyan-400 transition-colors" size={20} />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter identifier..."
                                    maxLength={20}
                                    autoFocus
                                    className="w-full pl-16 pr-8 py-5 glass-panel rounded-2xl text-white placeholder-white/20 font-sans text-xl tracking-wide focus:outline-none focus:neon-border-cyan transition-all"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="text-red-400 text-[10px] font-mono text-center py-3 px-6 glass-panel border-red-500/20 rounded-xl animate-shake">
                                ERROR: {error.toUpperCase()}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isCreating || !username.trim()}
                            className="w-full relative group disabled:opacity-50 overflow-hidden rounded-2xl"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 transition-transform duration-500 group-hover:scale-105" />
                            <div className="relative py-5 flex items-center justify-center gap-3 text-white font-bold tracking-[0.3em] text-xs uppercase z-10 font-sans">
                                {isCreating ? 'PROCESS_INITIATING...' : (
                                    <>
                                        START SESSION <ArrowRight size={16} />
                                    </>
                                )}
                            </div>
                        </button>
                    </form>

                    <footer className="mt-12 pt-8 border-t border-white/5 text-center">
                        <p className="text-[9px] font-mono text-white/10 tracking-widest uppercase italic">
                            Secure encryption enabled // Arcus protocol v12.1
                        </p>
                    </footer>
                </div>
            </div>
        </div>
    );
}
