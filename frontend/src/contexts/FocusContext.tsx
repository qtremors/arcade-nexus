import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right';

interface FocusContextType {
    focusedId: string | null;
    setFocus: (id: string) => void;
    register: (id: string, group: string, onEnter?: () => void) => void;
    unregister: (id: string) => void;
}

const FocusContext = createContext<FocusContextType | null>(null);

interface FocusableItem {
    id: string;
    group: string;
    onEnter?: () => void;
    element?: HTMLElement;
}

export function FocusProvider({ children }: { children: ReactNode }) {
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const [items, setItems] = useState<Map<string, FocusableItem>>(new Map());

    // Register a focusable item
    const register = useCallback((id: string, group: string, onEnter?: () => void) => {
        setItems(prev => {
            const newMap = new Map(prev);
            newMap.set(id, { id, group, onEnter });
            return newMap;
        });

        // Auto-focus first item if none focused
        setFocusedId(curr => curr === null ? id : curr);
    }, []);

    const unregister = useCallback((id: string) => {
        setItems(prev => {
            const newMap = new Map(prev);
            newMap.delete(id);
            return newMap;
        });
    }, []);

    const setFocus = useCallback((id: string) => {
        setFocusedId(id);
    }, []);

    // Handle Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!focusedId) return;

            const current = items.get(focusedId);
            if (!current) return;

            // Handle Enter
            if (e.key === 'Enter' || e.key === ' ') {
                if (current.onEnter) {
                    e.preventDefault();
                    current.onEnter();
                }
                return;
            }

            // Simple "Visual" Navigation Logic
            // In a real grid, we'd calculate geometry. For this MVP console,
            // we'll assume a specific group structure or just scan DOM order.
            // Let's implement a simple DOM-order traversal for same-group items first.

            const direction = e.key.replace('Arrow', '').toLowerCase() as Direction;
            if (!['up', 'down', 'left', 'right'].includes(direction)) return;

            e.preventDefault();
            navigate(direction, current);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [focusedId, items]);

    const navigate = (dir: Direction, current: FocusableItem) => {
        const allItems = Array.from(items.values());
        const groupItems = allItems.filter(i => i.group === current.group);

        // Find index in current group
        const currentIndex = groupItems.findIndex(i => i.id === current.id);

        if (dir === 'left' || dir === 'right') {
            let nextIndex = dir === 'right' ? currentIndex + 1 : currentIndex - 1;

            // Wrapping
            if (nextIndex >= groupItems.length) nextIndex = 0;
            if (nextIndex < 0) nextIndex = groupItems.length - 1;

            const nextItem = groupItems[nextIndex];
            if (nextItem) setFocusedId(nextItem.id);
        }

        // Up/Down changes groups
        if (dir === 'up') {
            if (current.group === 'ribbon') {
                const navItem = allItems.find(i => i.group === 'nav');
                if (navItem) setFocusedId(navItem.id);
            }
        } else if (dir === 'down') {
            if (current.group === 'nav') {
                const ribbonItem = allItems.find(i => i.group === 'ribbon');
                if (ribbonItem) setFocusedId(ribbonItem.id);
            }
        }
    };

    return (
        <FocusContext.Provider value={{ focusedId, setFocus, register, unregister }}>
            {children}
        </FocusContext.Provider>
    );
}

export function useFocus() {
    return useContext(FocusContext);
}

// Hook for individual components
export function useFocusable(id: string, group: string, onEnter?: () => void) {
    const context = useContext(FocusContext);

    useEffect(() => {
        context?.register(id, group, onEnter);
        return () => context?.unregister(id);
    }, [id, group, onEnter]); // Removed context dependency loop risk

    return {
        focused: context?.focusedId === id,
        focus: () => context?.setFocus(id)
    };
}
