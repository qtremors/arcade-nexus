/**
 * Settings Page
 */
import { Settings as SettingsIcon, Server, Monitor, Volume2, Shield } from 'lucide-react';

export function Settings() {
    return (
        <div className="h-full w-full overflow-y-auto p-12 pt-24 pb-32 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center gap-4 mb-2">
                <SettingsIcon className="text-cyan-400" size={48} />
                <h1 className="text-6xl font-black uppercase tracking-tighter text-white">Settings</h1>
            </div>
            <p className="text-white/50 font-mono uppercase tracking-widest text-sm mb-12">
                System Configuration
            </p>

            <div className="max-w-2xl space-y-6">
                <Section icon={<Monitor />} title="Graphics" description="Display and rendering preferences">
                    <div className="bg-black/30 p-4 rounded-lg border border-white/5 text-white/50 text-sm">
                        Graphics settings are automatically optimized for your hardware.
                    </div>
                </Section>

                <Section icon={<Volume2 />} title="Audio" description="Sound effects and music volume">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-white">Master Volume</span>
                            <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div className="w-3/4 h-full bg-cyan-500" />
                            </div>
                        </div>
                    </div>
                </Section>

                <Section icon={<Shield />} title="Account" description="Privacy and security settings">
                    <button className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors">
                        Clear Local Data
                    </button>
                </Section>

                <Section icon={<Server />} title="Backend" description="Connection settings">
                    <div className="flex items-center gap-2 text-green-400 text-sm">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        Connected to localhost:8000
                    </div>
                </Section>
            </div>
        </div>
    );
}

function Section({ icon, title, description, children }: { icon: React.ReactNode, title: string, description: string, children: React.ReactNode }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-white/5 rounded-lg text-cyan-400">
                    {icon}
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <p className="text-white/50 text-sm">{description}</p>
                </div>
            </div>
            <div className="pl-16">
                {children}
            </div>
        </div>
    );
}
