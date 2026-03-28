import { useState, useRef, useCallback } from 'react';
import type { InitProgressReport, MLCEngine } from '@mlc-ai/web-llm';
import { CreateMLCEngine } from '@mlc-ai/web-llm';

export const AVAILABLE_MODELS = [
  { id: 'gemma-3-1b-it-q4f16_1-MLC', name: 'Gemma 3 (1B)', description: '最小で超高速' },
  { id: 'gemma-3-4b-it-q4f16_1-MLC', name: 'Gemma 3 (4B)', description: 'バランスの良いモデル' },
  { id: 'gemma-3-12b-it-q4f16_1-MLC', name: 'Gemma 3 (12B)', description: '高品質で高負荷' },
  { id: 'gemma-3-27b-it-q4f16_1-MLC', name: 'Gemma 3 (27B)', description: '最高品質で超高負荷' }
];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0].id;
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function useWebLLM() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [initProgress, setInitProgress] = useState<InitProgressReport | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const engineRef = useRef<MLCEngine | null>(null);

  const initializeEngine = useCallback(async (selectedModelId: string = DEFAULT_MODEL) => {
    if (isInitializing || isReady) return;
    setIsInitializing(true);

    try {
      const initProgressCallback = (report: InitProgressReport) => {
        setInitProgress(report);
      };

      const newEngine = await CreateMLCEngine(selectedModelId, { initProgressCallback });
      engineRef.current = newEngine;
      setIsReady(true);
    } catch (error) {
      console.error('Failed to initialize WebLLM engine:', error);
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing, isReady]);

  const sendMessage = useCallback(async (content: string) => {
    if (!engineRef.current || isGenerating) return;

    const userMessage: ChatMessage = { role: 'user', content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsGenerating(true);

    try {
      // Create a temporary assistant message for streaming
      let assistantMessageContent = '';
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      const chunks = await engineRef.current.chat.completions.create({
        messages: newMessages,
        stream: true,
      });

      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content || '';
        assistantMessageContent += delta;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1].content = assistantMessageContent;
          return updated;
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'An error occurred while generating the response.' },
      ]);
    } finally {
      setIsGenerating(false);
    }
  }, [messages, isGenerating]);

  return {
    isInitializing,
    initProgress,
    isReady,
    isGenerating,
    messages,
    initializeEngine,
    sendMessage,
  };
}
