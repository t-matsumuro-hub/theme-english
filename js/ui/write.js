/* 英作文：和文を英訳し、キーワード判定と模範解答で自己採点する。
   答案は保存し、学習ログ経由で次回 Claude に添削してもらう。 */

import { state, record, addAttempt, itemById, inRange, attemptsForPack } from '../store.js';
import { esc, sayBtn, lvBadge, showItem, toast } from './common.js';

let idx = 0;
let drafts = {};   // 書きかけ（タブ移動しても消えないように）

export default async function writeScreen(view) {
  if (!state.pack) { view.innerHTML = '<div class="empty">パックを取り込んでください</div>'; return; }
  const list = state.pack.questions
    .filter((q) => q.type === 'write' && inRange(q.level))
    .sort((a, b) => a.level - b.level);
  if (!list.length) { view.innerHTML = '<div class="empty">出題範囲内に英作文の問題がありません</div>'; return; }
  if (idx >= list.length) idx = 0;

  const q = list[idx];
  const item = itemById(q.itemId);
  const p = state.progress.get(q.id);
  const past = (await attemptsForPack(state.pack.id)).filter((a) => a.qid === q.id);
  const selfLabel = { right: '◯', close: '△', wrong: '✕' };

  view.innerHTML = `
    <div class="quiz-top">
      <button class="btn small ghost" data-prev ${idx === 0 ? 'disabled' : ''}>←</button>
      <span>${idx + 1} / ${list.length}</span>
      ${lvBadge(q.level)}
      ${p ? `<span class="tiny">記録 ${past.map((a) => selfLabel[a.self] || '').join('')}</span>` : ''}
      <button class="btn small ghost" data-next ${idx === list.length - 1 ? 'disabled' : ''}>→</button>
    </div>
    <div class="card question">
      <div class="prompt">次の日本語を英語にしましょう</div>
      <div class="q-ja">${esc(q.ja)}</div>
      ${q.hint ? `<div class="hint">ヒント：${esc(q.hint)}</div>` : ''}
      <textarea rows="4" autocapitalize="sentences" spellcheck="false"
        placeholder="英文を入力">${esc(drafts[q.id] || '')}</textarea>
      <button class="btn primary" data-check>答え合わせ</button>
      <div class="feedback" hidden></div>
    </div>`;

  const ta = view.querySelector('textarea');
  ta.oninput = () => { drafts[q.id] = ta.value; };
  view.querySelector('[data-prev]').onclick = () => { idx--; writeScreen(view); };
  view.querySelector('[data-next]').onclick = () => { idx++; writeScreen(view); };

  view.querySelector('[data-check]').onclick = () => {
    const text = ta.value.trim();
    if (!text) { toast('英文を入力してください'); return; }
    const kws = (q.keywords || []).map((k) => ({ ...k, hit: new RegExp(k.re, 'i').test(text) }));
    const fb = view.querySelector('.feedback');
    fb.hidden = false;
    fb.innerHTML = `
      ${kws.length ? `<h4>キーワード</h4><div class="chips">${kws.map((k) =>
        `<span class="chip ${k.hit ? 'hit' : 'miss'}">${k.hit ? '✓' : '✗'} ${esc(k.label)}</span>`).join('')}</div>` : ''}
      <h4>模範解答</h4>
      <ul class="models">${q.models.map((m) => `<li>${esc(m)} ${sayBtn(m)}</li>`).join('')}</ul>
      ${q.explain ? `<div class="explain">${esc(q.explain)}</div>` : ''}
      <h4>自己評価（答案は保存され、次回の添削に使います）</h4>
      <div class="row self">
        <button class="btn" data-self="right">◯ できた</button>
        <button class="btn" data-self="close">△ 惜しい</button>
        <button class="btn" data-self="wrong">✕ まだ</button>
      </div>
      <button class="btn small" data-card>表現カード：${esc(item.expr)}</button>`;
    fb.querySelector('[data-card]').onclick = () => showItem(item);
    fb.querySelectorAll('[data-self]').forEach((b) => {
      b.onclick = async () => {
        await record(q, b.dataset.self);
        await addAttempt(q, text, b.dataset.self);
        delete drafts[q.id];
        toast('記録しました');
        if (idx < list.length - 1) idx++;
        writeScreen(view);
      };
    });
    fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
}
