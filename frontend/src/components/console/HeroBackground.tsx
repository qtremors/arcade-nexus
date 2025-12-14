import { useEffect, useState } from 'react';
import type { Game } from '../../api/client';

export function HeroBackground({ game }: { game: Game | null }) {
    const [activeImage, setActiveImage] = useState<string>('');
    const [prevImage, setPrevImage] = useState<string>('');
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        if (!game) return;
        const newImage = game.thumbnail || '';

        if (newImage !== activeImage) {
            setPrevImage(activeImage);
            setActiveImage(newImage);
            setIsTransitioning(true);

            const timer = setTimeout(() => setIsTransitioning(false), 600);
            return () => clearTimeout(timer);
        }
    }, [game]);

    // Gradient Overlay Styles
    const overlayStyle: React.CSSProperties = {
        position: 'absolute',
        inset: 0,
        background: `
            radial-gradient(circle at 70% 30%, transparent 0%, var(--bg-primary) 80%),
            linear-gradient(to right, var(--bg-primary) 0%, rgba(5,5,5,0.8) 30%, transparent 60%, var(--bg-primary) 100%),
            linear-gradient(to top, var(--bg-primary) 0%, transparent 50%)
        `,
        zIndex: 2
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: -1,
            overflow: 'hidden',
            background: 'var(--bg-primary)'
        }}>
            {/* Base Layer (Color) */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(circle at 50% 50%, #1a1a2e 0%, #000 100%)',
                zIndex: 0
            }} />

            {/* Previous Image (Fading Out) */}
            {prevImage && (
                <div
                    key={prevImage}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url(${prevImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        opacity: isTransitioning ? 0 : 0, // Starts visible, fades out. Wait, CSS trans logic needs active/exit classes.
                        // Simplified: Just use active image on top with fade in.
                        // Let's rely on the Active Image failing in.
                        transition: 'opacity 0.6s ease-out'
                    }}
                />
            )}

            {/* Active Image (Fading In) */}
            <div
                key={activeImage}
                className="bg-layer-active"
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: activeImage ? `url(${activeImage})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: isTransitioning ? 0 : 0.4, // Targeted opacity
                    transform: isTransitioning ? 'scale(1.1)' : 'scale(1)',
                    transition: 'opacity 0.6s ease-out, transform 6s linear',
                    zIndex: 1
                }}
            />

            {/* Cinematic Gradient Overlays */}
            <div style={overlayStyle} />

            {/* Grid Overlay */}
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `
                    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
                `,
                backgroundSize: '100px 100px',
                zIndex: 3,
                pointerEvents: 'none',
                opacity: 0.5
            }} />

        </div>
    );
}
