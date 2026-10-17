/* クイズ：復習期限の問題 → 未挑戦の問題（やさしい順）の順に出題する。
   間違えた問題はそのセッションの最後にもう一度出す。 */

import { state, QTYPES, record, itemById, inRange } from '../store.js';
import { isDue } from '../srs.js';
import { esc, shuffle, sayBtn, lvBadge, showItem } from './common.js';
import { go } from './router.js';
import { speak } from '../tts.js';

let session = null;

export default function quizScreen(view) {
  if (!state.pack) { view.innerHTML = '<div class="empty">パックを取り込んでください</div>'; return; }
  if (session && session.pack === state.pack.id && !session.done) return renderQuestion(view);
  renderStart(view);
}

/* ---------------- 出題の組み立て ---------------- */

function buildQueue() {
  const s = state.settings;
  const now = Date.now();
  const pool = state.pack.questions.filter((q) =>
    q.type !== 'write' && s.quizTypes.includes(q.type) && inRange(q.level));
  const prog = (q) => state.progress.get(q.id);

  const due = pool.filter((q) => isDue(prog(q), now)).sort((a, b) => prog(a).due - prog(b).due);
  const fresh = pool.filter((q) => !prog(q)).sort((a, b) => a.level - b.level);
  const later = pool.filter((q) => prog(q) && !isDue(prog(q), now)).sort((a, b) => prog(a).due - prog(b).due);

  const picked = [...due, ...fresh, ...later].slice(0, s.quizCount);
  return spreadItems(picked);
}

/** 同じ表現の問題が連続しないように並べ替える */
function spreadItems(qs) {
  const out = [];
  const rest = qs.slice();
  while (rest.length) {
    const last = out[out.length - 1];
    const i = rest.findIndex((q) => !last || q.itemId !== last.itemId);
    out.push(rest.splice(i < 0 ? 0 : i, 1)[0]);
  }
  return out;
}

function renderStart(view) {
  const queue = buildQueue();
  const now = Date.now();
  const nDue = queue.filter((q) => isDue(state.progress.get(q.id), now)).length;
  const nNew = queue.filter((q) => !state.progress.get(q.id)).length;
  view.innerHTML = `<div class="card">
    <h2>クイズ</h2>
    ${queue.length ? `<p>${queue.length} 問（復習 ${nDue}・新規 ${nNew}・おさらい ${queue.length - nDue - nNew}）</p>
      <button class="btn primary big" data-start>スタート</button>`
      : '<p>出題できる問題がありません。ホームで出題レベルや形式を見直してください。</p>'}
    <p class="tiny">出題レベル・形式・問題数はホームで変えられます。</p>
  </div>`;
  const b = view.querySelector('[data-start]');
  if (b) {
    b.onclick = () => {
      session = { pack: state.pack.id, queue, i: 0, first: new Map(), retried: new Set(), done: false };
      renderQuestion(view);
    };
  }
}

/* ---------------- 1問 ---------------- */

function renderQuestion(view) {
  const q = session.queue[session.i];
  if (!q) return renderSummary(view);
  const item = itemById(q.itemId);
  const retry = session.retried.has(q.id) && session.first.has(q.id);

  view.innerHTML = `
    <div class="quiz-top">
      <span>${session.i + 1} / ${session.queue.length}</span>
      ${lvBadge(q.level)}<span class="qtype">${QTYPES[q.type]}</span>
      ${retry ? '<span class="chip review">再挑戦</span>' : ''}
      <button class="btn small ghost" data-quit>終了</button>
    </div>
    <div class="card question">
      <div class="prompt">${esc(q.prompt || defaultPrompt(q))}</div>
      ${q.text ? `<div class="q-text">${blank(q.text)}</div>` : ''}
      <div class="answer-area"></div>
      <div class="feedback" hidden></div>
    </div>`;

  view.querySelector('[data-quit]').onclick = () => { session.done = true; renderSummary(view); };
  const area = view.querySelector('.answer-area');
  if (q.type === 'order') renderOrder(view, area, q, item);
  else renderChoices(view, area, q, item);
}

const defaultPrompt = (q) => ({
  cloze: '空欄に入る最も適切な語句は？',
  form: '空欄に入る正しい形は？',
  meaning: '下線部の意味に最も近いのは？',
  scene: 'この英文が最も自然に使われる場面は？',
  fix: '正しい（自然な）英文はどれ？',
  order: '語句を並べ替えて英文を完成させましょう'
}[q.type]);

/** "___" を空欄、[[...]] を下線として表示する */
function blank(t) {
  return esc(t)
    .replace(/___/g, '<span class="blank">　　　</span>')
    .replace(/\[\[(.+?)\]\]/g, '<u>$1</u>');
}

function fullSentence(q) {
  if (q.full) return q.full;
  if (q.type === 'fix') return q.choices[q.answer];
  if (q.type === 'order') return q.tokens.join(' ').replace(/ ([.,!?;:])/g, '$1');
  if (q.text && q.text.includes('___')) return q.text.replace('___', q.choices[q.answer]);
  if (q.text) return q.text.replace(/\[\[|\]\]/g, '');
  return null;
}

function renderChoices(view, area, q, item) {
  const order = shuffle(q.choices.map((c, i) => i));
  area.innerHTML = `<div class="choices">${order.map((i) =>
    `<button class="choice" data-i="${i}">${esc(q.choices[i])}</button>`).join('')}</div>`;
  area.querySelectorAll('.choice').forEach((b) => {
    b.onclick = async () => {
      const ok = +b.dataset.i === q.answer;
      area.querySelectorAll('.choice').forEach((x) => {
        x.disabled = true;
        if (+x.dataset.i === q.answer) x.classList.add('right');
      });
      if (!ok) b.classList.add('wrong');
      await finish(view, q, item, ok);
    };
  });
}

function renderOrder(view, area, q, item) {
  let pool = shuffle(q.tokens.map((t, i) => ({ t, i })));
  if (pool.map((x) => x.t).join(' ') === q.tokens.join(' ')) pool = pool.reverse();
  const line = [];

  const draw = () => {
    area.innerHTML = `
      <div class="order-line">${line.map((x, k) => `<button class="tok on" data-k="${k}">${esc(x.t)}</button>`).join('') || '<span class="tiny">下の語句をタップ</span>'}</div>
      <div class="order-pool">${pool.map((x, k) => `<button class="tok" data-p="${k}">${esc(x.t)}</button>`).join('')}</div>
      <button class="btn primary" data-check ${pool.length ? 'disabled' : ''}>答え合わせ</button>`;
    area.querySelectorAll('[data-p]').forEach((b) => {
      b.onclick = () => { line.push(pool.splice(+b.dataset.p, 1)[0]); draw(); };
    });
    area.querySelectorAll('[data-k]').forEach((b) => {
      b.onclick = () => { pool.push(line.splice(+b.dataset.k, 1)[0]); draw(); };
    });
    area.querySelector('[data-check]').onclick = async () => {
      const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
      const mine = norm(line.map((x) => x.t).join(' '));
      const ok = [q.tokens.join(' '), ...(q.alts || [])].some((a) => norm(a) === mine);
      area.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      area.querySelector('.order-line').classList.add(ok ? 'right' : 'wrong');
      await finish(view, q, item, ok);
    };
  };
  draw();
}

async function finish(view, q, item, ok) {
  if (!session.first.has(q.id)) session.first.set(q.id, ok);
  await record(q, ok ? 'right' : 'wrong');
  if (!ok && !session.retried.has(q.id)) {
    session.retried.add(q.id);
    session.queue.push(q);
  }

  const full = fullSentence(q);
  const fb = view.querySelector('.feedback');
  fb.hidden = false;
  fb.innerHTML = `
    <div class="verdict ${ok ? 'ok' : 'ng'}">${ok ? '◯ 正解' : '✕ 不正解'}</div>
    ${full ? `<div class="full">${esc(full)} ${sayBtn(full)}</div>` : ''}
    ${q.ja ? `<div class="ex-ja">${esc(q.ja)}</div>` : ''}
    ${q.explain ? `<div class="explain">${esc(q.explain)}</div>` : ''}
    <div class="row">
      <button class="btn" data-card>表現カード：${esc(item.expr)}</button>
      <button class="btn primary" data-next>次へ</button>
    </div>`;
  if (full) speak(full, state.settings.ttsRate);
  fb.querySelector('[data-card]').onclick = () => showItem(item);
  fb.querySelector('[data-next]').onclick = () => { session.i++; renderQuestion(view); };
  fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------------- まとめ ---------------- */

function renderSummary(view) {
  session.done = true;
  const answered = [...session.first.entries()];
  const right = answered.filter(([, ok]) => ok).length;
  const missed = answered.filter(([, ok]) => !ok)
    .map(([qid]) => state.pack.questions.find((x) => x.id === qid));
  const missedItems = [...new Map(missed.map((q) => [q.itemId, itemById(q.itemId)])).values()];

  view.innerHTML = `<div class="card">
    <h2>おつかれさまでした</h2>
    <p class="score">${right} / ${answered.length} 問 正解</p>
    ${missedItems.length ? `<h4>見直したい表現</h4>
      <div class="chips">${missedItems.map((it) =>
        `<button class="chip btnchip" data-item="${esc(it.id)}">${esc(it.expr)}</button>`).join('')}</div>` : ''}
    <div class="row">
      <button class="btn primary" data-again>続けてもう1セット</button>
      <button class="btn" data-home>ホーム</button>
    </div>
  </div>`;
  view.querySelectorAll('[data-item]').forEach((b) => { b.onclick = () => showItem(itemById(b.dataset.item)); });
  view.querySelector('[data-again]').onclick = () => { session = null; renderStart(view); };
  view.querySelector('[data-home]').onclick = () => { session = null; go('home'); };
}
