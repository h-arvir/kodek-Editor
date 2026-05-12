import { useState, useCallback } from 'react';

const STORAGE_KEY = 'kodek_ai_settings';

const DEFAULT_SETTINGS = {
  provider: 'groq',
  groqKey: '',
  claudeKey: '',
  openaiKey: '',
  groqModel: 'llama-3.3-70b-versatile',
  claudeModel: 'claude-haiku-4-5-20251001',
  openaiModel: 'gpt-4o-mini',
};

function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

const SYSTEM_PROMPTS = {
  explain:
    'You are an expert code assistant. Explain what the following code does in a clear, concise way. Focus on the purpose, logic flow, and any important patterns or gotchas.',
  refactor:
    'You are an expert code assistant. Refactor the following code to be cleaner, more readable, and follow best practices. Return the refactored code in a fenced code block (```), followed by a brief bullet-point list of changes made.',
  fix:
    'You are an expert code assistant. Identify and fix any bugs, errors, or issues in the following code. Return the fixed code in a fenced code block (```), followed by an explanation of what was wrong and what was fixed.',
  custom: 'You are an expert code assistant helping inside a collaborative code editor.',
};

async function consumeOpenAIStream(response, onToken, signal) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete last line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;
        try {
          const json = JSON.parse(data);
          const token = json.choices?.[0]?.delta?.content;
          if (token) onToken(token);
        } catch {
          // skip malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function streamGroq(apiKey, model, messages, onToken, signal) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: 4096 }),
    signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error ${response.status}: ${err}`);
  }

  await consumeOpenAIStream(response, onToken, signal);
}

async function streamOpenAI(apiKey, model, messages, onToken, signal) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: 4096 }),
    signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${err}`);
  }

  await consumeOpenAIStream(response, onToken, signal);
}

async function streamClaude(apiKey, model, messages, onToken, signal) {
  const systemMsg = messages.find((m) => m.role === 'system');
  const userMessages = messages.filter((m) => m.role !== 'system');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      ...(systemMsg ? { system: systemMsg.content } : {}),
      messages: userMessages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude error ${response.status}: ${err}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        try {
          const json = JSON.parse(data);
          if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
            onToken(json.delta.text);
          }
        } catch {
          // skip malformed
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function useAIAssistant() {
  const [settings, setSettings] = useState(loadSettings);
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [abortControllerRef] = useState({ current: null });

  const updateSettings = useCallback((updates) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      saveSettings(next);
      return next;
    });
  }, []);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, [abortControllerRef]);

  const clearResponse = useCallback(() => {
    setResponse('');
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async ({ action, selectedCode, fullCode, language, customPrompt }) => {
      const { provider, groqKey, claudeKey, openaiKey, groqModel, claudeModel, openaiModel } =
        settings;

      const apiKey =
        provider === 'groq' ? groqKey : provider === 'claude' ? claudeKey : openaiKey;

      if (!apiKey?.trim()) {
        setError(
          `No API key set for ${provider === 'groq' ? 'Groq' : provider === 'claude' ? 'Claude' : 'OpenAI'}. Click the settings gear to add your key.`,
        );
        return;
      }

      const systemPrompt = SYSTEM_PROMPTS[action] ?? SYSTEM_PROMPTS.custom;

      const codeSection = selectedCode?.trim()
        ? `Language: ${language}\n\nSelected code:\n\`\`\`${language}\n${selectedCode}\n\`\`\``
        : `Language: ${language}\n\nFull file:\n\`\`\`${language}\n${fullCode}\n\`\`\``;

      const userContent =
        action === 'custom' && customPrompt?.trim()
          ? `${customPrompt.trim()}\n\n${codeSection}`
          : codeSection;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ];

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsStreaming(true);
      setError(null);
      setResponse('');

      const model =
        provider === 'groq' ? groqModel : provider === 'claude' ? claudeModel : openaiModel;

      try {
        const onToken = (token) => setResponse((prev) => prev + token);

        if (provider === 'groq') {
          await streamGroq(apiKey, model, messages, onToken, controller.signal);
        } else if (provider === 'claude') {
          await streamClaude(apiKey, model, messages, onToken, controller.signal);
        } else {
          await streamOpenAI(apiKey, model, messages, onToken, controller.signal);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [settings, abortControllerRef],
  );

  return {
    settings,
    updateSettings,
    response,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearResponse,
  };
}
