/**
 * GamePlayer Page - Play a game using the Game SDK
 * Fullscreen game experience - NO UI elements during gameplay
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { gamesApi } from "../api/client";
import type { Game } from "../api/client";
import { GameCanvas } from "../components/GameCanvas";
import { ErrorBoundary } from "../components/ErrorBoundary";

export function GamePlayer() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [resource, setResource] = useState<{
    slug: string | undefined;
    game: Game | null;
    error: string | null;
  } | null>(null);
  const game = resource && resource.slug === slug ? resource.game : null;
  const error = resource && resource.slug === slug ? resource.error : null;
  const isLoading = resource?.slug !== slug;

  useEffect(() => {
    let active = true;
    const loadGame = async () => {
      if (!slug) {
        setResource({ slug, game: null, error: "Game not found" });
        return;
      }
      try {
        const gameData = await gamesApi.get(slug);
        if (active) setResource({ slug, game: gameData, error: null });
      } catch (err) {
        if (active)
          setResource({ slug, game: null, error: (err as Error).message });
      }
    };
    void loadGame();
    return () => {
      active = false;
    };
  }, [slug]);

  // Fullscreen container - NO top bar, NO borders
  const containerStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "#0a0a0f",
    overflow: "hidden",
  };

  const centerStyle: React.CSSProperties = {
    ...containerStyle,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontFamily: "Inter, system-ui, sans-serif",
  };

  if (isLoading) {
    return (
      <div style={centerStyle}>
        <div style={{ fontSize: "1.5rem", opacity: 0.5 }}>Loading...</div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div style={centerStyle}>
        <h2 style={{ color: "#ff4466", marginBottom: "1rem" }}>
          Failed to load game
        </h2>
        <p style={{ opacity: 0.6, marginBottom: "2rem" }}>
          {error || "Game not found"}
        </p>
        <button
          onClick={() => navigate("/home")}
          style={{
            padding: "0.75rem 2rem",
            background: "#222",
            border: "1px solid #444",
            color: "#fff",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          ← Back to Console
        </button>
      </div>
    );
  }

  // Clean fullscreen - GameCanvas handles ALL overlays
  return (
    <div style={containerStyle}>
      <ErrorBoundary
        fallback={
          <div style={centerStyle}>
            <h2 style={{ color: "#ff4466", marginBottom: "1rem" }}>
              Game crashed
            </h2>
            <button
              onClick={() => navigate("/home")}
              style={{
                padding: "0.75rem 2rem",
                background: "#222",
                border: "1px solid #444",
                color: "#fff",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              ← Back to Console
            </button>
          </div>
        }
      >
        <GameCanvas
          key={game.slug}
          slug={game.slug}
          title={game.title}
          config={game.config}
        />
      </ErrorBoundary>
    </div>
  );
}
