/* ホーム：パック情報、出題レベル、進み具合、取り込み・書き出し、設定。 */

import {
  state, LEVELS, QTYPES, levelStats, dueCount, saveSettings, selectPack, validatePack,
  importPack, deletePack, attemptsForPack, allProgress, allAttempts, itemById
} from '../store.js';
import { dbBulkPut, dbPut } from '../db.js';
import { esc, toast, shareOrDownload, today, lvBadge } from './common.js';
import { go } from './router.js';

export default function homeScreen(view) {
  const p = state.pack;
  view.innerHTML = p ? packHtml(p) : welcomeHtml();
  bind(view);
}

function welcomeHtml() {
  return `<div class="card">
    <h2>はじめに</h2>
    <p>ニュース記事1本を「テーマ」として、文の中で表現・品詞・使う場面をまとめて覚えるアプリです。</p>
    <ol class="steps">
      <li>Claude に記事のURLを渡して「テーマパック」（.json）を作ってもらう</li>
      <li>このアプリで取り込む（下のボタン）</li>
      <li>オフラインでやり込む → 終わったら学習ログを書き出して次のテーマへ</li>
    </ol>
    ${importButton()}
  </div>`;
}

function importButton() {
  return `<label class="btn primary file-btn">テーマパック／バックアップを取り込む
    <input type="file" accept=".json,application/json" data-import hidden></label>`;
}

function packHtml(p) {
  const st = levelStats();
  const due = dueCount();
  const s = state.settings;
  const lvOpts = (sel) => Object.entries(LEVELS).map(([k, v]) =>
    `<option value="${k}"${+k === sel ? ' selected' : ''}>${v.label}（${v.range}）</option>`).join('');
  const inRangeQ = p.questions.filter((q) => q.level >= s.levelMin && q.level <= s.levelMax);

  const bars = Object.entries(LEVELS).map(([lv, v]) => {
    const x = st[lv];
    if (!x.total) return '';
    const pct = Math.round((x.mastered / x.total) * 100);
    const seen = Math.round((x.seen / x.total) * 100);
    const off = lv < s.levelMin || lv > s.levelMax;
    return `<div class="bar-row${off ? ' off' : ''}">
      ${lvBadge(lv)}<span class="bar-range">${v.range}</span>
      <div class="bar"><div class="bar-seen" style="width:${seen}%"></div><div class="bar-fill" style="width:${pct}%"></div></div>
      <span class="bar-num">${x.mastered}/${x.total}</span>
    </div>`;
  }).join('');

  const others = state.packs.filter((x) => x.id !== p.id).map((x) =>
    `<button class="btn small" data-switch="${esc(x.id)}">${esc(x.title)}</button>`).join('');

  const typeChecks = Object.entries(QTYPES).filter(([k]) => k !== 'write').map(([k, v]) =>
    `<label class="check"><input type="checkbox" data-qtype="${k}"${s.quizTypes.includes(k) ? ' checked' : ''}>${v}</label>`).join('');

  return `
  <div class="card pack-card">
    <div class="pack-title">${esc(p.title)}</div>
    ${p.titleJa ? `<div class="pack-sub">${esc(p.titleJa)}</div>` : ''}
    <div class="pack-meta">${esc(p.source?.name || '')} ${esc(p.source?.date || '')}
      ・表現 ${p.items.length} ・問題 ${p.questions.length}</div>
    ${p.source?.note ? `<div class="tiny">${esc(p.source.note)}</div>` : ''}
  </div>

  <div class="card">
    <h3>今日の学習</h3>
    <p>${due ? `復習期限の問題が <b>${due}</b> 問あります。` : '復習期限の問題はありません。新しい問題に進みましょう。'}</p>
    <div class="row">
      <button class="btn primary" data-go="quiz">クイズを始める</button>
      <button class="btn" data-go="article">記事を読む</button>
    </div>
  </div>

  <div class="card">
    <h3>出題レベル</h3>
    <div class="row">
      <select data-lv="min">${lvOpts(s.levelMin)}</select>
      <span>〜</span>
      <select data-lv="max">${lvOpts(s.levelMax)}</select>
    </div>
    <p class="tiny">範囲内の問題：${inRangeQ.length} 問（英作文 ${inRangeQ.filter((q) => q.type === 'write').length} 問を含む）</p>
    <h4>定着度（濃い色＝定着、薄い色＝挑戦済み）</h4>
    ${bars}
  </div>

  <div class="card">
    <h3>テーマの仕上げ</h3>
    <p class="tiny">テーマを終えたら学習ログを書き出し、Claude に渡してください。間違えた表現と英作文の答案をもとに、添削と次のテーマパック（苦手表現の復習つき）を作ります。</p>
    <button class="btn primary" data-export-log>学習ログを書き出す</button>
  </div>

  <div class="card">
    <h3>パックとバックアップ</h3>
    ${others ? `<p class="tiny">ほかのパックに切り替え：</p><div class="row wrap">${others}</div>` : ''}
    <div class="row wrap">
      ${importButton()}
      <button class="btn" data-backup>全データをバックアップ</button>
    </div>
    <button class="btn danger small" data-delete>このパックを削除</button>
  </div>

  <div class="card">
    <h3>設定</h3>
    <label class="field">1回のクイズの問題数
      <select data-count>${[5, 10, 15, 20, 30].map((n) =>
        `<option${n === s.quizCount ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="field">読み上げの速さ
      <input type="range" min="0.6" max="1.2" step="0.1" value="${s.ttsRate}" data-rate>
      <span data-rate-label>${s.ttsRate}</span></label>
    <h4>クイズに出す形式</h4>
    <div class="checks">${typeChecks}</div>
  </div>`;
}

function bind(view) {
  view.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => go(b.dataset.go); });

  view.querySelectorAll('[data-import]').forEach((inp) => {
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      inp.value = '';
      if (f) await importFile(f);
    };
  });

  view.querySelectorAll('[data-lv]').forEach((sel) => {
    sel.onchange = async () => {
      const v = +sel.value;
      if (sel.dataset.lv === 'min') {
        state.settings.levelMin = v;
        if (state.settings.levelMax < v) state.settings.levelMax = v;
      } else {
        state.settings.levelMax = v;
        if (state.settings.levelMin > v) state.settings.levelMin = v;
      }
      await saveSettings();
      go('home');
    };
  });

  view.querySelectorAll('[data-switch]').forEach((b) => {
    b.onclick = async () => { await selectPack(b.dataset.switch); go('home'); };
  });

  const q = (sel) => view.querySelector(sel);
  if (q('[data-export-log]')) q('[data-export-log]').onclick = exportLog;
  if (q('[data-backup]')) q('[data-backup]').onclick = exportBackup;
  if (q('[data-delete]')) {
    q('[data-delete]').onclick = async () => {
      if (!confirm(`「${state.pack.title}」と、その学習記録を削除します。よろしいですか？`)) return;
      await deletePack(state.pack.id);
      toast('削除しました');
      go('home');
    };
  }
  if (q('[data-count]')) {
    q('[data-count]').onchange = async (e) => { state.settings.quizCount = +e.target.value; await saveSettings(); };
  }
  if (q('[data-rate]')) {
    q('[data-rate]').oninput = (e) => { q('[data-rate-label]').textContent = e.target.value; };
    q('[data-rate]').onchange = async (e) => { state.settings.ttsRate = +e.target.value; await saveSettings(); };
  }
  view.querySelectorAll('[data-qtype]').forEach((c) => {
    c.onchange = async () => {
      const on = [...view.querySelectorAll('[data-qtype]:checked')].map((x) => x.dataset.qtype);
      if (!on.length) { c.checked = true; toast('1つ以上選んでください'); return; }
      state.settings.quizTypes = on;
      await saveSettings();
    };
  });
}

/* ---------------- 取り込み ---------------- */

async function importFile(f) {
  let obj;
  try {
    obj = JSON.parse(await f.text());
  } catch {
    toast('JSON として読めませんでした', { danger: true });
    return;
  }
  if (obj && obj.kind === 'te-backup') return restoreBackup(obj);

  const errs = validatePack(obj);
  if (errs.length) {
    alert(`取り込めません：\n${errs.slice(0, 8).join('\n')}`);
    return;
  }
  const { replaced } = await importPack(obj);
  toast(replaced ? 'パックを更新しました（学習記録は維持）' : 'パックを取り込みました');
  go('home');
}

/* ---------------- 学習ログ（次のテーマ作成用） ---------------- */

async function exportLog() {
  const p = state.pack;
  const attempts = await attemptsForPack(p.id);
  const qs = p.questions.map((q) => {
    const pr = state.progress.get(q.id);
    return {
      qid: q.id, itemId: q.itemId, type: q.type, level: q.level,
      box: pr ? pr.box : null, right: pr ? pr.right : 0, wrong: pr ? pr.wrong : 0
    };
  });

  // 表現ごとに誤答を集計し、苦手な順に並べる
  const byItem = new Map();
  for (const x of qs) {
    const it = byItem.get(x.itemId) || { itemId: x.itemId, wrong: 0, right: 0, unseen: 0 };
    it.wrong += x.wrong;
    it.right += x.right;
    if (x.box === null) it.unseen++;
    byItem.set(x.itemId, it);
  }
  const weakItems = [...byItem.values()]
    .filter((x) => x.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong)
    .map((x) => ({ ...x, expr: itemById(x.itemId)?.expr, level: itemById(x.itemId)?.level }));

  const writes = attempts.map((a) => {
    const q = p.questions.find((x) => x.id === a.qid);
    return { qid: a.qid, ja: q?.ja, answer: a.answer, self: a.self, at: a.at };
  });

  const log = {
    kind: 'te-study-log',
    version: 1,
    exportedAt: new Date().toISOString(),
    pack: { id: p.id, title: p.title },
    levelRange: [state.settings.levelMin, state.settings.levelMax],
    levelStats: levelStats(),
    weakItems,
    writes,
    questions: qs
  };
  await shareOrDownload(log, `studylog-${p.id}-${today()}.json`);
}

/* ---------------- バックアップ ---------------- */

async function exportBackup() {
  const data = {
    kind: 'te-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    packs: state.packs,
    progress: await allProgress(),
    attempts: await allAttempts()
  };
  await shareOrDownload(data, `theme-english-backup-${today()}.json`);
}

async function restoreBackup(b) {
  if (!confirm(`バックアップ（${(b.exportedAt || '').slice(0, 10)}）を取り込みます。同じパックの記録は上書きされます。`)) return;
  await dbBulkPut('packs', b.packs || []);
  await dbBulkPut('progress', b.progress || []);
  await dbBulkPut('attempts', (b.attempts || []).map(({ id, ...rest }) => rest));
  if (b.settings) await dbPut('kv', b.settings, 'settings');
  location.reload();
}
