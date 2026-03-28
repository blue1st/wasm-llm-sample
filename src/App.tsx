import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, User, Cpu, Sparkles, Loader2 } from 'lucide-react';
import { useWebLLM, AVAILABLE_MODELS, DEFAULT_MODEL } from './useWebLLM';
import './index.css';

function App() {
  const {
    isInitializing,
    initProgress,
    isReady,
    isGenerating,
    messages,
    initializeEngine,
    sendMessage,
  } = useWebLLM();
  
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [input, setInput] = useState('');
  const [modelSearch, setModelSearch] = useState('');

  const filteredModels = AVAILABLE_MODELS.filter(model => 
    model.name.toLowerCase().includes(modelSearch.toLowerCase())
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const handleSend = () => {
    if (input.trim() && !isGenerating && isReady) {
      sendMessage(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Convert progress string "Loading model... 45%" to a percentage number for width
  let progressPercent = 0;
  if (initProgress?.text) {
    const match = initProgress.text.match(/(\d+)%/);
    if (match) {
      progressPercent = parseInt(match[1], 10);
    } else if (initProgress.progress !== undefined) {
      progressPercent = Math.round(initProgress.progress * 100);
    }
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1><Sparkles size={20} className="text-indigo-400" /> WebAssembly LLM</h1>
        <div className={`status-badge ${isReady ? 'ready' : isInitializing ? 'loading' : 'offline'}`}>
          {isReady ? (
            <>Ready</>
          ) : isInitializing ? (
            <><Loader2 size={12} className="loader-spinner" style={{width: 12, height: 12, borderWidth: 2}}/> Loading</>
          ) : (
            <>Offline</>
          )}
        </div>
      </header>

      {isInitializing && (
        <div className="loading-overlay">
          <div className="empty-state-icon">
            <Cpu size={32} />
          </div>
          <div className="text-center" style={{ maxWidth: 400, textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#e2e8f0' }}>Downloading Model</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              The AI model is being downloaded to your browser cache. This only happens once.
            </p>
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <p className="progress-text" style={{ marginTop: '1rem' }}>
              {initProgress?.text || 'Initializing WebGPU engine...'}
            </p>
          </div>
        </div>
      )}

      <main className="chat-area">
        {!isReady && !isInitializing && messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Bot size={32} />
            </div>
            <h2>Running AI Locally</h2>
            <p>Experience true private AI. The selected model will run entirely in your browser using WebAssembly and WebGPU.</p>
            
            <div style={{ marginTop: '1.5rem', marginBottom: '1rem', width: '100%', maxWidth: '350px', textAlign: 'left' }}>
              <label htmlFor="model-select" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>
                Select WebLLM Model:
              </label>
              <input
                type="text"
                placeholder="Search models... (e.g. gemma, llama)"
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  outline: 'none',
                  fontSize: '0.9rem',
                  marginBottom: '0.5rem'
                }}
              />
              <select
                id="model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  outline: 'none',
                  fontSize: '0.9rem',
                }}
              >
                {filteredModels.length > 0 ? (
                  filteredModels.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))
                ) : (
                  <option disabled value="">No models found.</option>
                )}
              </select>
            </div>

            <button 
              onClick={() => initializeEngine(selectedModel)}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '9999px',
                fontSize: '1rem',
                fontWeight: 500,
                cursor: 'pointer',
                marginTop: '0.5rem',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <Cpu size={18} /> Initialize Engine
            </button>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? <User size={18} color="white" /> : <Bot size={18} color="#94a3b8" />}
                </div>
                <div className="message-content">
                  {msg.content || (
                    <div className="typing-indicator">
                      <div className="dot"></div>
                      <div className="dot"></div>
                      <div className="dot"></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </main>

      <footer className="input-container">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder={isReady ? "Ask me anything..." : "Initialize the engine first..."}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={!isReady || isGenerating}
          />
          <button 
            className="send-button"
            onClick={handleSend}
            disabled={!input.trim() || !isReady || isGenerating}
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
