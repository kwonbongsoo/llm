import { ChatOpenAI } from '@langchain/openai';
import { ChatOllama } from '@langchain/ollama';
import { OLLAMA_URL, GEMMA_MODEL, VLLM_URL, QWEN_MODEL } from '../config/env.js';

export const gemma = new ChatOllama({
    baseUrl: OLLAMA_URL,
    model: GEMMA_MODEL,
    temperature: 0.1,
});

export const qwen = new ChatOpenAI({
    apiKey: 'dummy',
    configuration: { baseURL: VLLM_URL },
    modelName: QWEN_MODEL,
    temperature: 0.2,
    maxTokens: 4096,
});