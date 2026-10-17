/* 画面共通の小物：エスケープ、トースト、下から出るシート、表現カード。 */

import { LEVELS, itemMastery } from '../store.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

let toastTimer = null;
export function toast(msg, { danger = false } = {}) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = danger ? 'danger' : '';
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

export function openSheet(html) {
  const s = document.getElementById('sheet');
  const b = document.getElementById('sheet-backdrop');
  s.innerHTML = `<button class="sheet-close" aria-label="閉じる">×</button>${html}`;
  s.hidden = false;
  b.hidden = false;
  s.scrollTop = 0;
  const close = () => { s.hidden = true; b.hidden = true; s.innerHTML = ''; };
  s.querySelector('.sheet-close').onclick = close;
  b.onclick = close;
  return { el: s, close };
}

/** 🔊 ボタン。押すと data-say の文を読み上げる（app.js で一括処理） */
export const sayBtn = (text) => `<button class="say" data-say="${esc(text)}" aria-label="読み上げ">🔊</button>`;

export const lvBadge = (lv) =>
  `<span class="lv lv${lv}" title="TOEIC ${LEVELS[lv].range}">${LEVELS[lv].label}</span>`;

export function masteryDot(itemId) {
  const m = itemMastery(itemId);
  if (m === null) return '';
  const pct = Math.round(m * 100);
  return `<span class="mastery" style="--m:${pct}%">${pct}%</span>`;
}

/** 表現カード（記事・表現一覧・クイズの解説から共通で使う） */
export function itemCard(item, { open = true } = {}) {
  const forms = (item.forms || []).map((f) =>
    `<tr><td class="en">${esc(f.word)}</td><td class="pos">${esc(f.pos)}</td><td>${esc(f.ja)}</td></tr>`).join('');
  const examples = (item.examples || []).map((x) =>
    `<li><span class="scene">${esc(x.scene)}</span>
      <div class="ex-en">${esc(x.en)} ${sayBtn(x.en)}</div>
      <div class="ex-ja">${esc(x.ja)}</div></li>`).join('');
  const colls = (item.collocations || []).map((c) => `<span class="chip">${esc(c)}</span>`).join('');

  return `<div class="card item-card${open ? ' open' : ''}">
    <div class="item-head">
      ${lvBadge(item.level)}
      <span class="expr">${esc(item.expr)}</span>
      <span class="pos-tag">${esc(item.pos)}</span>
      ${item.review ? '<span class="chip review">復習</span>' : ''}
      ${sayBtn(item.expr)}
    </div>
    <div class="meaning">${esc(item.meaning)}</div>
    ${item.register ? `<div class="register">文体: ${esc(item.register)}</div>` : ''}
    ${item.source ? `<blockquote class="src">${esc(item.source)} ${sayBtn(item.source)}</blockquote>` : ''}
    ${item.note ? `<p class="note">${esc(item.note)}</p>` : ''}
    ${forms ? `<h4>品詞・派生形</h4><table class="forms">${forms}</table>` : ''}
    ${examples ? `<h4>場面別の例文</h4><ul class="examples">${examples}</ul>` : ''}
    ${colls ? `<h4>よく一緒に使う語</h4><div class="chips">${colls}</div>` : ''}
    ${item.paraphrase ? `<h4>言い換え</h4><p>${esc(item.paraphrase)}</p>` : ''}
    ${item.pitfall ? `<div class="pitfall">⚠ ${esc(item.pitfall)}</div>` : ''}
  </div>`;
}

export function showItem(item) {
  if (item) openSheet(itemCard(item));
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** iOS では共有シート（ファイルに保存・AirDrop・LINE）を使い、無ければダウンロード */
export async function shareOrDownload(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const file = new File([blob], filename, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
    }
  }
  download(blob, filename);
  return true;
}

export const today = () => {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}`;
};
