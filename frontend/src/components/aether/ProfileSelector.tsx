/**
 * ProfileSelector - Netflix-style profile selection screen
 */
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
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]" />

            {/* Content */}
            <div className="relative z-10 w-full max-w-4xl px-8 text-center">
                {/* Header */}
                <h1 className="text-4xl font-bold text-white mb-4">Who's Playing?</h1>
                <p className="text-white/50 font-mono text-sm uppercase tracking-wider mb-12">
                    Select your profile
                </p>

                {/* Profiles Grid */}
                <div className="flex justify-center gap-8 flex-wrap mb-12">
                    {profiles.map((profile) => (
                        <button
                            key={profile.id}
                            onClick={() => handleSelectProfile(profile.id)}
                            disabled={isLoading}
                            className="group flex flex-col items-center gap-4 p-6 rounded-2xl
                                hover:bg-white/5 transition-all disabled:opacity-50"
                        >
                            <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 
                                border-2 border-white/10 group-hover:border-cyan-500 group-hover:scale-105
                                flex items-center justify-center text-5xl transition-all
                                shadow-lg group-hover:shadow-cyan-500/20">
                                {profile.avatar || <User className="text-white/50" size={48} />}
                            </div>
                            <div className="text-white font-medium text-lg group-hover:text-cyan-400 transition-colors">
                                {profile.username}
                            </div>
                        </button>
                    ))}

                    {/* Add Profile Button */}
                    <button
                        onClick={onCreateNew}
                        disabled={isLoading}
                        className="group flex flex-col items-center gap-4 p-6 rounded-2xl
                            hover:bg-white/5 transition-all disabled:opacity-50"
                    >
                        <div className="w-28 h-28 rounded-2xl bg-white/5 
                            border-2 border-dashed border-white/20 group-hover:border-white/40
                            flex items-center justify-center transition-all">
                            <Plus className="text-white/30 group-hover:text-white/60" size={40} />
                        </div>
                        <div className="text-white/50 font-medium text-lg group-hover:text-white/70 transition-colors">
                            Add Profile
                        </div>
                    </button>
                </div>

                {/* Manage Profiles Link */}
                <button className="text-white/30 text-sm font-mono uppercase tracking-wider hover:text-white/60 transition-colors">
                    Manage Profiles
                </button>
            </div>
        </div>
    );
}
