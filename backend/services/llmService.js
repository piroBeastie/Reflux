/**
 * llmService.js
 * LLM client — Google Gemini native SDK. No format conversion.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;

function getLlmConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.LLM_MODEL || 'gemini-3.1-flash-lite';
  return { provider: 'gemini', apiKey, model, configured: Boolean(apiKey) };
}

function getClient() {
  if (!genAI) {
    const config = getLlmConfig();
    if (!config.configured) {
      throw new Error('GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey');
    }
    genAI = new GoogleGenerativeAI(config.apiKey);
  }
  return genAI;
}

// --- Retry with model fallback ---

const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-2.5-flash-lite'];
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callWithRetry(fn, lockedModel) {
  const { model } = getLlmConfig();
  const models = lockedModel
    ? [lockedModel]
    : [model, ...FALLBACK_MODELS.filter((m) => m !== model)];

  for (let i = 0; i < models.length; i++) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn(models[i]);
      } catch (err) {
        const status = err.status || err.httpStatusCode;
        const retryable = status === 429 || status === 503;
        if (!retryable) throw err;
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS * (attempt + 1));
        } else if (i < models.length - 1) {
          console.error(`[llm] ${models[i]} unavailable, falling back to ${models[i + 1]}`);
        } else {
          throw err;
        }
      }
    }
  }
}

// --- Public API ---

/**
 * Chat completion with tool use (function calling).
 * Takes Gemini-native format: { systemInstruction, contents, tools, _lockedModel }
 *
 * contents: [{ role: 'user'|'model', parts: [...] }]
 * tools: [{ functionDeclarations: [...] }]
 *
 * Returns the raw candidate response + _usedModel for model locking.
 */
async function chatCompletion({ systemInstruction, contents, tools, _lockedModel }) {
  const ai = getClient();

  return callWithRetry((modelName) => {
    const m = ai.getGenerativeModel({
      model: modelName,
      systemInstruction,
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    });
    const request = { contents };
    if (tools) request.tools = tools;
    return m.generateContent(request).then((result) => {
      const candidate = result.response.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      return { parts, _usedModel: modelName };
    });
  }, _lockedModel);
}

/**
 * Simple text completion (no tools). Used by evaluator and fixGenerator.
 */
async function textCompletion({ systemPrompt, userPrompt }) {
  const ai = getClient();

  return callWithRetry((modelName) => {
    const m = ai.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    });
    return m.generateContent(userPrompt).then((r) => r.response.text());
  });
}

module.exports = { getClient, getLlmConfig, chatCompletion, textCompletion };
