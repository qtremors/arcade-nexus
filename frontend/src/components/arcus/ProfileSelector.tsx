import { useProfileStore } from '../../stores/profileStore';
import { User, Plus } from 'lucide-react';

interface ProfileSelectorProps {
    onSelect: () => void;
    onCreateNew: () => void;
}

export function ProfileSelector({ onSelect, onCreateNew }: ProfileSelectorProps) {
    const { profiles, switchProfile, isLoading } = useProfileStore();

    const handleSelectProfile = async (id: number) => {
        await switchProfile(id);
        onSelect();
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#020205] flex items-center justify-center overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,243,255,0.05)_0%,transparent_70%)]" />

            {/* Content */}
            <div className="relative z-10 w-full max-w-5xl px-12 flex flex-col items-center">

                {/* Branding Segment */}
                <div className="flex flex-col items-center gap-4 mb-20 animate-float">
                    <div className="text-[10px] font-pixel text-white/30 tracking-[0.3em] uppercase italic">System Initialized</div>
                    <h1 className="text-6xl font-bold tracking-[0.3em] neon-text-cyan">ARCADE NEXUS</h1>
                </div>

                <div className="flex flex-col items-center gap-2 mb-12">
                    <h2 className="text-2xl font-light tracking-[0.2em] text-white/70">WHO IS LOGGING IN?</h2>
                    <div className="w-12 h-1 bg-cyan-400 rounded-full shadow-[0_0_10px_#00f3ff]" />
                </div>

                {/* Profiles Row */}
                <div className="flex justify-center gap-12 flex-wrap mb-16">
                    {profiles.map((profile) => (
                        <button
                            key={profile.id}
                            onClick={() => handleSelectProfile(profile.id)}
                            disabled={isLoading}
                            className="group flex flex-col items-center gap-6 p-4 transition-all disabled:opacity-50"
                        >
                            <div className="relative">
                                <div className="absolute -inset-4 bg-cyan-400/20 rounded-[32px] blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 scale-75 group-hover:scale-100" />
                                <div className="w-32 h-32 rounded-[32px] glass-panel border-white/10 group-hover:border-cyan-400/50 
                                    flex items-center justify-center text-5xl transition-all duration-500 relative z-10
                                    group-hover:scale-110 group-hover:shadow-[0_0_40px_rgba(0,243,255,0.2)]">
                                    {profile.avatar || <User className="text-white/20" size={48} />}
                                </div>
                            </div>
                            <div className="text-white/40 font-bold tracking-[0.2em] text-sm group-hover:text-white group-hover:neon-text-cyan transition-all uppercase">
                                {profile.username}
                            </div>
                        </button>
                    ))}

                    {/* Premium Add Profile Tile */}
                    <button
                        onClick={onCreateNew}
                        disabled={isLoading}
                        className="group flex flex-col items-center gap-6 p-4 transition-all disabled:opacity-50"
                    >
                        <div className="w-32 h-32 rounded-[32px] glass-panel border-dashed border-white/10 group-hover:border-white/30 
                            flex items-center justify-center transition-all duration-500 group-hover:scale-110">
                            <Plus className="text-white/20 group-hover:text-white/60 transition-colors" size={40} />
                        </div>
                        <div className="text-white/20 font-bold tracking-[0.2em] text-sm group-hover:text-white/50 transition-all uppercase">
                            New Core
                        </div>
                    </button>
                </div>

                {/* System Footer Link */}
                <button className="text-[10px] font-pixel text-white/10 hover:text-cyan-400/30 transition-all tracking-tighter mt-4">
                    [ MANAGE_TERMINAL_PROFILES ]
                </button>
            </div>
        </div>
    );
}
