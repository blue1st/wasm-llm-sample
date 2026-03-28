import { useState, useRef, useCallback } from 'react';
import type { InitProgressReport, MLCEngine } from '@mlc-ai/web-llm';
import { CreateMLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm';

// WebLLM公式で現在サポート・コンパイル済みの全モデルを動的に取得
export const AVAILABLE_MODELS = prebuiltAppConfig.model_list.map(model => ({
  id: model.model_id,
  name: model.model_id,
  description: '公式サポートモデル'
}));

export const DEFAULT_MODEL = AVAILABLE_MODELS.length > 0 ? AVAILABLE_MODELS[0].id : '';
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

      // デフォルトのモデルリストから選択されるため、カスタム appConfig は不要
      const newEngine = await CreateMLCEngine(selectedModelId, { 
        initProgressCallback,
      });
      
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
