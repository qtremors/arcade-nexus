/**
 * Toast Notification Component
 * Simple toast system for user feedback
 */
import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    let nextId = 0;

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = nextId++;
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger enter animation
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    const icons = {
        success: <CheckCircle className="text-green-400" size={20} />,
        error: <XCircle className="text-red-400" size={20} />,
        info: <Info className="text-cyan-400" size={20} />,
    };

    const borderColors = {
        success: 'border-green-500/30',
        error: 'border-red-500/30',
        info: 'border-cyan-500/30',
    };

    return (
        <div
            className={`
                flex items-center gap-3 px-4 py-3 rounded-lg
                bg-black/80 backdrop-blur-sm border ${borderColors[toast.type]}
                shadow-lg min-w-[280px] max-w-[400px]
                transition-all duration-300 ease-out
                ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
            `}
        >
            {icons[toast.type]}
            <span className="text-white text-sm flex-1">{toast.message}</span>
            <button
                onClick={onClose}
                className="text-white/50 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
            >
                <X size={16} />
            </button>
        </div>
    );
}
