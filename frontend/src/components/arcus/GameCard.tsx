import { Play, Download } from 'lucide-react';
import type { Game } from '../../api/client';
import { AudioManager } from '../../sdk/AudioManager';

interface GameCardProps {
    game: Game;
    onClick: () => void;
    actionLabel?: string;
    variant?: 'store' | 'library';
    icon?: React.ReactNode;
}

export function GameCard({ game, onClick, actionLabel = "PLAY", variant = 'store', icon }: GameCardProps) {
    return (
        <div
            onClick={() => {
                AudioManager.getInstance().playSelect();
                onClick();
            }}
            onMouseEnter={() => AudioManager.getInstance().playHover()}
            className="group relative h-[450px] w-full cursor-pointer overflow-hidden rounded-[32px] glass-panel border-white/5 hover:border-cyan-400/30 transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(0,243,255,0.1)]"
        >
            {/* Background Image with Parallax-like effect on hover */}
            <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-700 group-hover:scale-105 opacity-60 group-hover:opacity-80"
                style={{ backgroundImage: `url(${game.thumbnail || 'https://images.unsplash.com/photo-1542751371-adc38448a05e'})` }}
            />

            {/* Cinematic Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#020205] via-transparent to-transparent" />

            {/* Content Segment */}
            <div className="absolute inset-0 flex flex-col justify-end p-8 z-10">


                <div className="transform transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-cyan-400 font-mono text-[10px] uppercase tracking-widest">
                            {game.category}
                        </span>
                    </div>

                    <h3 className="text-3xl font-bold text-white tracking-tight leading-none mb-3">
                        {game.title}
                    </h3>

                    <p className="text-white/60 text-[11px] font-mono line-clamp-2 mb-8 leading-relaxed tracking-tight group-hover:text-white transition-colors">
                        {game.description}
                    </p>

                    <button className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/10 py-4 text-[10px] font-bold uppercase tracking-widest text-white transition-all transform translate-y-0 opacity-100 shadow-lg">
                        {icon ? icon : (variant === 'library' ? <Play size={14} className="fill-current" /> : <Download size={14} />)}
                        {actionLabel}
                    </button>
                </div>
            </div>

        </div>
    );
}
