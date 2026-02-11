/**
 * Error Boundary Component - Catches React errors gracefully
 */
import { Component, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error for debugging (in production, send to error tracking service)
        if (import.meta.env.DEV) {
            console.error('[ErrorBoundary] Caught error:', error, errorInfo);
        }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl z-[100] p-8 text-center animate-in fade-in duration-700">
                    <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center mb-8 border-2 border-red-500/30 animate-pulse">
                        <div className="text-red-500 font-bold text-4xl">!</div>
                    </div>

                    <h2 className="text-4xl font-black mb-2 text-white tracking-widest uppercase italic">
                        System Panic
                    </h2>
                    <p className="text-gray-500 mb-10 max-w-md font-mono text-sm leading-relaxed">
                        A critical kernel error occurred in the game engine.
                        State dump has been recorded for calibration.
                    </p>

                    <div className="bg-red-950/20 border border-red-500/20 rounded-lg p-6 mb-10 w-full max-w-xl overflow-hidden shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                        <div className="text-red-500/50 text-[10px] font-mono mb-2 text-left uppercase tracking-tighter">Stack Trace / Exception</div>
                        <p className="text-red-400 font-mono text-xs text-left whitespace-pre-wrap break-all leading-tight">
                            {import.meta.env.DEV
                                ? (this.state.error?.message || 'NULL_POINTER_RESET')
                                : 'SYSTEM_PANIC — Error details hidden in production mode.'}
                        </p>
                    </div>

                    <div className="flex gap-6">
                        <button
                            onClick={this.handleReset}
                            className="px-10 py-4 bg-white text-black font-black uppercase tracking-widest hover:bg-gray-200 transition-all rounded-sm shadow-[4px_4px_0_rgba(255,255,255,0.2)] active:translate-x-1 active:translate-y-1 active:shadow-none"
                        >
                            Cold Reboot
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
