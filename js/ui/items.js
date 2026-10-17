/* 表現一覧：レベルで絞り込み、タップでカードを展開。 */

import { state, LEVELS } from '../store.js';
import { esc, itemCard, lvBadge, masteryDot } from './common.js';

let filter = 0; // 0 = すべて

export default function itemsScreen(view) {
  const p = state.pack;
  if (!p) { view.innerHTML = '<div class="empty">パックを取り込んでください</div>'; return; }

  const items = p.items
    .filter((i) => !filter || i.level === filter)
    .slice()
    .sort((a, b) => a.level - b.level);

  view.innerHTML = `
    <div class="seg wide">
      <button data-f="0" class="${!filter ? 'on' : ''}">すべて</button>
      ${Object.entries(LEVELS).map(([k, v]) =>
        `<button data-f="${k}" class="${filter === +k ? 'on' : ''}">${v.label}</button>`).join('')}
    </div>
    <p class="tiny">${filter ? `TOEIC ${LEVELS[filter].range}：` : ''}${items.length} 表現。％は出題範囲内の問題の定着率です。</p>
    <ul class="item-list">
      ${items.map((i) => `<li data-id="${esc(i.id)}">
        <div class="item-row">${lvBadge(i.level)}<span class="expr">${esc(i.expr)}</span>
          <span class="pos-tag">${esc(i.pos)}</span>${masteryDot(i.id)}</div>
        <div class="item-mean">${esc(i.meaning)}</div>
        <div class="item-detail" hidden></div>
      </li>`).join('')}
    </ul>`;

  view.querySelectorAll('[data-f]').forEach((b) => {
    b.onclick = () => { filter = +b.dataset.f; itemsScreen(view); };
  });
  view.querySelectorAll('.item-row').forEach((row) => {
    row.onclick = () => {
      const li = row.parentElement;
      const d = li.querySelector('.item-detail');
      if (d.hidden) d.innerHTML = itemCard(p.items.find((x) => x.id === li.dataset.id));
      d.hidden = !d.hidden;
    };
  });
}
