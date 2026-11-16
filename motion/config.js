// ===== MOTION ページの設定 =====
// 素材を集めたらここを書き換えるだけで差し替わる。
// 詳しくは assets/motion/README.md を参照。
(() => {
  // Wikimedia Commons の画像 (1280px の縮小版) の URL を作る。
  // 今のサンプル写真はすべて CC0 またはパブリックドメイン (出典: assets/motion/CREDITS.md)
  const commons = (dir, file) =>
    `https://upload.wikimedia.org/wikipedia/commons/thumb/${dir}/${file}/1280px-${file}`;

  window.MOTION_CONFIG = {
    // テンポ。カットの切り替えはこの拍に合わせて行う
    bpm: 124,

    // 曲ファイル。null の間は内蔵の簡単なビート(WebAudioで合成)が鳴る
    // 例: { src: "../assets/motion/track.mp3", offset: 0.12 }
    //   offset = 曲の頭から1拍目までの秒数
    music: null,

    // 最初と最後に、ひし形の下に出す名前
    name: "shin2225",

    // 写真 / 動画。label は画面中央にときどき小さく出る英語
    // 自分の素材にするときは { type: "image", src: "../assets/motion/xxx.jpg", label: "CITY" } のように書く
    media: [
      // ---- 自然 ----
      { type: "image", label: "lake",     src: commons("6/65", "Mountains_reflect_in_lake_%28Unsplash%29.jpg") },
      { type: "image", label: "mountain", src: commons("f/fd", "The_Moraine_Lake_landscape_%28Unsplash%29.jpg") },
      { type: "image", label: "forest",   src: commons("c/ca", "Forest_mist_%28Unsplash%29.jpg") },
      { type: "image", label: "coast",    src: commons("3/3f", "Carmel_by_the_Sea_Coastline_%28Unsplash%29.jpg") },
      { type: "image", label: "sunrise",  src: commons("2/2b", "Sunrise_in_Greece_%28Unsplash%29.jpg") },
      { type: "image", label: "wave",     src: commons("4/4c", "Big_ocean_surf_wave_%28Unsplash%29.jpg") },
      { type: "image", label: "aurora",   src: commons("a/aa", "Polarlicht_2.jpg") },
      { type: "image", label: "stars",    src: commons("4/43", "Night_sky_from_Tony_Grove_Lake%2C_United_States.jpg") },
      { type: "image", label: "sky",      src: commons("a/a2", "A_Cloudy_Sunrise_%28Unsplash%29.jpg") },
      // ---- 街 ----
      { type: "image", label: "city",     src: commons("1/10", "New_York_City%2C_night.jpg") },
      { type: "image", label: "skyline",  src: commons("8/85", "Manhattan_in_the_distance_%28Unsplash%29.jpg") },
      { type: "image", label: "light",    src: commons("7/77", "Light_trails_at_the_intersection_%28Unsplash%29.jpg") },
      { type: "image", label: "street",   src: commons("2/20", "City_Structural_Patterns_%28Unsplash%29.jpg") },
      { type: "image", label: "fireworks", src: commons("2/20", "A_Firework_Bouquet_%28Unsplash%29.jpg") },
    ],

    // コードで描いた仮の風景も混ぜるか。
    // 写真が1枚も読み込めなかったときは、この値に関係なく仮の風景で動く
    useProcedural: false,
  };
})();
