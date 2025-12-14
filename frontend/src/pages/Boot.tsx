/**
 * Boot Screen - Console startup animation
 */
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface BootProps {
    onComplete: () => void;
}

export function Boot({ onComplete }: BootProps) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setTimeout(onComplete, 300);
                    return 100;
                }
                return prev + 2;
            });
        }, 30);

        return () => clearInterval(interval);
    }, [onComplete]);

    return (
        <motion.div
            className="boot-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div
                className="boot-logo"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
            >
                ARCADE NEXUS
            </motion.div>

            <div className="boot-progress">
                <motion.div
                    className="boot-progress-bar"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <motion.p
                style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
            >
                {progress < 30 && 'Initializing console...'}
                {progress >= 30 && progress < 60 && 'Loading games...'}
                {progress >= 60 && progress < 90 && 'Preparing experience...'}
                {progress >= 90 && 'Ready!'}
            </motion.p>
        </motion.div>
    );
}
