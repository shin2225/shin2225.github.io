// ===== MOTION ページの設定 =====
// 素材を集めたらここを書き換えるだけで差し替わる。
// 詳しくは assets/motion/README.md を参照。
window.MOTION_CONFIG = {
  // テンポ。カットの切り替えはこの拍に合わせて行う
  bpm: 124,

  // 曲ファイル。null の間は内蔵の簡単なビート(WebAudioで合成)が鳴る
  // 例: { src: "../assets/motion/track.mp3", offset: 0.12 }
  //   offset = 曲の頭から1拍目までの秒数
  music: null,

  // 実素材 (画像 / 動画)。label は英語のキャプション、ja は大きく出す文字
  media: [
    // { type: "image", src: "../assets/motion/shibuya.jpg", label: "CITY",   ja: "街" },
    // { type: "image", src: "../assets/motion/sea.jpg",     label: "SEA",    ja: "海" },
    // { type: "video", src: "../assets/motion/forest.mp4",  label: "FOREST", ja: "森" },
  ],

  // 仮素材 (コードで描いた風景) も混ぜるか。
  // media が空のときは、この値に関係なく仮素材だけで動く
  useProcedural: true,

  // 画面に出す文字
  title: "MOTION 01",
  subtitle: "nature & city — fast cuts",
};
