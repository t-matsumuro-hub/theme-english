/* アプリ全体の状態。現在のパックと、その習熟度をメモリに持つ。 */

import {
  dbGet, dbGetAll, dbPut, dbDel, dbByIndex, dbDelByIndex
} from './db.js';
import { grade, isDue, isMastered } from './srs.js';

/* TOEIC の目安で4段階。パック側の level はこの番号を使う */
export const LEVELS = {
  1: { label: 'L1', range: '350–500', name: '基礎' },
  2: { label: 'L2', range: '500–650', name: '標準' },
  3: { label: 'L3', range: '650–800', name: '応用' },
  4: { label: 'L4', range: '800–990', name: '上級' }
};

export const QTYPES = {
  cloze: '穴埋め',
  form: '品詞・語形',
  meaning: '意味・ニュアンス',
  scene: '使用場面',
  fix: '正しい英文',
  order: '並べ替え',
  write: '英作文'
};

const DEFAULTS = {
  levelMin: 1,
  levelMax: 4,
  quizCount: 10,
  quizTypes: ['cloze', 'form', 'meaning', 'scene', 'fix', 'order'],
  ttsRate: 0.9,
  currentPack: null
};

export const state = {
  settings: { ...DEFAULTS },
  packs: [],
  pack: null,
  progress: new Map()   // qid -> 進捗
};

export async function loadAll() {
  state.settings = { ...DEFAULTS, ...((await dbGet('kv', 'settings')) || {}) };
  state.packs = await dbGetAll('packs');
  sortPacks();
  await selectPack(state.settings.currentPack);
}

function sortPacks() {
  state.packs.sort((a, b) => String(b.importedAt || '').localeCompare(String(a.importedAt || '')));
}

export async function saveSettings() {
  await dbPut('kv', state.settings, 'settings');
}

export async function selectPack(id) {
  state.pack = state.packs.find((p) => p.id === id) || state.packs[0] || null;
  state.settings.currentPack = state.pack ? state.pack.id : null;
  await saveSettings();
  state.progress = new Map();
  if (state.pack) {
    const rows = await dbByIndex('progress', 'pack', state.pack.id);
    for (const r of rows) state.progress.set(r.qid, r);
  }
  document.getElementById('pack-title').textContent = state.pack ? state.pack.title : 'テーマ英語';
}

/* ---------------- パック ---------------- */

/** 取り込み前の検査。問題があれば理由の配列を返す */
export function validatePack(p) {
  const errs = [];
  if (!p || p.kind !== 'theme-pack') return ['テーマパックの形式ではありません'];
  if (!p.id) errs.push('id がありません');
  if (!Array.isArray(p.items) || !p.items.length) errs.push('items がありません');
  if (!Array.isArray(p.questions) || !p.questions.length) errs.push('questions がありません');
  if (errs.length) return errs;

  const itemIds = new Set(p.items.map((i) => i.id));
  const qids = new Set();
  for (const q of p.questions) {
    if (qids.has(q.id)) errs.push(`問題IDが重複: ${q.id}`);
    qids.add(q.id);
    if (!itemIds.has(q.itemId)) errs.push(`${q.id}: 表現 ${q.itemId} がありません`);
    if (!QTYPES[q.type]) errs.push(`${q.id}: 不明な形式 ${q.type}`);
    if (!LEVELS[q.level]) errs.push(`${q.id}: レベルが不正`);
    if (['cloze', 'form', 'meaning', 'scene', 'fix'].includes(q.type)) {
      if (!Array.isArray(q.choices) || !(q.answer >= 0 && q.answer < q.choices.length)) {
        errs.push(`${q.id}: 選択肢か正解番号が不正`);
      }
    }
    if (q.type === 'order' && !(Array.isArray(q.tokens) && q.tokens.length > 1)) errs.push(`${q.id}: tokens が不正`);
    if (q.type === 'write' && !(Array.isArray(q.models) && q.models.length)) errs.push(`${q.id}: 模範解答がありません`);
  }
  return errs;
}

export async function importPack(p) {
  const exists = state.packs.find((x) => x.id === p.id);
  p.importedAt = exists ? exists.importedAt : new Date().toISOString();
  await dbPut('packs', p);
  state.packs = state.packs.filter((x) => x.id !== p.id).concat(p);
  sortPacks();
  await selectPack(p.id);
  return { replaced: !!exists };
}

export async function deletePack(id) {
  await dbDel('packs', id);
  await dbDelByIndex('progress', 'pack', id);
  await dbDelByIndex('attempts', 'pack', id);
  state.packs = state.packs.filter((p) => p.id !== id);
  await selectPack(null);
}

/* ---------------- 参照 ---------------- */

export const itemById = (id) => state.pack && state.pack.items.find((i) => i.id === id);
export const inRange = (lv) => lv >= state.settings.levelMin && lv <= state.settings.levelMax;

export function questionsFor(itemId) {
  return state.pack ? state.pack.questions.filter((q) => q.itemId === itemId) : [];
}

/** 表現の定着率（0〜1）。出題範囲内の問題で計算する */
export function itemMastery(itemId) {
  const qs = questionsFor(itemId).filter((q) => inRange(q.level));
  if (!qs.length) return null;
  return qs.filter((q) => isMastered(state.progress.get(q.id))).length / qs.length;
}

export function levelStats() {
  const out = {};
  const now = Date.now();
  for (const lv of Object.keys(LEVELS)) out[lv] = { total: 0, mastered: 0, seen: 0, due: 0 };
  if (!state.pack) return out;
  for (const q of state.pack.questions) {
    const s = out[q.level];
    const p = state.progress.get(q.id);
    s.total++;
    if (p) s.seen++;
    if (isMastered(p)) s.mastered++;
    if (isDue(p, now)) s.due++;
  }
  return out;
}

export function dueCount() {
  if (!state.pack) return 0;
  const now = Date.now();
  return state.pack.questions.filter((q) =>
    q.type !== 'write' && inRange(q.level) && isDue(state.progress.get(q.id), now)).length;
}

/* ---------------- 記録 ---------------- */

export async function record(q, result, extra = {}) {
  const prev = state.progress.get(q.id);
  const p = grade(prev, result);
  const rec = { ...p, key: `${state.pack.id}|${q.id}`, pack: state.pack.id, qid: q.id, ...extra };
  state.progress.set(q.id, rec);
  await dbPut('progress', rec);
  return rec;
}

export async function addAttempt(q, text, self) {
  await dbPut('attempts', {
    pack: state.pack.id, qid: q.id, itemId: q.itemId, answer: text, self, at: new Date().toISOString()
  });
}

export const attemptsForPack = (id) => dbByIndex('attempts', 'pack', id);
export const allProgress = () => dbGetAll('progress');
export const allAttempts = () => dbGetAll('attempts');
