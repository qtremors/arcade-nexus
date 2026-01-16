/**
 * Loading Spinner Component
 * Shared loading indicator for consistent UX
 */
interface LoadingSpinnerProps {
    text?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ text = 'Loading...', size = 'md' }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'w-6 h-6 border-2',
        md: 'w-12 h-12 border-4',
        lg: 'w-16 h-16 border-4',
    };

    return (
        <div className="flex flex-col items-center justify-center gap-4">
            <div className={`${sizeClasses[size]} border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin`} />
            {text && (
                <div className="text-cyan-400 font-mono text-sm tracking-widest animate-pulse uppercase">
                    {text}
                </div>
            )}
        </div>
    );
}
