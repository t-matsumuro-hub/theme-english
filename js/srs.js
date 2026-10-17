/* 間隔反復（ライトナー方式）。
   正解で箱が1つ上がり、次の出題までの日数が延びる。不正解で箱0に戻る。
   英作文の自己評価「惜しい」は箱を据え置き、翌日もう一度出す。 */

const DAY = 864e5;
export const INTERVALS = [0, 1, 3, 7, 14, 30]; // 箱ごとの間隔（日）
export const MASTERED_BOX = 3;                  // 1日後・3日後と連続正解したら「定着」

function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** result: 'right' | 'close' | 'wrong' */
export function grade(prev, result, now = Date.now()) {
  const p = { box: 0, right: 0, wrong: 0, seen: 0, ...prev };
  p.seen++;
  if (result === 'right') {
    p.box = Math.min(p.box + 1, INTERVALS.length - 1);
    p.right++;
  } else if (result === 'close') {
    p.box = Math.max(1, Math.min(p.box, 2));
  } else {
    p.box = 0;
    p.wrong++;
    p.lastWrong = now;
  }
  // 当日中の再挑戦（箱0）以外は「その日の0時」に期限が来るようにする
  p.due = p.box === 0 ? now : startOfDay(now) + INTERVALS[p.box] * DAY;
  if (result === 'close') p.due = startOfDay(now) + DAY;
  p.last = now;
  return p;
}

export const isDue = (p, now = Date.now()) => !!p && p.due <= now;
export const isMastered = (p) => !!p && p.box >= MASTERED_BOX;
