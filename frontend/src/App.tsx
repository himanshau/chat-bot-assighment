import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';
import './index.css';

interface User {
    id: number;
    username: string;
}

interface Session {
    id: number;
    user_id: number;
    title: string;
    created_at: string;
}

interface Message {
    id: number;
    session_id: number;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

const API_URL = import.meta.env.VITE_API_URL || '';

function App() {
    // Auth state
    const [user, setUser] = useState<User | null>(null);
    const [loginUsername, setLoginUsername] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);

    // Session state
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeSession, setActiveSession] = useState<Session | null>(null);

    // Chat state
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Check for saved user on mount
    useEffect(() => {
        const savedUser = localStorage.getItem('chatUser');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }
    }, []);

    // Fetch sessions when user logs in
    useEffect(() => {
        if (user) {
            fetchSessions();
        }
    }, [user]);

    // Fetch messages when session changes
    useEffect(() => {
        if (activeSession) {
            fetchMessages();
        } else {
            setMessages([]);
        }
    }, [activeSession]);

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    }, [inputValue]);

    // Auth functions
    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        if (!loginUsername.trim() || loginLoading) return;

        setLoginLoading(true);
        setLoginError('');

        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: loginUsername.trim() })
            });
            const data = await response.json();

            if (data.success) {
                setUser(data.user);
                localStorage.setItem('chatUser', JSON.stringify(data.user));
                setLoginUsername('');
            } else {
                setLoginError(data.error || 'Login failed');
            }
        } catch {
            setLoginError('Failed to connect to server');
        } finally {
            setLoginLoading(false);
        }
    };

    const handleLogout = () => {
        setUser(null);
        setActiveSession(null);
        setSessions([]);
        setMessages([]);
        localStorage.removeItem('chatUser');
    };

    // Session functions
    const fetchSessions = async () => {
        if (!user) return;
        try {
            const response = await fetch(`${API_URL}/api/sessions/${user.id}`);
            const data = await response.json();
            if (data.success) {
                setSessions(data.sessions);
                if (data.sessions.length > 0 && !activeSession) {
                    setActiveSession(data.sessions[0]);
                }
            }
        } catch (err) {
            console.error('Error fetching sessions:', err);
        }
    };

    const createNewSession = async () => {
        if (!user) return;
        try {
            const response = await fetch(`${API_URL}/api/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, title: 'New Chat' })
            });
            const data = await response.json();
            if (data.success) {
                setSessions(prev => [data.session, ...prev]);
                setActiveSession(data.session);
                setMessages([]);
            }
        } catch (err) {
            console.error('Error creating session:', err);
        }
    };

    const deleteSession = async (sessionId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const response = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                setSessions(prev => prev.filter(s => s.id !== sessionId));
                if (activeSession?.id === sessionId) {
                    setActiveSession(sessions.find(s => s.id !== sessionId) || null);
                }
            }
        } catch (err) {
            console.error('Error deleting session:', err);
        }
    };

    // Message functions
    const fetchMessages = async () => {
        if (!activeSession) return;
        try {
            const response = await fetch(`${API_URL}/api/sessions/${activeSession.id}/messages`);
            const data = await response.json();
            if (data.success) {
                setMessages(data.messages);
            }
        } catch (err) {
            console.error('Error fetching messages:', err);
        }
    };

    const sendMessage = async (e?: FormEvent) => {
        e?.preventDefault();

        const message = inputValue.trim();
        if (!message || isLoading || !activeSession) return;

        setInputValue('');
        setIsLoading(true);
        setIsTyping(true);
        setError(null);

        const tempUserMessage: Message = {
            id: Date.now(),
            session_id: activeSession.id,
            role: 'user',
            content: message,
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempUserMessage]);

        try {
            const response = await fetch(`${API_URL}/api/sessions/${activeSession.id}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            const data = await response.json();

            if (data.success) {
                setMessages(prev => [...prev, data.response]);
                fetchSessions();
            } else {
                setError(data.error || 'Failed to get AI response');
                setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
            }
        } catch {
            setError('Failed to send message');
            setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
        } finally {
            setIsLoading(false);
            setIsTyping(false);
        }
    };

    const clearMessages = async () => {
        if (!activeSession || !confirm('Clear all messages in this chat?')) return;
        try {
            await fetch(`${API_URL}/api/sessions/${activeSession.id}/messages`, {
                method: 'DELETE'
            });
            setMessages([]);
        } catch (err) {
            console.error('Error clearing messages:', err);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    // Login screen
    if (!user) {
        return (
            <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
                <div className="bg-zinc-800 border border-zinc-700 rounded-2xl p-8 w-full max-w-sm">
                    <h1 className="text-2xl font-semibold text-white text-center mb-2">AI Chat</h1>
                    <p className="text-zinc-400 text-sm text-center mb-6">Enter your username to start chatting</p>
                    <form onSubmit={handleLogin}>
                        <input
                            type="text"
                            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 mb-4"
                            placeholder="Username"
                            value={loginUsername}
                            onChange={(e) => setLoginUsername(e.target.value)}
                            disabled={loginLoading}
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="w-full py-3 bg-white text-zinc-900 font-medium rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            disabled={!loginUsername.trim() || loginLoading}
                        >
                            {loginLoading ? 'Logging in...' : 'Continue'}
                        </button>
                    </form>
                    {loginError && <p className="text-red-400 text-sm text-center mt-3">{loginError}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex bg-zinc-900">
            {/* Sidebar */}
            <aside className="w-64 bg-zinc-800 border-r border-zinc-700 flex flex-col flex-shrink-0">
                <div className="p-4 border-b border-zinc-700">
                    <button
                        onClick={createNewSession}
                        className="w-full py-3 px-4 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                    >
                        + New Chat
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => setActiveSession(session)}
                            className={`px-3 py-2.5 rounded-lg cursor-pointer flex items-center justify-between mb-1 transition-colors group
                ${activeSession?.id === session.id
                                    ? 'bg-zinc-700 text-white'
                                    : 'text-zinc-400 hover:bg-zinc-700/50 hover:text-white'}`}
                        >
                            <span className="truncate text-sm">{session.title}</span>
                            <button
                                onClick={(e) => deleteSession(session.id, e)}
                                className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all px-1"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    {sessions.length === 0 && (
                        <p className="text-zinc-500 text-xs text-center p-4">
                            No chats yet. Start a new one!
                        </p>
                    )}
                </div>

                <div className="p-4 border-t border-zinc-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-zinc-700 rounded-lg flex items-center justify-center text-sm text-white">
                            {user.username[0].toUpperCase()}
                        </div>
                        <span className="text-zinc-400 text-sm">{user.username}</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-zinc-500 text-xs hover:text-white transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {activeSession ? (
                    <>
                        {/* Header */}
                        <header className="px-6 py-4 bg-zinc-800 border-b border-zinc-700 flex items-center justify-between">
                            <h1 className="text-white font-medium truncate max-w-md">{activeSession.title}</h1>
                            {messages.length > 0 && (
                                <button
                                    onClick={clearMessages}
                                    className="text-zinc-500 text-sm hover:text-white border border-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    Clear
                                </button>
                            )}
                        </header>

                        {/* Messages */}
                        <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                            {messages.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center">
                                    <h2 className="text-white font-medium mb-2">Start a Conversation</h2>
                                    <p className="text-zinc-500 text-sm max-w-xs">Send a message to begin chatting with AI.</p>
                                </div>
                            ) : (
                                <>
                                    {messages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={`flex gap-3 max-w-2xl animate-fade-in
                        ${message.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
                                        >
                                            <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-medium flex-shrink-0
                        ${message.role === 'user'
                                                    ? 'bg-white text-zinc-900'
                                                    : 'bg-zinc-700 border border-zinc-600 text-white'}`}
                                            >
                                                {message.role === 'user' ? user.username[0].toUpperCase() : 'AI'}
                                            </div>
                                            <div>
                                                <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed
                          ${message.role === 'user'
                                                        ? 'bg-white text-zinc-900 rounded-br-sm'
                                                        : 'bg-zinc-800 border border-zinc-700 text-white rounded-bl-sm'}`}
                                                >
                                                    {message.content}
                                                </div>
                                                <p className={`text-[10px] text-zinc-600 mt-1 px-1
                          ${message.role === 'user' ? 'text-right' : ''}`}
                                                >
                                                    {formatTime(message.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Typing indicator */}
                                    {isTyping && (
                                        <div className="flex gap-3 max-w-2xl self-start">
                                            <div className="w-7 h-7 rounded-md bg-zinc-700 border border-zinc-600 flex items-center justify-center text-xs text-white">
                                                AI
                                            </div>
                                            <div className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl rounded-bl-sm">
                                                <div className="flex gap-1">
                                                    <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                                    <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                                    <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                            <div ref={messagesEndRef} />
                        </main>

                        {/* Input */}
                        <footer className="px-6 py-4 bg-zinc-800 border-t border-zinc-700">
                            <form onSubmit={sendMessage} className="max-w-2xl mx-auto flex gap-3 items-end">
                                <textarea
                                    ref={textareaRef}
                                    className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 text-sm resize-none focus:outline-none focus:border-zinc-500 min-h-[44px] max-h-[150px]"
                                    placeholder="Type your message..."
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={isLoading}
                                    rows={1}
                                />
                                <button
                                    type="submit"
                                    className="w-11 h-11 bg-white text-zinc-900 rounded-xl flex items-center justify-center hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    disabled={isLoading || !inputValue.trim()}
                                >
                                    ➤
                                </button>
                            </form>
                            {error && (
                                <p className="text-red-400 text-xs text-center mt-2">{error}</p>
                            )}
                        </footer>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                        <h2 className="text-white font-medium mb-2">Welcome, {user.username}!</h2>
                        <p className="text-zinc-500 text-sm mb-4">Create a new chat to get started.</p>
                        <button
                            onClick={createNewSession}
                            className="py-3 px-6 bg-white text-zinc-900 font-medium rounded-xl hover:bg-zinc-200 transition-colors"
                        >
                            + New Chat
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
