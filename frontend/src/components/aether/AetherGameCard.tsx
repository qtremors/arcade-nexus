import { Play, Download } from 'lucide-react';
import type { Game } from '../../api/client';

interface AetherGameCardProps {
    game: Game;
    onClick: () => void;
    actionLabel?: string;
    variant?: 'store' | 'library';
}

export function AetherGameCard({ game, onClick, actionLabel = "Play", variant = 'store' }: AetherGameCardProps) {
    return (
        <div
            onClick={onClick}
            // Optimize: Removed hover:scale, reduced transition duration, removed shadow-glow
            className="group relative h-[400px] w-full cursor-pointer overflow-hidden rounded-2xl bg-[#0a0a0a] border border-white/5 hover:border-cyan-500/50 transition-colors duration-200"
        >
            {/* Background Image - Optimize: No scale on hover to save repaint */}
            <div
                className="absolute inset-0 bg-cover bg-center opacity-60 transition-opacity duration-300 group-hover:opacity-80"
                style={{ backgroundImage: `url(${game.thumbnail})` }}
            />

            {/* Gradient Overlay - Static */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

            {/* Content Content */}
            <div className="absolute inset-0 flex flex-col justify-end p-6">

                {/* Accent Line - Optimize: Use ScaleX (Composite) instead of Width (Layout) */}
                <div className="mb-4 h-1 w-full bg-cyan-500 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100" />

                <div className="transform transition-transform duration-200 translate-y-2 group-hover:translate-y-0">
                    <div className="mb-2 flex items-center justify-between">
                        {/* Optimize: Removed backdrop-blur */}
                        <span className="rounded bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white border border-white/10">
                            {game.category}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400">v{game.id}.0</span>
                    </div>

                    <h3 className="mb-1 text-2xl font-black uppercase leading-none text-white tracking-tighter">
                        {game.title}
                    </h3>

                    <p className="mb-6 line-clamp-2 text-xs font-medium leading-relaxed text-gray-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        {game.description}
                    </p>

                    <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-3 text-sm font-bold uppercase tracking-wider text-white border border-white/10 transition-colors hover:bg-cyan-600 hover:text-white hover:border-cyan-500">
                        {variant === 'library' ? <Play size={16} fill="currentColor" /> : <Download size={16} />}
                        {actionLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
