import { useState, useRef, useCallback, useEffect } from 'react';
import type { InitProgressReport, MLCEngine } from '@mlc-ai/web-llm';
import { CreateMLCEngine, prebuiltAppConfig, hasModelInCache } from '@mlc-ai/web-llm';

// カスタムでGemma-3-1Bを追加
const CUSTOM_MODELS = [
  /*{
    model: 'https://huggingface.co/mlc-ai/gemma-3-1b-it-q4f16_1-MLC/resolve/main/',
    model_id: 'gemma-3-1b-it-q4f16_1-MLC',
    model_lib: 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_80/gemma-3-1b-it-q4f16_1-ctx4k_cs1k-webgpu.wasm',
  }*/
];

// 公式カタログとカスタム追加分を結合
const appConfig = {
  ...prebuiltAppConfig,
  model_list: [
    ...CUSTOM_MODELS,
    ...prebuiltAppConfig.model_list
  ]
};

// ドロップダウン用の表示リストを生成
export const AVAILABLE_MODELS = appConfig.model_list.map(model => ({
  id: model.model_id,
  name: model.model_id === 'gemma-3-1b-it-q4f16_1-MLC' ? 'Gemma 3 (1B)' : model.model_id,
  description: model.model_id === 'gemma-3-1b-it-q4f16_1-MLC' ? 'カスタム追加 (最新)' : '公式サポートモデル'
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
  const [cachedModels, setCachedModels] = useState<Record<string, boolean>>({});
  const engineRef = useRef<MLCEngine | null>(null);

  useEffect(() => {
    let mounted = true;
    const checkCache = async () => {
      const results: Record<string, boolean> = {};
      await Promise.all(
        AVAILABLE_MODELS.map(async (m) => {
          try {
            results[m.id] = await hasModelInCache(m.id, appConfig);
          } catch (error) {
            results[m.id] = false;
          }
        })
      );
      if (mounted) {
        setCachedModels(results);
      }
    };
    checkCache();
    return () => {
      mounted = false;
    };
  }, []);

  const initializeEngine = useCallback(async (selectedModelId: string = DEFAULT_MODEL) => {
    if (isInitializing || isReady) return;
    setIsInitializing(true);

    try {
      const initProgressCallback = (report: InitProgressReport) => {
        setInitProgress(report);
      };

      // カスタムリストを含めた appConfig を渡すことで、公式＋Gemma-3 の両方を認識させる
      const newEngine = await CreateMLCEngine(selectedModelId, {
        initProgressCallback,
        appConfig
      });

      engineRef.current = newEngine;
      setIsReady(true);
    } catch (error) {
      console.error('Failed to initialize WebLLM engine:', error);
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing, isReady]);

  const resetEngine = useCallback(async () => {
    if (engineRef.current) {
      try {
        await engineRef.current.unload(); // Free WebGPU memory
      } catch (e) {
        console.error('Failed to unload engine:', e);
      }
      engineRef.current = null;
    }
    setIsReady(false);
    setMessages([]);
    setInitProgress(null);
  }, []);

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
    resetEngine,
    sendMessage,
    cachedModels,
  };
}
