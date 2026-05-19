import express from 'express';
import fs from 'fs';
import { PORT, OBSIDIAN_BASE, DIR_RAW, DIR_WIKI, DIR_ARCHIVE, VLLM_URL, OLLAMA_URL } from './config/env.js';
import chatProxyRouter from './routes/chatProxy.js';
import { runBootSweep, startRealtimeWatcher } from './services/fileWatcher.js';

// 시작 전 환경 변수 누락 검증 (보호 장치)
if (!PORT || !OBSIDIAN_BASE || !VLLM_URL || !OLLAMA_URL) {
    console.error('치명적 에러: .env 파일에 필수 환경 변수가 누락되었습니다. 설정을 확인해 주세요.');
    process.exit(1); // 서버 즉시 종료
}

// 필수 폴더 검증 및 생성
;[DIR_RAW, DIR_WIKI, DIR_ARCHIVE].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const app = express();
app.use(express.json());

// 라우터 연결 (기본 경로가 /v1/chat/completions 가 되도록 세팅)
app.use('/v1', chatProxyRouter);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, async () => {
    console.log(`================================================================`);
    console.log(`AI 프록시 & 자동화 위키 서버 작동 중: http://localhost:${PORT}`);
    console.log(`감시 대상 폴더: ${DIR_RAW}`);
    console.log(`================================================================`);

    // 부팅 스윕 및 감시 시작
    await runBootSweep();
    startRealtimeWatcher();
});