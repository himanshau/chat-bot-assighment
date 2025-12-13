import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase, getOrCreateUser, createSession, getUserSessions, deleteSession, saveMessage, getSessionMessages, clearSessionMessages, updateSessionTitle } from './db.js';
import { generateAIResponse } from './ai.js';

dotenv.config();

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check - moved to /api/health so frontend can be served at /
app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', message: 'AI Chat Backend Running' });
});

// Login or register user
app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
        const { username } = req.body;
        if (!username || username.trim().length < 2) {
            return res.json({ success: false, error: 'Username must be at least 2 characters' });
        }
        const user = await getOrCreateUser(username.trim().toLowerCase());
        res.json({ success: true, user });
    } catch (error) {
        res.json({ success: false, error: 'Failed to login' });
    }
});

// Get all sessions for a user
app.get('/api/sessions/:userId', async (req: Request, res: Response) => {
    try {
        const sessions = await getUserSessions(parseInt(req.params.userId));
        res.json({ success: true, sessions });
    } catch (error) {
        res.json({ success: false, error: 'Failed to fetch sessions' });
    }
});

// Create new session
app.post('/api/sessions', async (req: Request, res: Response) => {
    try {
        const { userId, title } = req.body;
        const session = await createSession(userId, title || 'New Chat');
        res.json({ success: true, session });
    } catch (error) {
        res.json({ success: false, error: 'Failed to create session' });
    }
});

// Delete session
app.delete('/api/sessions/:sessionId', async (req: Request, res: Response) => {
    try {
        await deleteSession(parseInt(req.params.sessionId));
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: 'Failed to delete session' });
    }
});

// Get messages in session
app.get('/api/sessions/:sessionId/messages', async (req: Request, res: Response) => {
    try {
        const messages = await getSessionMessages(parseInt(req.params.sessionId));
        res.json({ success: true, messages });
    } catch (error) {
        res.json({ success: false, error: 'Failed to fetch messages' });
    }
});

// Send message and get AI response
app.post('/api/sessions/:sessionId/chat', async (req: Request, res: Response) => {
    try {
        const sessionId = parseInt(req.params.sessionId);
        const { message } = req.body;
        if (!message?.trim()) return res.json({ success: false, error: 'Message cannot be empty' });

        await saveMessage(sessionId, 'user', message);
        const history = await getSessionMessages(sessionId);
        const aiResponse = await generateAIResponse(message, history.slice(0, -1));
        const savedResponse = await saveMessage(sessionId, 'assistant', aiResponse);

        if (history.length <= 1) await updateSessionTitle(sessionId, message.substring(0, 50));

        res.json({ success: true, response: savedResponse });
    } catch (error) {
        console.error('Chat error:', error);
        res.json({ success: false, error: 'Failed to process message' });
    }
});

// Clear messages in session
app.delete('/api/sessions/:sessionId/messages', async (req: Request, res: Response) => {
    try {
        await clearSessionMessages(parseInt(req.params.sessionId));
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: 'Failed to clear messages' });
    }
});

// Serve frontend static files (production)
// When running from dist/index.js, __dirname is backend/dist
// So we go up to backend, then up to root, then into frontend/dist
const frontendPath = path.join(__dirname, '../..', 'frontend/dist');
app.use(express.static(frontendPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Start server
initDatabase().then(() => {
    app.listen(PORT, () => console.log(`🚀 Backend running at http://localhost:${PORT}`));
}).catch((error) => {
    console.error('Failed to initialize:', error);
    process.exit(1);
});
