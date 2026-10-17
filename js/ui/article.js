/* 記事：原文（またはやさしい英語版）を段落ごとに表示。
   学習対象の表現に色を付け、タップで表現カードを開く。 */

import { state, itemById } from '../store.js';
import { esc, sayBtn, showItem } from './common.js';

let mode = 'original';   // 'original' | 'simple'
let showJa = false;

export default function articleScreen(view) {
  const p = state.pack;
  if (!p) { view.innerHTML = '<div class="empty">パックを取り込んでください</div>'; return; }

  const hasSimple = Array.isArray(p.simple) && p.simple.length;
  if (!hasSimple) mode = 'original';
  const paras = mode === 'simple' ? p.simple : p.article;

  view.innerHTML = `
    <div class="toolbar">
      ${hasSimple ? `<div class="seg">
        <button data-mode="original" class="${mode === 'original' ? 'on' : ''}">原文</button>
        <button data-mode="simple" class="${mode === 'simple' ? 'on' : ''}">やさしい英語</button>
      </div>` : ''}
      <label class="check"><input type="checkbox" data-ja${showJa ? ' checked' : ''}>和訳</label>
      ${sayBtn(paras.map((x) => x.en).join(' '))}
    </div>
    ${mode === 'original'
      ? '<p class="tiny">色付きの語句をタップすると、品詞・場面・例文のカードが開きます。色はレベル（L1〜L4）です。</p>'
      : '<p class="tiny">TOEIC 350〜500 向けに書き直した要約です。まずこちらで内容をつかみ、原文に進みましょう。</p>'}
    ${paras.map((x) => `<div class="para">
        <div class="para-en">${mode === 'original' ? markup(x.en) : esc(x.en)} ${sayBtn(x.en)}</div>
        <div class="para-ja"${showJa ? '' : ' hidden'}>${esc(x.ja)}</div>
      </div>`).join('')}
    ${p.source?.url && mode === 'original'
      ? `<p class="tiny">出典：<a href="${esc(p.source.url)}" target="_blank" rel="noopener">${esc(p.source.name)}</a></p>` : ''}
  `;

  view.querySelectorAll('[data-mode]').forEach((b) => {
    b.onclick = () => { mode = b.dataset.mode; articleScreen(view); };
  });
  view.querySelector('[data-ja]').onchange = (e) => {
    showJa = e.target.checked;
    view.querySelectorAll('.para-ja').forEach((el) => { el.hidden = !showJa; });
  };
  view.querySelectorAll('mark[data-item]').forEach((m) => {
    m.onclick = () => showItem(itemById(m.dataset.item));
  });
}

/** 段落中の表現に <mark> を付ける。重なったときは長い方を優先する */
function markup(text) {
  const hits = [];
  for (const it of state.pack.items) {
    for (const m of it.match || []) {
      let from = 0;
      for (;;) {
        const i = text.indexOf(m, from);
        if (i < 0) break;
        // 単語の途中（"sent" が "present" の中にある等）は除外
        const before = text[i - 1];
        const after = text[i + m.length];
        if (!(before && /\w/.test(before)) && !(after && /\w/.test(after))) {
          hits.push({ start: i, end: i + m.length, item: it });
        }
        from = i + m.length;
      }
    }
  }
  hits.sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const taken = [];
  for (const h of hits) {
    if (!taken.some((t) => h.start < t.end && t.start < h.end)) taken.push(h);
  }
  taken.sort((a, b) => a.start - b.start);

  let out = '';
  let pos = 0;
  for (const h of taken) {
    out += esc(text.slice(pos, h.start));
    out += `<mark class="lvm${h.item.level}" data-item="${esc(h.item.id)}">${esc(text.slice(h.start, h.end))}</mark>`;
    pos = h.end;
  }
  return out + esc(text.slice(pos));
}
