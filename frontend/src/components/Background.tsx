export function Background() {
    return (
        <div
            className="fixed inset-0 z-0 bg-[var(--bg-primary)] pointer-events-none"
            style={{
                background: 'radial-gradient(circle at center, var(--bg-secondary) 0%, var(--bg-primary) 100%)'
            }}
        />
    );
}
