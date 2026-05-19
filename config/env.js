import 'dotenv/config';
import path from 'path';

// 하드코딩된 기본값 제거. 값이 없으면 빈 문자열('') 할당
export const PORT = process.env.PORT || '';
export const OBSIDIAN_BASE = process.env.OBSIDIAN_BASE_PATH || '';

export const OLLAMA_URL = process.env.OLLAMA_BASE_URL || '';
export const GEMMA_MODEL = process.env.OLLAMA_GEMMA_MODEL || '';

export const VLLM_URL = process.env.VLLM_BASE_URL || '';
export const QWEN_MODEL = process.env.VLLM_QWEN_MODEL || '';

// 옵시디언 하위 폴더 경로 동적 생성
export const DIR_RAW = OBSIDIAN_BASE ? path.join(OBSIDIAN_BASE, '1_Raw_Inbox') : '';
export const DIR_WIKI = OBSIDIAN_BASE ? path.join(OBSIDIAN_BASE, '2_Wiki_Auto') : '';
export const DIR_ARCHIVE = OBSIDIAN_BASE ? path.join(OBSIDIAN_BASE, '3_Raw_Archive') : '';