import { useState, useEffect } from 'react';
import { Cpu } from 'lucide-react';

interface BootSequenceProps {
    onComplete: () => void;
}

export function BootSequence({ onComplete }: BootSequenceProps) {
    const [stage, setStage] = useState(0);

    useEffect(() => {
        // Timeline of the boot animation
        // Adjusted timing for a snappy feel
        const t1 = setTimeout(() => setStage(1), 500); // Line expand
        const t2 = setTimeout(() => setStage(2), 1500); // Vertical burst
        const t3 = setTimeout(() => setStage(3), 2200); // Logo reveal
        const t4 = setTimeout(() => setStage(4), 3500); // Fade out
        const t5 = setTimeout(onComplete, 4000); // Complete

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(t4);
            clearTimeout(t5);
        };
    }, [onComplete]);

    return (
        <div className={`fixed inset-0 z-[100] bg-black flex items-center justify-center transition-opacity duration-1000 ${stage === 4 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            {/* The Horizontal Line */}
            <div
                className={`h-0.5 bg-white shadow-[0_0_50px_white] transition-all duration-1000 ease-out
        ${stage === 0 ? 'w-0' : 'w-full'} 
        ${stage >= 2 ? 'opacity-0' : 'opacity-100'}`}
            />

            {/* The Vertical Burst (The "Eye") */}
            <div className={`absolute w-1 bg-white transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]
        ${stage < 1 ? 'h-0' : stage === 1 ? 'h-0' : 'h-screen opacity-0'}
      `} />

            {/* The Logo / Biometric Scan - Removed animate-ping for performance */}
            <div className={`absolute flex flex-col items-center justify-center transition-all duration-1000 transform
        ${stage < 2 ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}
      `}>
                <div className="relative">
                    <div className="w-24 h-24 border-4 border-white rounded-full absolute opacity-20"></div>
                    <div className="w-24 h-24 border-2 border-white rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.5)] bg-black">
                        <Cpu className="w-10 h-10 text-white" />
                    </div>
                </div>
                <h1 className="text-white font-mono mt-8 tracking-[1em] text-sm uppercase">ARCADE NEXUS</h1>
                <p className="text-gray-500 font-mono text-xs mt-2">SYSTEM INITIALIZED</p>
            </div>
        </div>
    );
}
