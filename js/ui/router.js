/* タブ切り替えだけの簡単なルーター。 */

import { stopSpeaking } from '../tts.js';

const screens = {};
let current = null;

export function registerScreens(map) { Object.assign(screens, map); }

export function go(name, params = {}) {
  current = name;
  stopSpeaking();
  document.querySelectorAll('#tabs button').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === name));
  const view = document.getElementById('view');
  view.scrollTop = 0;
  window.scrollTo(0, 0);
  screens[name](view, params);
}

export const currentScreen = () => current;
