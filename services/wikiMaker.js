import fs from 'fs';
import path from 'path';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { gemma, qwen } from './llm.js';
import { DIR_WIKI, DIR_ARCHIVE } from '../config/env.js';
import { GEMMA_GATEKEEPER_PROMPT, WIKI_FORMATTER_PROMPT } from '../config/prompts.js';

// (1) 채팅 기록 평가 및 위키 저장
export async function evaluateAndSaveWiki(userText, qwenResponse) {
    try {
        console.log('[Gemma] 대화 내용 위키 저장 가치 평가 중...');
        const evaluationContent = `[사용자 질문]\n${userText}\n\n[AI 답변]\n${qwenResponse}`;

        const res = await gemma.invoke([
            new SystemMessage(GEMMA_GATEKEEPER_PROMPT),
            new HumanMessage(evaluationContent),
        ]);

        const output = res.content.trim();
        if (output.includes('SKIP') || !output.includes('[SAVE]')) {
            console.log('[Gemma] 일회성 대화로 판단하여 저장을 생략합니다.\n');
            return;
        }

        let wikiContent = output.replace('[SAVE]', '').trim();
        wikiContent = wikiContent.replace('{{DATE}}', new Date().toISOString().split('T')[0]);

        const safeTitleMatch = wikiContent.match(/# (.*)/);
        let safeTitle = safeTitleMatch ? safeTitleMatch[1].replace(/[/\\?%*:|"<>]/g, '').trim() : 'Uncategorized';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        fs.writeFileSync(path.join(DIR_WIKI, `${safeTitle}_${timestamp}.md`), wikiContent, 'utf-8');
        console.log(`[Gemma] 실시간 대화 위키 저장 완료: ${safeTitle}\n`);
    } catch (err) {
        console.error('Gemma 위키 가치 평가 실패:', err.message);
    }
}

// (2) Raw 파일 위키 변환 및 아카이브 이동
export async function processSingleFile(filePath, fileName) {
    const archiveFilePath = path.join(DIR_ARCHIVE, fileName);

    try {
        console.log(`AI 변환 중... : ${fileName}`);
        const rawContent = fs.readFileSync(filePath, 'utf-8');

        const res = await qwen.invoke([
            new SystemMessage(WIKI_FORMATTER_PROMPT),
            new HumanMessage(`[사용자 수집 Raw 데이터]\n\n${rawContent}`),
        ]);

        let finalMarkdown = res.content.trim();
        finalMarkdown = finalMarkdown.replace('{{DATE}}', new Date().toISOString().split('T')[0]);

        const safeTitleMatch = finalMarkdown.match(/# (.*)/);
        let safeTitle = safeTitleMatch ? safeTitleMatch[1].replace(/[/\\?%*:|"<>]/g, '').trim() : path.parse(fileName).name;

        fs.writeFileSync(path.join(DIR_WIKI, `${safeTitle}.md`), finalMarkdown, 'utf-8');
        fs.renameSync(filePath, archiveFilePath);

        console.log(`위키 저장 완료: ${safeTitle}.md\n`);
    } catch (err) {
        console.error(`처리 실패 [${fileName}]:`, err.message);
    }
}