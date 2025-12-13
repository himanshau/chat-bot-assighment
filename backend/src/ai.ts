import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type { Message } from './db.js';

// dotenv is configured in index.ts

// Initialize OpenRouter client (OpenAI-compatible)
const openrouter = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY!,
});

// Uses AI SDK to generate response from chat history
export async function generateAIResponse(userMessage: string, history: Message[]): Promise<string> {
    const messages = [
        { role: 'system' as const, content: 'You are a helpful, friendly AI assistant. Keep responses concise.' },
        ...history.map((msg) => ({ role: msg.role as 'user' | 'assistant', content: msg.content })),
        { role: 'user' as const, content: userMessage }
    ];

    const { text } = await generateText({
        model: openrouter('mistralai/mistral-7b-instruct:free'),
        messages,
        maxTokens: 500,
        temperature: 0.7,
    });

    return text;
}
