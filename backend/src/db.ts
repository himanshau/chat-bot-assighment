import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

// Types
export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Session {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
}

export interface Message {
  id: number;
  session_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// Creates users, sessions, and messages tables (only if they don't exist)
export async function initDatabase(): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, 
    username VARCHAR(50) UNIQUE NOT NULL, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;

  await sql`CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY, 
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, 
    title VARCHAR(100) DEFAULT 'New Chat', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;

  await sql`CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY, 
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE, 
    role VARCHAR(20) NOT NULL, 
    content TEXT NOT NULL, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;

  console.log('✅ Database initialized');
}

// Gets existing user or creates new one
export async function getOrCreateUser(username: string): Promise<User> {
  let result = await sql`SELECT id, username, created_at FROM users WHERE username = ${username}`;
  if (result.length === 0) {
    result = await sql`INSERT INTO users (username) VALUES (${username}) RETURNING id, username, created_at`;
  }
  return result[0] as User;
}

// Creates a new chat session
export async function createSession(userId: number, title: string = 'New Chat'): Promise<Session> {
  const result = await sql`INSERT INTO sessions (user_id, title) VALUES (${userId}, ${title}) RETURNING id, user_id, title, created_at`;
  return result[0] as Session;
}

// Returns all sessions for a user
export async function getUserSessions(userId: number): Promise<Session[]> {
  return await sql`SELECT id, user_id, title, created_at FROM sessions WHERE user_id = ${userId} ORDER BY created_at DESC` as Session[];
}

// Updates session title
export async function updateSessionTitle(sessionId: number, title: string): Promise<void> {
  await sql`UPDATE sessions SET title = ${title} WHERE id = ${sessionId}`;
}

// Deletes a session
export async function deleteSession(sessionId: number): Promise<void> {
  await sql`DELETE FROM sessions WHERE id = ${sessionId}`;
}

// Saves a message to a session
export async function saveMessage(sessionId: number, role: 'user' | 'assistant', content: string): Promise<Message> {
  const result = await sql`INSERT INTO messages (session_id, role, content) VALUES (${sessionId}, ${role}, ${content}) RETURNING id, session_id, role, content, created_at`;
  return result[0] as Message;
}

// Returns all messages in a session
export async function getSessionMessages(sessionId: number): Promise<Message[]> {
  return await sql`SELECT id, session_id, role, content, created_at FROM messages WHERE session_id = ${sessionId} ORDER BY created_at ASC` as Message[];
}

// Clears all messages in a session
export async function clearSessionMessages(sessionId: number): Promise<void> {
  await sql`DELETE FROM messages WHERE session_id = ${sessionId}`;
}
