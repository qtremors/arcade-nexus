<p align="center">
  <img src="frontend/public/arcade-nexus.png" alt="Arcade Nexus Logo" width="120"/>
</p>

<h1 align="center">Arcade Nexus</h1>

<p align="center">
  A premium local & offline arcade gaming console built with React, FastAPI, and a custom Game SDK.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/FastAPI-0.104-009688?logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Three.js-0.181-000000?logo=threedotjs" alt="Three.js">
  <img src="https://img.shields.io/badge/License-TSL-red" alt="License">
</p>

> [!NOTE]
> **Personal Project** 🎯 I built this to explore game development with web technologies and create a console-like gaming experience in the browser.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎮 **Arcus Interface** | Console-style UI with glassmorphism and dynamic theming |
| 🕹️ **Custom Game SDK** | Build 2D (Canvas) and 3D (Three.js) games with unified API |
| 👤 **Local Profiles** | Netflix-style profile selection with avatars |
| 📊 **Statistics Tracking** | Playtime, high scores, sessions per game |
| 🎯 **Achievements** | Unlock achievements as you play |
| 💾 **Save States** | Multiple save slots per game |
| 🖥️ **Fullscreen Gaming** | Zero-distraction gameplay experience |
| 🚀 **Boot Sequence** | Immersive startup animation |

---

## 🎮 Games Included

| Game | Type | Description |
|------|------|-------------|
| 🐍 **Neon Snake** | 2D | Classic arcade snake with cyberpunk aesthetics and particle effects |
| 🦖 **Raptor Run** | 2D | Endless runner with obstacles and day/night cycle |
| ✈️ **Stellar Flight** | 3D | Flight simulator (Coming Soon) |

---

## 🚀 Quick Start

```bash
# Clone and navigate
git clone https://github.com/qtremors/arcade-nexus.git
cd arcade-nexus

# Backend
cd backend
uv sync
uv run uvicorn app.main:app --reload
# Runs at http://localhost:8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
# Runs at http://localhost:5173
```

Visit **http://localhost:5173** 🎉

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript, Vite 7, Tailwind CSS, Zustand, Framer Motion |
| **Backend** | FastAPI, SQLAlchemy 2, SQLite (async), Pydantic v2 |
| **3D Rendering** | Three.js with GLTF loader |
| **Testing** | pytest (backend), vitest (frontend) |

---

## 📁 Project Structure

```
arcade-nexus/
├── frontend/             # React + TypeScript + Vite
│   ├── src/
│   │   ├── sdk/          # Game SDK (2D/3D support)
│   │   ├── games/        # Game implementations
│   │   ├── components/   # UI components
│   │   └── pages/        # Route pages
│   └── public/           # Assets (logos, models)
├── backend/              # FastAPI + SQLAlchemy
│   └── app/
│       ├── models/       # Database models
│       ├── routers/      # API endpoints
│       └── schemas/      # Pydantic schemas
├── DEVELOPMENT.md        # Developer documentation
├── CHANGELOG.md          # Version history
├── LICENSE.md            # License terms
└── README.md
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [DEVELOPMENT.md](DEVELOPMENT.md) | Architecture, API reference, database schema |
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |
| [LICENSE.md](LICENSE.md) | License terms and attribution |
| [SDK README](frontend/src/sdk/README.md) | Game development guide |

---

## 🧪 Testing

```bash
# Backend tests
cd backend
uv run pytest

# Frontend tests
cd frontend
npm test
```

---

## 📄 License

**Tremors Source License (TSL)** - Source-available license allowing viewing, forking, and derivative works with **mandatory attribution**. Commercial use requires written permission.

See [LICENSE.md](LICENSE.md) for full terms.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/qtremors">qtremors</a>
</p>
