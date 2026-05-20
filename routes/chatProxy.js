import express from 'express';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
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

    // 1. 위키 평가용 텍스트 추출 (멀티턴 중 가장 마지막 요청)
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUser = userMessages[userMessages.length - 1];
    const lastUserText = extractUserText(lastUser?.content || '');

    try {
        console.log('API 요청:', lastUserText.slice(0, 50).replace(/\n/g, ' '), '...');

        // 2. 맥락 유지를 위한 체인 생성 (파일 첨부 및 멀티턴 지원)
        const chatMessages = [new SystemMessage(QWEN_SYSTEM_PROMPT)];

        for (const m of messages) {
            const textContent = extractUserText(m.content);
            if (!textContent) continue;

            if (m.role === 'user') {
                chatMessages.push(new HumanMessage(textContent));
            } else if (m.role === 'assistant') {
                chatMessages.push(new AIMessage(textContent));
            }
        }

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

            // 3. ⭐ Cline 에이전트 필터 로직
            const isAgentToolCall = fullQwenResponse.includes('<tool_call>') ||
                fullQwenResponse.includes('<execute_command>') ||
                fullQwenResponse.includes('<read_file>');

            if (!isAgentToolCall) {
                evaluateAndSaveWiki(lastUserText, fullQwenResponse);
            } else {
                console.log('[에이전트 필터] 기계적 명령(Tool Call) 루프 감지 - 위키 저장을 생략합니다.\n');
            }

        } else {
            const response = await qwen.invoke(chatMessages);
            res.json({
                id,
                object: 'chat.completion',
                model: targetModel,
                choices: [{ index: 0, message: { role: 'assistant', content: response.content }, finish_reason: 'stop' }],
            });

            // 단일 응답에도 동일한 필터 적용
            const isAgentToolCall = response.content.includes('<tool_call>') ||
                response.content.includes('<execute_command>') ||
                response.content.includes('<read_file>');

            if (!isAgentToolCall) {
                evaluateAndSaveWiki(lastUserText, response.content);
            } else {
                console.log('[에이전트 필터] 기계적 명령(Tool Call) 루프 감지 - 위키 저장을 생략합니다.\n');
            }
        }
    } catch (err) {
        console.error('에러:', err.message);
        if (!res.headersSent) res.status(500).json({ error: { message: err.message } });
        else res.end();
    }
});

export default router;