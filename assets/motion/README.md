# MOTION の素材置き場

`motion/` ページ (高速カット + モーショングラフィックス) で使う写真・動画・曲をここに置く。
今はサンプルとして Wikimedia Commons の CC0 / パブリックドメインの写真 14 枚を直接読み込んでいる (出典は `CREDITS.md`)。
写真が1枚も読み込めなかったときは、`motion/scenes.js` にコードで描いた仮の風景で代わりに動く。

## 差し替え方

1. 画像や動画をこのフォルダに入れる
2. `motion/config.js` の `media` に1行ずつ書く

```js
media: [
  { type: "image", src: "../assets/motion/shibuya.jpg", label: "city" },
  { type: "video", src: "../assets/motion/forest.mp4",  label: "forest" },
],
```

- `label` は画面中央にときどき小さく出る英語 (空にすれば出ない)
- 最初と最後のひし形の下に出る名前は `name` で変えられる
- 画像は画面いっぱいに切り抜かれて、カットごとにゆっくりズーム/パンする
- 動画は音なしでループ再生され、そのままカットの素材になる

## 曲を付ける

```js
music: { src: "../assets/motion/track.mp3", offset: 0.12 },
bpm: 128,
```

- `offset` は曲の頭から1拍目までの秒数。カットの切り替えがこの拍に揃う
- `music` が `null` の間は、内蔵の簡単なビート (WebAudio で合成) が鳴る

## 素材の目安

- 画像: 長辺 1600〜2000px、JPEG で 300KB 前後まで (枚数が多いと読み込みが遅くなる)
- 動画: 720p、数秒のループ、音声なし、MP4 (H.264) で 1〜3MB 程度
- GitHub Pages は1ファイル 100MB 制限、リポジトリ全体も 1GB 程度に収めるのが無難
