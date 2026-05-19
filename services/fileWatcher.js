import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import { DIR_RAW } from '../config/env.js';
import { processSingleFile } from './wikiMaker.js';

const processingQueue = [];
let isProcessingQueue = false;

// 큐(Queue) 순차 처리
async function processQueue() {
    if (isProcessingQueue || processingQueue.length === 0) return;

    isProcessingQueue = true;
    while (processingQueue.length > 0) {
        const filePath = processingQueue.shift();
        const fileName = path.basename(filePath);
        await processSingleFile(filePath, fileName);
    }
    isProcessingQueue = false;
}

// 부팅 스윕
export async function runBootSweep() {
    console.log('\n[부팅 스윕] 서버가 꺼져있던 동안 밀린 파일이 있는지 확인합니다...');
    const files = fs.readdirSync(DIR_RAW).filter(f => f.endsWith('.txt') || f.endsWith('.md'));

    if (files.length === 0) {
        console.log('밀린 파일이 없습니다.\n');
        return;
    }

    console.log(`총 ${files.length}개의 밀린 파일을 순차적으로 처리합니다.`);
    for (const file of files) {
        await processSingleFile(path.join(DIR_RAW, file), file);
    }
    console.log('[부팅 스윕] 밀린 파일 처리 완료!\n');
}

// 실시간 감시
export function startRealtimeWatcher() {
    const watcher = chokidar.watch(DIR_RAW, {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true
    });

    console.log(`[실시간 감시] ${DIR_RAW} 폴더 감시 시작...`);

    watcher.on('add', (filePath) => {
        if (!filePath.endsWith('.txt') && !filePath.endsWith('.md')) return;
        console.log(`[파일 감지] 새 데이터 유입: ${path.basename(filePath)}`);

        processingQueue.push(filePath);
        processQueue();
    });
}