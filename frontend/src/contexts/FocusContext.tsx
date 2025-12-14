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
        // Get all items in the same group?
        // Or finding nearest neighbor.
        // For the "Ribbon" MVP, Left/Right moves in group, Up/Down changes group.

        const allItems = Array.from(items.values());

        // Filter by group for horizontal nav
        if (dir === 'left' || dir === 'right') {
            // Sort by ID or DOM position? ID might be random.
            // Let's rely on registration order or assume the ID contains index like 'game-0', 'game-1'
            // Better: Let's assume the consumer handles "next/prev" logic? 
            // No, centralized is better.
            // Let's try to find DOM nodes to determine order.

            // Fallback: If IDs are strictly numeric-suffixed 'item-0', 'item-1'
            const currentIndex = parseInt(current.id.split('-').pop() || '0');
            const nextIndex = dir === 'right' ? currentIndex + 1 : currentIndex - 1;

            const targetId = `${current.id.split('-').slice(0, -1).join('-')}-${nextIndex}`;
            if (items.has(targetId)) {
                setFocusedId(targetId);
            }
        }

        // Up/Down changes groups (e.g., Nav -> Ribbon -> Details)
        // This requires knowing group adjacency. Hardcoded for MVP "Nexus OS" layout:
        // Nav (top) <-> Ribbon (middle)
        if (dir === 'up' && current.group === 'ribbon') {
            // Find any item in 'nav'
            const navItem = allItems.find(i => i.group === 'nav');
            if (navItem) setFocusedId(navItem.id);
        }
        else if (dir === 'down' && current.group === 'nav') {
            // Find active or first item in 'ribbon'
            // We could remember last focused item in group. For now, first ribbon item.
            // Or try to find 'game-0'
            const ribbonItem = allItems.find(i => i.group === 'ribbon'); // Just pick one
            // Better: pick the middle text one.
            if (ribbonItem) {
                // Try to recover the ribbon item with index 0
                const firstParams = ribbonItem.id.split('-');
                firstParams[firstParams.length - 1] = '0';
                const firstId = firstParams.join('-');
                setFocusedId(items.has(firstId) ? firstId : ribbonItem.id);
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
