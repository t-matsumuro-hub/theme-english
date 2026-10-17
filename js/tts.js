/* 端末内蔵の読み上げ（オフラインでも動く）。 */

let voice = null;

function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voice = vs.find((v) => v.lang === 'en-US' && /Samantha|Google US|Aria|Jenny/i.test(v.name))
    || vs.find((v) => v.lang === 'en-US')
    || vs.find((v) => v.lang && v.lang.startsWith('en'))
    || null;
}

if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export const ttsSupported = () => 'speechSynthesis' in window;

export function speak(text, rate = 0.9) {
  if (!ttsSupported() || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  if (voice) u.voice = voice;
  u.rate = rate;
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (ttsSupported()) speechSynthesis.cancel();
}
