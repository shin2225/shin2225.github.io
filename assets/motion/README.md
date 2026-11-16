# MOTION の素材置き場

`motion/` ページ (高速カット + モーショングラフィックス) で使う写真・動画・曲をここに置く。
今は素材がないので、`motion/scenes.js` にコードで描いた仮の風景 12 種類 (山・海・森・街・夜・光・星・雨・雪・空・花・道) が流れている。

## 差し替え方

1. 画像や動画をこのフォルダに入れる
2. `motion/config.js` の `media` に1行ずつ書く

```js
media: [
  { type: "image", src: "../assets/motion/shibuya.jpg", label: "CITY",   ja: "街" },
  { type: "video", src: "../assets/motion/forest.mp4",  label: "FOREST", ja: "森" },
],
useProcedural: false,   // 仮素材を混ぜないなら false
```

- `label` は小さい英字のキャプション、`ja` は大きく出る1文字
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
