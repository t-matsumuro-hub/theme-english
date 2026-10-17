/* 起動処理。 */

import { loadAll, state } from './store.js';
import { requestPersistence } from './db.js';
import { registerScreens, go } from './ui/router.js';
import { toast } from './ui/common.js';
import { speak } from './tts.js';

import homeScreen from './ui/home.js';
import articleScreen from './ui/article.js';
import itemsScreen from './ui/items.js';
import quizScreen from './ui/quiz.js';
import writeScreen from './ui/write.js';

async function boot() {
  try {
    await loadAll();
  } catch (err) {
    document.getElementById('view').innerHTML =
      `<div class="empty">データベースを開けませんでした。<br>
       プライベートブラウズを解除してお試しください。<br>
       <span class="tiny">${String(err && err.message || err)}</span></div>`;
    return;
  }

  registerScreens({
    home: homeScreen, article: articleScreen, items: itemsScreen, quiz: quizScreen, write: writeScreen
  });

  document.querySelectorAll('#tabs button').forEach((b) => { b.onclick = () => go(b.dataset.tab); });

  // 🔊 ボタンはどの画面でも同じ動き
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-say]');
    if (!b) return;
    e.stopPropagation();
    speak(b.dataset.say, state.settings.ttsRate);
  }, true);

  await devAutoload();
  go('home');
  if (state.packs.length) requestPersistence();
  registerSW();
}

/** 開発用：?pack=packs/xxx.json で同じサーバーのパックを読み込む */
async function devAutoload() {
  const path = new URLSearchParams(location.search).get('pack');
  if (!path || !/^packs\/[\w.-]+\.json$/.test(path)) return;
  const { validatePack, importPack } = await import('./store.js');
  try {
    const p = await (await fetch(path, { cache: 'no-store' })).json();
    const errs = validatePack(p);
    if (errs.length) { console.warn(errs); toast('パックに不備があります', { danger: true }); return; }
    await importPack(p);
  } catch (e) {
    console.warn(e);
  }
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  if (new URLSearchParams(location.search).has('nosw')) {
    navigator.serviceWorker.getRegistrations()
      .then((rs) => Promise.all(rs.map((r) => r.unregister())))
      .then(() => caches.keys())
      .then((ks) => Promise.all(ks.map((k) => caches.delete(k))))
      .catch(() => {});
    return;
  }
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'all' }).catch(() => {});
}

window.addEventListener('error', (e) => {
  console.error(e.error || e.message);
  toast('エラーが発生しました', { danger: true });
});
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  toast('処理に失敗しました', { danger: true });
});

boot();
