# AI Chat Application

A full-stack AI chat application with user sessions and persistent history.

## Features
- 🔐 User login (username-based)
- 💬 Multiple chat sessions per user
- 🤖 AI responses via OpenRouter (Mistral 7B)
- 📚 Persistent chat history (PostgreSQL)
- 🎨 Modern dark theme (Tailwind CSS)

## Quick Start

### Run Locally

**Terminal 1 - Backend:**
```bash
cd backend
npm install
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### Environment Variables

Create `backend/.env`:
```
DATABASE_URL=your_neon_connection_string
OPENROUTER_API_KEY=your_openrouter_key
PORT=3001
```

## Deploy to Railway

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step deployment guide.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed flow and file structure.

## Tech Stack
- Frontend: React + Tailwind CSS + Vite
- Backend: Node.js + Express
- Database: Neon PostgreSQL
- AI: OpenRouter API
