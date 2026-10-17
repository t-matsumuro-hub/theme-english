# テーマ英語（PWA）

ニュース記事1本を「テーマ」としてやり込む英語学習アプリ。単語単体ではなく、記事の文の中で
表現・品詞・使用場面をセットで覚える。学習中は完全オフライン。

## 運用サイクル

1. 記事URLを Claude に渡し、テーマパック（`packs/*.json`）を生成してもらう
2. パックをスマホに送り（iCloud Drive / LINE / AirDrop）、アプリのホーム →「取り込む」
3. オフラインで学習（記事・表現カード・クイズ・英作文、間隔反復で復習）
4. 終えたらホーム →「学習ログを書き出す」→ ログを Claude に渡す
   → 英作文の添削と、苦手表現の復習を混ぜた次のテーマパックを生成

## レベル

| Lv | TOEIC目安 |
|----|-----------|
| L1 | 350–500 |
| L2 | 500–650 |
| L3 | 650–800 |
| L4 | 800–990 |

表現（items）と問題（questions）それぞれにレベルを付ける。ホームで出題範囲を絞れる。
記事の「やさしい英語」版（`simple`）は L1 向けの書き直し。

## テーマパックの形式（schema 1）

```jsonc
{
  "kind": "theme-pack", "schema": 1, "id": "2026-10-17-xxx",
  "title": "...", "titleJa": "...",
  "source": { "name": "...", "url": "...", "date": "YYYY-MM-DD", "note": "..." },
  "article": [{ "en": "...", "ja": "..." }],        // 原文（段落）
  "simple":  [{ "en": "...", "ja": "..." }],        // やさしい英語版（任意）
  "items": [{
    "id": "i01", "level": 1, "expr": "...", "pos": "動詞", "meaning": "...",
    "register": "...", "source": "記事中の文", "note": "...",
    "match": ["記事中でハイライトする文字列"],
    "forms": [{ "word": "...", "pos": "...", "ja": "..." }],
    "examples": [{ "scene": "ビジネス", "en": "...", "ja": "..." }],
    "collocations": ["..."], "paraphrase": "...", "pitfall": "...",
    "review": true                                   // 前テーマからの復習表現（任意）
  }],
  "questions": [
    // 選択式: cloze / form / meaning / scene / fix
    { "id": "q01a", "itemId": "i01", "type": "cloze", "level": 1,
      "prompt": "(任意)", "text": "___ が空欄、[[...]] が下線", "ja": "(任意)",
      "choices": ["正解", "..."], "answer": 0, "explain": "..." },
    // 並べ替え
    { "id": "...", "type": "order", "tokens": ["I", "used", "to", "..."], "alts": ["別解"] },
    // 英作文（自己採点）
    { "id": "...", "type": "write", "ja": "...", "hint": "...",
      "keywords": [{ "label": "have sent", "re": "正規表現" }], "models": ["模範解答"] }
  ]
}
```

選択肢は表示時にシャッフルされるので、正解を先頭に書いてよい。
パックの `id` が同じなら上書き取り込みになり、学習記録は維持される。

## 著作権

`packs/` には記事本文が入るため **Git 管理外**（`.gitignore`）。アプリ本体だけを公開し、
パックは個人の端末に直接送ること。

## 開発

```
python tools/devserver.py        # http://127.0.0.1:8766/
```

- `?nosw=1` で Service Worker とキャッシュを解除して最新を読む
- `?pack=packs/xxx.json` で同じサーバー上のパックを自動取り込み（開発用）
- 公開後にコードを変えたら `sw.js` の `VERSION` を上げる（上げないと端末が古いキャッシュを使い続ける）
- アイコン再生成：`python tools/make_icons.py`
