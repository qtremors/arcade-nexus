/**
 * ProfileSetup - First-run profile creation screen
 */
import { useState } from 'react';
import { User, Sparkles } from 'lucide-react';
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
            setError('Please enter a name');
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            await createProfile(username.trim(), selectedAvatar);
            onComplete();
        } catch (err) {
            setError((err as Error).message || 'Failed to create profile');
            setIsCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]" />

            {/* Content */}
            <div className="relative z-10 w-full max-w-md px-8">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 p-[2px]">
                        <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                            <Sparkles className="w-8 h-8 text-cyan-400" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Welcome to Arcade Nexus</h1>
                    <p className="text-white/50 font-mono text-sm uppercase tracking-wider">
                        Create your player profile
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Avatar Selection */}
                    <div>
                        <label className="block text-white/70 text-sm font-mono uppercase tracking-wider mb-4">
                            Choose Avatar
                        </label>
                        <div className="flex justify-center gap-3 flex-wrap">
                            {AVATARS.map((avatar) => (
                                <button
                                    key={avatar}
                                    type="button"
                                    onClick={() => setSelectedAvatar(avatar)}
                                    className={`w-14 h-14 text-2xl rounded-xl transition-all
                                        ${selectedAvatar === avatar
                                            ? 'bg-cyan-500/20 border-2 border-cyan-500 scale-110'
                                            : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                        }`}
                                >
                                    {avatar}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Username Input */}
                    <div>
                        <label className="block text-white/70 text-sm font-mono uppercase tracking-wider mb-3">
                            Player Name
                        </label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20} />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your name..."
                                maxLength={50}
                                autoFocus
                                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl
                                    text-white placeholder-white/30 font-mono text-lg
                                    focus:outline-none focus:border-cyan-500/50 focus:bg-white/10
                                    transition-all"
                            />
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="text-red-400 text-sm font-mono text-center py-2 px-4 bg-red-500/10 rounded-lg border border-red-500/20">
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isCreating || !username.trim()}
                        className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl
                            text-white font-bold text-lg uppercase tracking-wider
                            hover:from-cyan-400 hover:to-blue-500 transition-all
                            disabled:opacity-50 disabled:cursor-not-allowed
                            shadow-lg shadow-cyan-500/25"
                    >
                        {isCreating ? 'Creating...' : 'Start Playing'}
                    </button>
                </form>

                {/* Footer hint */}
                <p className="text-center text-white/30 text-xs font-mono mt-8 uppercase tracking-wider">
                    You can create more profiles later
                </p>
            </div>
        </div>
    );
}
