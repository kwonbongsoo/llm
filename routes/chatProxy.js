import express from 'express';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { qwen } from '../services/llm.js';
import { evaluateAndSaveWiki } from '../services/wikiMaker.js';
import { QWEN_SYSTEM_PROMPT } from '../config/prompts.js';
import { QWEN_MODEL } from '../config/env.js';

const router = express.Router();

function extractUserText(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    return '';
}

router.post('/chat/completions', async (req, res) => {
    const { messages, stream, model } = req.body;
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUser = userMessages[userMessages.length - 1];
    const userText = extractUserText(lastUser?.content || '');

    try {
        console.log('VSCode 요청:', userText.slice(0, 50).replace(/\n/g, ' '), '...');

        const chatMessages = [
            new SystemMessage(QWEN_SYSTEM_PROMPT),
            new HumanMessage(userText),
        ];

        const id = `chatcmpl-${Date.now()}`;
        const targetModel = model || QWEN_MODEL;

        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const qwenStream = await qwen.stream(chatMessages);
            let fullQwenResponse = "";

            for await (const chunk of qwenStream) {
                if (chunk.content) {
                    fullQwenResponse += chunk.content;
                    res.write(`data: ${JSON.stringify({
                        id,
                        object: 'chat.completion.chunk',
                        model: targetModel,
                        choices: [{ index: 0, delta: { content: chunk.content }, finish_reason: null }],
                    })}\n\n`);
                }
            }

            res.write(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', model: targetModel, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
            res.write(`data: [DONE]\n\n`);
            res.end();

            evaluateAndSaveWiki(userText, fullQwenResponse);

        } else {
            const response = await qwen.invoke(chatMessages);
            res.json({
                id,
                object: 'chat.completion',
                model: targetModel,
                choices: [{ index: 0, message: { role: 'assistant', content: response.content }, finish_reason: 'stop' }],
            });
            evaluateAndSaveWiki(userText, response.content);
        }
    } catch (err) {
        console.error('에러:', err.message);
        if (!res.headersSent) res.status(500).json({ error: { message: err.message } });
        else res.end();
    }
});

export default router;