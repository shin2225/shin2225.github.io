// ===== MOTION: 拍に合わせた高速カット + モーショングラフィックス =====
// 構成 (16小節でループ):
//   1-4小節   intro : 2拍ごとにカット、タイトル、上下に黒帯
//   5-12小節  main  : 1拍ごとにカット、大きな文字、拍ごとの輪
//   13-15小節 drop  : 半拍ごとにカット、グリッチ、図形、フラッシュ
//   16小節    outro : 1カットを長めに見せて暗転
(() => {
  "use strict";

  const CFG = Object.assign({
    bpm: 124, music: null, media: [], useProcedural: true,
    name: "shin2225",
  }, window.MOTION_CONFIG || {});

  const BEAT = 60 / CFG.bpm;
  const BARS = 16;
  const LOOP_BEATS = BARS * 4;
  const params = new URLSearchParams(location.search);
  const START_AT = Math.max(0, parseFloat(params.get("at")) || 0);   // ?at=48 で48拍目から (確認用)

  const FONT_SANS = "'Helvetica Neue', Arial, sans-serif";
  const FONT_HUD = "'DotGothic16', 'Courier New', monospace";

  // ---------- DOM ----------
  const cv = document.getElementById("stage");
  const ctx = cv.getContext("2d");
  const $ = id => document.getElementById(id);
  const startEl = $("start"), uiEl = $("ui");
  const btnPlay = $("play"), btnMuted = $("playMuted");
  const btnPause = $("btnPause"), btnSound = $("btnSound"), btnCalm = $("btnCalm"), btnFull = $("btnFull");

  let calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- 画面サイズ ----------
  let W = 0, H = 0, DPR = 1;
  const resize = () => {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    scheduleRebuild();
  };

  // ---------- 素材 ----------
  // sources: { kind: "proc"|"image"|"video", el, w, h, label, ja, def?, seed? }
  let sources = [];
  const procSources = [];
  const mediaSources = [];

  const sceneSize = () => {
    // 画面と同じ縦横比で、長い辺 1280px のオフスクリーンに描く
    const a = W / H;
    return a >= 1 ? [1280, Math.round(1280 / a)] : [Math.round(1280 * a), 1280];
  };

  const mulberry = seed => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  const buildProc = () => {
    if (!window.PROC_SCENES || !procSources.used) return;
    const [ow, oh] = sceneSize();
    const defs = Object.entries(window.PROC_SCENES);
    defs.forEach(([name, def], i) => {
      let s = procSources[i];
      if (!s) {
        s = { kind: "proc", name, def, label: def.label, ja: def.ja, seed: (Math.random() * 1e9) | 0 };
        s.el = document.createElement("canvas");
        procSources[i] = s;
      }
      s.el.width = ow; s.el.height = oh;
      s.w = ow; s.h = oh;
      const g = s.el.getContext("2d");
      def.render(g, ow, oh, mulberry(s.seed));
    });
  };

  // 画像/動画を読み込む (1つ10秒で諦める)。progress(読めた数, 全体) で進み具合を返す
  const loadMedia = progress => {
    const list = CFG.media || [];
    let n = 0;
    const tick = () => progress && progress(++n, list.length);
    return Promise.all(list.map(m => new Promise(resolve => {
      let settled = false;
      const finish = item => {
        if (settled) return;
        settled = true;
        if (item) mediaSources.push(item);
        tick();
        resolve();
      };
      setTimeout(() => { if (!settled) console.warn("load timeout:", m.src); finish(null); }, 10000);
      if (m.type === "video") {
        const v = document.createElement("video");
        v.src = m.src; v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
        v.setAttribute("playsinline", "");
        v.addEventListener("loadeddata", () => {
          v.play().catch(() => {});
          finish({ kind: "video", el: v, w: v.videoWidth, h: v.videoHeight, label: m.label || "" });
        }, { once: true });
        v.addEventListener("error", () => { console.warn("video load failed:", m.src); finish(null); }, { once: true });
      } else {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => finish({ kind: "image", el: img, w: img.naturalWidth, h: img.naturalHeight, label: m.label || "" });
        img.onerror = () => { console.warn("image load failed:", m.src); finish(null); };
        img.src = m.src;
      }
    })));
  };

  const collectSources = () => {
    sources = mediaSources.slice();
    // 写真が1枚も読めなかったときは、コードで描いた仮の風景で代用する
    if (CFG.useProcedural || sources.length === 0) sources = sources.concat(procSources);
  };

  let rebuildTimer = 0;
  const scheduleRebuild = () => {
    if (!running) return;
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(buildProc, 250);
  };

  // ---------- タイムライン (1ループ分のカット割りを作る) ----------
  const sectionOf = bar => bar < 4 ? "intro" : bar < 12 ? "main" : bar < 15 ? "drop" : "outro";
  const sectionEnd = bar => bar < 4 ? 16 : bar < 12 ? 48 : bar < 15 ? 60 : 64;

  const ACCENTS = ["#f3d27a", "#ff3d9a", "#35e0ff", "#9fb4ff", "#ffffff"];
  const TINTS = ["#ff3d9a", "#35e0ff", "#f3d27a", "#7a5cff"];
  let cutCounter = 0;
  let bag = [];

  const nextSource = last => {
    if (bag.length === 0) {
      bag = sources.map((_, i) => i);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.length > 1 && bag[bag.length - 1] === last) bag.unshift(bag.pop());
    }
    return bag.pop();
  };

  const buildLoop = () => {
    const cuts = [];
    let b = 0, last = -1;
    const rnd = Math.random;
    while (b < LOOP_BEATS - 1e-6) {
      const bar = Math.floor(b / 4);
      const sec = sectionOf(bar);
      let len;
      if (calm) len = { intro: 4, main: 2, drop: 2, outro: 4 }[sec];
      else if (sec === "intro") len = 2;
      else if (sec === "main") len = (b % 2 === 0 && rnd() < 0.2) ? 2 : 1;
      else if (sec === "drop") len = rnd() < 0.15 ? 1 : 0.5;
      else len = 4;
      len = Math.min(len, sectionEnd(bar) - b);
      const src = nextSource(last);
      last = src;
      const zIn = rnd() < 0.6;
      const z0 = 1.04 + rnd() * 0.08, z1 = z0 + (sec === "outro" ? 0.18 : 0.06 + rnd() * 0.08);
      cuts.push({
        start: b, len, sec, src, n: ++cutCounter,
        cam: {
          z0: zIn ? z0 : z1, z1: zIn ? z1 : z0,
          px0: rnd() * 2 - 1, px1: rnd() * 2 - 1,
          py0: rnd() * 2 - 1, py1: rnd() * 2 - 1,
        },
        showWord: sec === "main" && len >= 1 && rnd() < 0.3,
        accent: ACCENTS[(rnd() * ACCENTS.length) | 0],
        tint: (sec === "drop" && rnd() < 0.45) || (sec === "main" && rnd() < 0.12) ? TINTS[(rnd() * TINTS.length) | 0] : null,
        wipe: sec === "main" && rnd() < 0.2,
        seed: (rnd() * 1e6) | 0,
      });
      b += len;
    }
    return cuts;
  };

  let loopIndex = null, loopCuts = [];

  // ---------- 時計 ----------
  // 曲あり: <audio> の再生位置 / 曲なし: AudioContext の時刻 / どちらも無理: performance.now
  let mode = "perf";
  let ac = null, master = null, t0 = 0, audioEl = null;
  let paused = false, perfStart = 0, perfPausedAt = 0;
  let soundOn = false;

  const songTime = () => {
    if (mode === "music") return Math.max(0, audioEl.currentTime - (CFG.music.offset || 0)) + START_AT * BEAT;
    if (mode === "synth") return ac.currentTime - t0;
    const now = paused ? perfPausedAt : performance.now();
    return (now - perfStart) / 1000;
  };

  // ---------- 内蔵ビート (仮の曲) ----------
  let noiseBuf = null, nextStep = 0, schedTimer = 0;
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];   // Am F C G
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  const env = (gainNode, when, peak, attack, decay) => {
    gainNode.gain.setValueAtTime(0.0001, when);
    gainNode.gain.exponentialRampToValueAtTime(peak, when + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
  };

  const kick = when => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(150, when);
    o.frequency.exponentialRampToValueAtTime(42, when + 0.12);
    env(g, when, 0.9, 0.003, 0.32);
    o.connect(g).connect(master);
    o.start(when); o.stop(when + 0.4);
  };

  const noise = (when, type, freq, peak, decay) => {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf;
    f.type = type; f.frequency.value = freq;
    env(g, when, peak, 0.002, decay);
    s.connect(f).connect(g).connect(master);
    s.start(when, Math.random() * 0.5); s.stop(when + decay + 0.05);
  };

  const tone = (when, midi, type, cutoff, peak, attack, decay) => {
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = type; o.frequency.value = hz(midi);
    f.type = "lowpass"; f.frequency.value = cutoff;
    env(g, when, peak, attack, decay);
    o.connect(f).connect(g).connect(master);
    o.start(when); o.stop(when + attack + decay + 0.05);
  };

  const playStep = (step, when) => {
    const s = ((step % (LOOP_BEATS * 4)) + LOOP_BEATS * 4) % (LOOP_BEATS * 4);
    const bar = Math.floor(s / 16), s16 = s % 16, sec = sectionOf(bar);
    const chord = CHORDS[bar % 4];
    if (s16 === 0) {                                           // パッド
      chord.forEach(m => {
        tone(when, m, "sawtooth", sec === "drop" ? 2400 : 1100, sec === "outro" ? 0.05 : 0.03, 0.08, BEAT * 3.6);
        tone(when, m + 12.08, "triangle", 3000, 0.012, 0.08, BEAT * 3.6);
      });
    }
    if (sec === "outro") { if (s16 === 0) kick(when); return; }
    if (s16 % 4 === 0 && (sec !== "intro" || s16 % 8 === 0)) kick(when);
    if (sec === "intro") return;
    if (s16 === 4 || s16 === 12) noise(when, "bandpass", 1600, 0.35, 0.16);           // クラップ
    if (s16 % 4 === 2) noise(when, "highpass", 7000, 0.22, 0.05);                       // ハット
    if (sec === "drop" && s16 % 2 === 1) noise(when, "highpass", 9000, 0.1, 0.03);
    if (s16 % 4 === 2) tone(when, chord[0] - 24, "sawtooth", 420, 0.22, 0.005, BEAT * 0.4); // ベース
  };

  const scheduler = () => {
    if (!ac || paused) return;
    while (t0 + nextStep * BEAT / 4 < ac.currentTime + 0.12) {
      const when = t0 + nextStep * BEAT / 4;
      if (when >= ac.currentTime - 0.01) playStep(nextStep, Math.max(when, ac.currentTime));
      nextStep++;
    }
  };

  const setupAudio = () => {
    if (CFG.music && CFG.music.src) {
      audioEl = new Audio(CFG.music.src);
      audioEl.loop = true;
      audioEl.currentTime = (CFG.music.offset || 0) > 0 ? 0 : 0;
      mode = "music";
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { mode = "perf"; return; }
    ac = new AC();
    master = ac.createGain();
    const comp = ac.createDynamicsCompressor();
    master.connect(comp).connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    mode = "synth";
  };

  const applySound = () => {
    if (mode === "music") audioEl.muted = !soundOn;
    if (mode === "synth") master.gain.setTargetAtTime(soundOn ? 0.7 : 0, ac.currentTime, 0.02);
    btnSound.textContent = soundOn ? "♪ ON" : "♪ OFF";
    btnSound.setAttribute("aria-pressed", String(soundOn));
  };

  // ---------- 描画の部品 ----------
  const ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const lerp = (a, b, k) => a + (b - a) * k;
  const hash = (i, s) => {
    let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(s, 0xc2b2ae35);
    x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12;
    return (x >>> 0) / 4294967296;
  };
  const px = () => ctx.setTransform(DPR, 0, 0, DPR, 0, 0);   // CSSピクセルで描く

  const drawSource = (cut, k, t) => {
    const s = sources[cut.src];
    if (!s || !s.w) { px(); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); return; }
    const c = cut.cam;
    const z = lerp(c.z0, c.z1, k);
    const sc = Math.max(W / s.w, H / s.h) * z;
    const ex = (s.w * sc - W) / 2, ey = (s.h * sc - H) / 2;
    const x = -ex + lerp(c.px0, c.px1, k) * ex;
    const y = -ey + lerp(c.py0, c.py1, k) * ey;
    ctx.setTransform(DPR * sc, 0, 0, DPR * sc, DPR * x, DPR * y);
    ctx.drawImage(s.el, 0, 0, s.w, s.h);
    if (s.kind === "proc" && s.def.animate) s.def.animate(ctx, s.w, s.h, t, s.seed);
    px();
  };

  const text = (str, x, y, size, opt = {}) => {
    ctx.font = `${opt.weight || 900} ${size}px ${opt.font || FONT_SANS}`;
    ctx.textAlign = opt.align || "center";
    ctx.textBaseline = opt.baseline || "middle";
    if (opt.spacing && "letterSpacing" in ctx) ctx.letterSpacing = opt.spacing + "px";
    if (opt.stroke) {
      ctx.lineWidth = opt.lineWidth || 2;
      ctx.strokeStyle = opt.color || "#fff";
      ctx.strokeText(str, x, y);
    } else {
      ctx.fillStyle = opt.color || "#fff";
      ctx.fillText(str, x, y);
    }
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  };

  // 下から文字がせり上がる (マスク)
  const maskReveal = (k, x, y, w, h, draw) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(0, (1 - ease(k)) * h);
    draw();
    ctx.restore();
  };

  const corners = (m, l, a) => {
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
      ctx.moveTo(x, y + dy * l); ctx.lineTo(x, y); ctx.lineTo(x + dx * l, y);
    }
    ctx.stroke();
  };

  // ---------- オーバーレイ ----------
  const S = () => Math.min(W, H);

  // 対角線が縦横に乗る正方形 (ひし形)。r は中心から頂点までの長さ
  const diamond = (cx, cy, r) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
  };
  const DIAMOND_R = () => S() * 0.2;
  const COVER_R = () => (W + H) / 2 + 4;   // 画面全体を覆うひし形の大きさ

  // ひし形の窓の中にだけ映像を出す
  const drawInDiamond = (cut, k, tSong, r, beatPulse) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    diamond(W / 2, H / 2, r);
    ctx.clip();
    drawSource(cut, k, tSong);
    grade(cut);
    ctx.restore();
    if (r < COVER_R() * 0.9) {
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.5;
      diamond(W / 2, H / 2, r * (1 + beatPulse * 0.025));
      ctx.stroke();
    }
  };

  const drawName = (r, alpha) => {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    text(CFG.name, W / 2, H / 2 + r + Math.max(30, S() * 0.06), Math.max(15, S() * 0.03),
      { font: FONT_HUD, weight: 400, spacing: Math.max(4, S() * 0.008) });
    ctx.globalAlpha = 1;
  };

  // 真ん中にさらっと出す英字 (フェードイン/アウト)
  const drawLightWord = (cut, lt) => {
    const s = sources[cut.src] || {};
    if (!s.label) return;
    const dur = cut.len * BEAT;
    const a = Math.min(1, lt / 0.12, (dur - lt) / 0.12);
    if (a <= 0) return;
    ctx.globalAlpha = a * 0.95;
    text(s.label.toUpperCase(), W / 2, H / 2, 13, { font: FONT_HUD, weight: 400, spacing: 7 });
    ctx.globalAlpha = 1;
  };

  // 色かぶせ + 少し暗く
  const grade = cut => {
    if (cut.tint) {
      ctx.globalCompositeOperation = "color";
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = cut.tint;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, 0, W, H);
  };

  const drawRing = (b, color) => {
    const k = b - Math.floor(b);
    const r = ease(k) * S() * 0.55;
    ctx.strokeStyle = color;
    ctx.globalAlpha = Math.max(0, 0.6 * (1 - k * 1.4));
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const drawShapes = (cut, lt) => {
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const x = hash(i, cut.seed) * W, y = hash(i + 9, cut.seed) * H;
      const r = S() * (0.03 + hash(i + 3, cut.seed) * 0.06);
      const rot = lt * (hash(i + 5, cut.seed) - 0.5) * 8;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(rot);
      ctx.beginPath();
      const kind = (hash(i + 7, cut.seed) * 3) | 0;
      if (kind === 0) ctx.arc(0, 0, r, 0, Math.PI * 2);
      else if (kind === 1) ctx.rect(-r, -r, r * 2, r * 2);
      else { ctx.moveTo(0, -r); ctx.lineTo(r * 0.87, r * 0.5); ctx.lineTo(-r * 0.87, r * 0.5); ctx.closePath(); }
      ctx.stroke();
      ctx.restore();
    }
  };

  // 横のスライスをずらす (キャンバスを自分自身にコピー)
  const glitch = (seed, amount) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const cw = cv.width, ch = cv.height;
    for (let i = 0; i < 7; i++) {
      const y = (hash(i, seed) * ch) | 0;
      const h = Math.max(2, (hash(i + 20, seed) * ch * 0.08) | 0);
      const dx = ((hash(i + 40, seed) - 0.5) * cw * 0.12 * amount) | 0;
      ctx.drawImage(cv, 0, y, cw, h, dx, y, cw, h);
    }
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ["rgba(255,0,80,0.25)", "rgba(0,220,255,0.25)", "rgba(255,255,255,0.2)"][i];
      ctx.fillRect(0, hash(i + 70, seed) * ch, cw, Math.max(2, hash(i + 80, seed) * ch * 0.02));
    }
    ctx.globalCompositeOperation = "source-over";
    px();
  };

  // フィルムの粒子
  const grain = document.createElement("canvas");
  grain.width = grain.height = 128;
  {
    const g = grain.getContext("2d"), d = g.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 22;
    }
    g.putImageData(d, 0, 0);
  }
  let grainPattern = null;

  const finish = () => {
    // 周辺減光
    const gr = ctx.createRadialGradient(W / 2, H / 2, S() * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    // 粒子
    if (!grainPattern) grainPattern = ctx.createPattern(grain, "repeat");
    ctx.save();
    ctx.translate((Math.random() * 128) | 0, (Math.random() * 128) | 0);
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = grainPattern;
    ctx.fillRect(-128, -128, W + 256, H + 256);
    ctx.restore();
  };

  // ---------- 1フレーム ----------
  const frame = () => {
    requestAnimationFrame(frame);
    if (!running) return;
    if (mode === "synth") scheduler();
    const tSong = Math.max(0, songTime());
    const totalBeat = tSong / BEAT;
    const li = Math.floor(totalBeat / LOOP_BEATS);
    if (li !== loopIndex) { loopIndex = li; loopCuts = buildLoop(); }
    const b = totalBeat - li * LOOP_BEATS;

    let cut = loopCuts[0];
    for (const c of loopCuts) { if (c.start <= b) cut = c; else break; }
    const lb = b - cut.start;                 // カット内の経過(拍)
    const lt = lb * BEAT;                     // カット内の経過(秒)
    const k = lb / cut.len;
    const bar = Math.floor(b / 4);
    const sec = cut.sec;

    px();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    const pulse = Math.max(0, 1 - (b - Math.floor(b)) * 4);   // 拍の頭で 1 → すぐ 0

    if (sec === "intro") {
      // ひし形の窓 → 最後の2拍で画面いっぱいに広がる
      const r0 = DIAMOND_R();
      let r = r0 * ease(b / 1);
      if (b > 14) r = lerp(r0, COVER_R(), ease((b - 14) / 2) ** 1.5);
      drawInDiamond(cut, k, tSong, r, pulse);
      drawName(r0, Math.min(1, (b - 1) / 1) * (1 - Math.max(0, (b - 13.5) / 0.5)));
    } else if (sec === "outro") {
      // 画面がひし形に縮んで、名前が出て、暗転
      const r0 = DIAMOND_R();
      const r = lerp(COVER_R(), r0, ease(lb / 1.5));
      drawInDiamond(cut, k, tSong, r, lb > 1.5 ? pulse : 0);
      drawName(r0, Math.min(1, Math.max(0, (lb - 1.2) / 0.8)));
    } else {
      drawSource(cut, k, tSong);
      grade(cut);
      if (sec === "main") {
        drawRing(b, cut.accent);
        // 小節頭に横線が走る
        const kb = b % 4;
        if (kb < 1) {
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillRect(0, lerp(0, H, ease(kb)), W, 1);
        }
        if (cut.showWord) drawLightWord(cut, lt);
        if (cut.wipe && lt < 0.16) {
          const e = ease(lt / 0.16);
          ctx.fillStyle = cut.accent;
          ctx.fillRect(e * W, 0, W, H);
        }
      } else {
        // drop
        if (!calm) drawShapes(cut, lt);
        if (!calm && lt < 0.09) glitch(cut.seed + Math.floor(lt * 60), 1);
        if (!calm && b % 4 < 0.25) {           // 小節頭だけ弱いフラッシュ (1秒に1回以下)
          ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - (b % 4) / 0.25)})`;
          ctx.fillRect(0, 0, W, H);
        }
      }
      corners(14, 16, 0.5);
    }
    finish();

    // ループの最後は暗転
    if (sec === "outro" && lb > 3) {
      ctx.fillStyle = `rgba(0,0,0,${ease(lb - 3)})`;
      ctx.fillRect(0, 0, W, H);
    }
  };

  // ---------- 操作 ----------
  let running = false;

  const setPaused = p => {
    paused = p;
    if (mode === "synth") p ? ac.suspend() : ac.resume();
    if (mode === "music") p ? audioEl.pause() : audioEl.play();
    if (mode === "perf") {
      if (p) perfPausedAt = performance.now();
      else perfStart += performance.now() - perfPausedAt;
    }
    btnPause.textContent = p ? "▶ PLAY" : "❚❚ PAUSE";
  };

  const setCalm = c => {
    calm = c;
    btnCalm.setAttribute("aria-pressed", String(c));
    btnCalm.textContent = c ? "CALM: ON" : "CALM: OFF";
    loopIndex = null;          // 次のフレームでカット割りを作り直す
  };

  const fsSupported = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
  if (!fsSupported) btnFull.hidden = true;
  const toggleFull = () => {
    const d = document, el = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  };

  let idleTimer = 0;
  const poke = () => {
    uiEl.classList.add("ui--show");
    document.body.classList.remove("hide-cursor");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      uiEl.classList.remove("ui--show");
      document.body.classList.add("hide-cursor");
    }, 2500);
  };

  const start = async withSound => {
    btnPlay.disabled = btnMuted.disabled = true;
    startEl.classList.add("start--loading");
    soundOn = withSound;
    setupAudio();
    if (mode === "synth") await ac.resume();
    // フォントを待つ (最大1.5秒)
    if (document.fonts && document.fonts.load) {
      await Promise.race([
        Promise.all([
          document.fonts.load(`16px 'DotGothic16'`, "shin2225ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
        ]).catch(() => {}),
        new Promise(r => setTimeout(r, 1500)),
      ]);
    }
    const loadingEl = document.getElementById("loading");
    await loadMedia((n, total) => { loadingEl.textContent = `loading ${n} / ${total}`; });
    running = true;
    procSources.used = CFG.useProcedural || mediaSources.length === 0;
    if (procSources.used) {
      // procSources に定義を並べてから描く
      Object.entries(window.PROC_SCENES || {}).forEach(([name, def], i) => {
        procSources[i] = { kind: "proc", name, def, label: def.label, seed: (Math.random() * 1e9) | 0, el: document.createElement("canvas") };
      });
    }
    buildProc();
    collectSources();
    applySound();
    if (mode === "synth") {
      t0 = ac.currentTime + 0.1 - START_AT * BEAT;
      nextStep = Math.ceil((ac.currentTime + 0.1 - t0) / (BEAT / 4));
      schedTimer = setInterval(scheduler, 25);
    } else if (mode === "music") {
      audioEl.play().catch(() => {});
    } else {
      perfStart = performance.now() - START_AT * BEAT * 1000;
    }
    startEl.hidden = true;
    poke();
  };

  btnPlay.addEventListener("click", () => start(true));
  btnMuted.addEventListener("click", () => start(false));
  btnPause.addEventListener("click", () => setPaused(!paused));
  btnSound.addEventListener("click", () => { soundOn = !soundOn; applySound(); });
  btnCalm.addEventListener("click", () => setCalm(!calm));
  btnFull.addEventListener("click", toggleFull);
  window.addEventListener("pointermove", () => running && poke());
  window.addEventListener("pointerdown", () => running && poke());
  window.addEventListener("keydown", e => {
    if (!running) return;
    if (e.key === " ") { e.preventDefault(); setPaused(!paused); }
    else if (e.key === "m") { soundOn = !soundOn; applySound(); }
    else if (e.key === "f" && fsSupported) toggleFull();
    else if (e.key === "c") setCalm(!calm);
    else return;
    poke();
  });
  window.addEventListener("resize", resize);

  setCalm(calm);
  resize();
  requestAnimationFrame(frame);
})();
