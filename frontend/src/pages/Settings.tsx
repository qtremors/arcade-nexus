import { Settings as SettingsIcon, Server, Monitor, Volume2, Shield, ChevronRight } from 'lucide-react';

export function Settings() {
    return (
        <div className="h-full w-full overflow-y-auto px-12 pt-32 pb-40 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Header: System Config Style */}
            <div className="relative mb-20 flex flex-col md:flex-row md:items-end justify-between gap-12">
                <div className="flex items-center gap-8">
                    <div className="w-24 h-24 glass-panel border-cyan-400/30 flex items-center justify-center relative group">
                        <div className="absolute inset-0 bg-cyan-400/10 blur-xl group-hover:bg-cyan-400/20 transition-all" />
                        <SettingsIcon className="text-cyan-400 relative z-10" size={40} />
                    </div>
                    <div>
                        <h1 className="text-5xl font-bold text-white tracking-tight leading-none">Settings</h1>
                        <p className="text-white/40 font-mono text-xs mt-3 tracking-wide">
                            System Preferences // Device Configuration
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl grid grid-cols-1 gap-8">
                <Section icon={<Monitor size={20} />} title="Graphics" description="Display and visual quality">
                    <div className="glass-panel p-6 border-white/5 bg-white/[0.02] rounded-2xl">
                        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest leading-relaxed">
                            Visuals are automatically optimized based on your system hardware.
                            <span className="text-cyan-400 mx-2">// Active</span>
                        </p>
                    </div>
                </Section>

                <Section icon={<Volume2 size={20} />} title="Audio" description="Sound effects and music volume">
                    <div className="space-y-8 glass-panel p-8 border-white/5 bg-white/[0.01] rounded-3xl">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-2">
                                <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Master Volume</span>
                                <span className="text-[10px] font-mono text-cyan-400">75%</span>
                            </div>
                            <div className="relative h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                <div className="absolute top-0 left-0 h-full w-3/4 bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_15px_#00f3ff]" />
                            </div>
                        </div>
                    </div>
                </Section>

                <Section icon={<Shield size={20} />} title="Privacy" description="Account and data management">
                    <div className="flex items-center gap-6">
                        <button className="h-14 px-8 glass-panel border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all group flex items-center gap-4 rounded-2xl">
                            <span className="text-[10px] font-bold tracking-widest uppercase">Clear Local Data</span>
                            <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                        <p className="text-[9px] font-mono text-white/10 uppercase italic">Warning: Irreversible operation</p>
                    </div>
                </Section>

                <Section icon={<Server size={20} />} title="Connection" description="Network and server status">
                    <div className="glass-panel p-6 border-green-500/10 bg-green-500/[0.01] rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e] animate-pulse" />
                            <span className="text-[10px] font-mono text-green-400 uppercase tracking-widest">Connected</span>
                        </div>
                        <span className="text-[10px] font-mono text-white/20">Latency: 12ms</span>
                    </div>
                </Section>
            </div>
        </div>
    );
}

function Section({ icon, title, description, children }: { icon: React.ReactNode, title: string, description: string, children: React.ReactNode }) {
    return (
        <div className="group animate-in fade-in slide-in-from-left-8 duration-700">
            <div className="flex items-start gap-8 mb-4">
                <div className="w-14 h-14 glass-panel border-white/5 bg-white/[0.02] flex items-center justify-center text-white/20 group-hover:text-cyan-400 group-hover:border-cyan-400/30 transition-all rounded-2xl">
                    {icon}
                </div>
                <div className="pt-2">
                    <h3 className="text-xl font-bold text-white tracking-tight uppercase mb-1">{title}</h3>
                    <p className="text-[10px] text-white/30 uppercase tracking-tight">{description}</p>
                </div>
            </div>
            <div className="pl-[88px]">
                {children}
            </div>
        </div>
    );
}
