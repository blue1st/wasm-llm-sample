import { useState, useRef, useCallback } from 'react';
import type { InitProgressReport, MLCEngine } from '@mlc-ai/web-llm';
import { CreateMLCEngine } from '@mlc-ai/web-llm';

export const AVAILABLE_MODELS = [
  { id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC', name: 'Llama 3.2 (1B)', description: 'Fastest, very lightweight' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 (1.5B)', description: 'Fast, good Japanese support' },
  { id: 'gemma-2-2b-jpn-it-q4f16_1-MLC', name: 'Gemma 2 JPN (2B)', description: 'Excellent Japanese support' },
  { id: 'Llama-3.2-3B-Instruct-q4f32_1-MLC', name: 'Llama 3.2 (3B)', description: 'Balanced performance' },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', name: 'Phi-3.5 Mini (3.8B)', description: 'Strong reasoning capability' },
  { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 (7B)', description: 'High quality, great Japanese' },
  { id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC', name: 'Llama 3.1 (8B)', description: 'General purpose high quality' },
  { id: 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC', name: 'DeepSeek R1 Distill (7B)', description: 'Advanced reasoning/Math' }
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
