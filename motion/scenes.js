// ===== 仮素材: コードで描く風景 =====
// 実際の写真・動画が揃うまでの代わり。
// render(g, W, H, rng)      : 止まった絵をオフスクリーンに1回だけ描く
// animate(g, W, H, t, seed) : 毎フレーム上に重ねる動き (雨・光の筋など)。座標は render と同じ
(() => {
  "use strict";

  // ---- 小道具 ----
  const TAU = Math.PI * 2;

  const vgrad = (g, y0, y1, stops) => {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  };

  const glow = (g, x, y, r, color, a = 1) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = a;
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.globalAlpha = 1;
  };

  // 中点変位法で山の稜線を作る (値は -1〜1 くらい)
  const ridgeline = (rng, n = 256, rough = 0.55) => {
    const pts = new Array(n + 1).fill(0);
    pts[0] = rng() * 2 - 1;
    pts[n] = rng() * 2 - 1;
    let step = n, amp = 1;
    while (step > 1) {
      const half = step / 2;
      for (let i = half; i < n; i += step) {
        pts[i] = (pts[i - half] + pts[i + half]) / 2 + (rng() * 2 - 1) * amp;
      }
      step = half;
      amp *= rough;
    }
    return pts;
  };

  const fillRidge = (g, W, H, rng, baseY, amp, color, rough) => {
    const pts = ridgeline(rng, 256, rough);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, H);
    pts.forEach((p, i) => g.lineTo(i / (pts.length - 1) * W, baseY - p * amp));
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  };

  const lerpColor = (a, b, k) => {
    const pa = a.match(/\w\w/g).map(h => parseInt(h, 16));
    const pb = b.match(/\w\w/g).map(h => parseInt(h, 16));
    return "rgb(" + pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(",") + ")";
  };

  // 決まった種から毎フレーム同じ乱数列を作る (animate 用)
  const hash = (i, s) => {
    let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(s, 0xc2b2ae35);
    x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12;
    return (x >>> 0) / 4294967296;
  };
  const frac = x => x - Math.floor(x);

  // 遠近法: 消失点 (vx,vy) から手前 (xb, yb) へ。d=0 が奥、d=1 が手前
  const persp = (vx, vy, xb, yb, d) => {
    const s = Math.pow(d, 2.4);
    return [vx + (xb - vx) * s, vy + (yb - vy) * s, s];
  };

  const S = {};

  // 1. 夕暮れの山
  S.mountain = {
    label: "MOUNTAIN", ja: "山",
    render(g, W, H, rng) {
      g.fillStyle = vgrad(g, 0, H * 0.75, [[0, "#241a4a"], [0.45, "#6b3a6e"], [0.8, "#e2725b"], [1, "#f6b26b"]]);
      g.fillRect(0, 0, W, H);
      const sx = W * (0.3 + rng() * 0.4), sy = H * 0.62;
      glow(g, sx, sy, Math.max(W, H) * 0.5, "rgba(255,190,120,0.55)");
      g.fillStyle = "#ffe0b0";
      g.beginPath(); g.arc(sx, sy, Math.min(W, H) * 0.06, 0, TAU); g.fill();
      const cols = ["#a35a7a", "#6e3c6e", "#45285a", "#24183d", "#120c24"];
      cols.forEach((c, i) => fillRidge(g, W, H, rng, H * (0.58 + i * 0.08), H * (0.12 - i * 0.012), c, 0.55));
    },
  };

  // 2. 海と太陽
  S.sea = {
    label: "SEA", ja: "海",
    render(g, W, H, rng) {
      const hz = H * 0.58;
      g.fillStyle = vgrad(g, 0, hz, [[0, "#2a6fb0"], [0.7, "#8cc2ea"], [1, "#ffe6c2"]]);
      g.fillRect(0, 0, W, hz);
      for (let i = 0; i < 6; i++) {          // 薄い雲
        g.fillStyle = "rgba(255,255,255,0.28)";
        g.beginPath();
        g.ellipse(rng() * W, hz * (0.25 + rng() * 0.55), W * (0.08 + rng() * 0.12), H * 0.012, 0, 0, TAU);
        g.fill();
      }
      const sx = W * (0.35 + rng() * 0.3);
      glow(g, sx, hz - H * 0.06, Math.min(W, H) * 0.35, "rgba(255,240,200,0.7)");
      g.fillStyle = "#fff6e0";
      g.beginPath(); g.arc(sx, hz - H * 0.06, Math.min(W, H) * 0.04, 0, TAU); g.fill();
      g.fillStyle = vgrad(g, hz, H, [[0, "#4a8cc0"], [1, "#0b2a4a"]]);
      g.fillRect(0, hz, W, H - hz);
      for (let i = 0; i < 260; i++) {        // 太陽の照り返し
        const y = hz + Math.pow(rng(), 1.4) * (H - hz);
        const k = (y - hz) / (H - hz);
        const w = (0.01 + rng() * 0.05) * W * (0.4 + k);
        const x = sx + (rng() - 0.5) * W * (0.05 + k * 0.25);
        g.fillStyle = `rgba(255,236,190,${(0.5 - k * 0.4) * rng()})`;
        g.fillRect(x - w / 2, y, w, Math.max(1, H * 0.003));
      }
    },
    animate(g, W, H, t, seed) {
      const hz = H * 0.58;
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 70; i++) {
        const k = hash(i, seed);
        const y = hz + Math.pow(hash(i + 99, seed), 1.3) * (H - hz);
        const x = frac(k + t * (0.01 + hash(i + 7, seed) * 0.03)) * W;
        const a = Math.max(0, Math.sin(t * 3 + k * 20)) * 0.35;
        g.fillStyle = `rgba(255,250,230,${a})`;
        g.fillRect(x, y, W * 0.02 * (0.5 + (y - hz) / (H - hz)), Math.max(1, H * 0.003));
      }
      g.globalCompositeOperation = "source-over";
    },
  };

  // 3. 霧の森
  S.forest = {
    label: "FOREST", ja: "森",
    render(g, W, H, rng) {
      g.fillStyle = vgrad(g, 0, H, [[0, "#dbe9dc"], [0.5, "#a9c8b2"], [1, "#6f9a80"]]);
      g.fillRect(0, 0, W, H);
      const layers = 6;
      for (let l = 0; l < layers; l++) {
        const k = l / (layers - 1);
        const col = lerpColor("8fb59f", "0b2117", k);
        const base = H * (0.5 + k * 0.5);
        const th = H * (0.18 + k * 0.4);
        const n = Math.round(30 - k * 18);
        g.fillStyle = col;
        for (let i = 0; i < n; i++) {
          const x = rng() * W * 1.1 - W * 0.05;
          const h = th * (0.6 + rng() * 0.6);
          const w = h * 0.32;
          g.beginPath();
          g.moveTo(x, base - h);
          g.lineTo(x + w / 2, base);
          g.lineTo(x - w / 2, base);
          g.fill();
        }
        g.fillRect(0, base - 2, W, H - base + 2);
        g.fillStyle = "rgba(225,238,228,0.18)";
        g.fillRect(0, 0, W, H);
      }
    },
    animate(g, W, H, t, seed) {
      for (let i = 0; i < 3; i++) {
        const x = frac(hash(i, seed) + t * 0.03 * (i + 1)) * W * 1.6 - W * 0.3;
        const y = H * (0.55 + i * 0.12);
        g.save();
        g.translate(x, y);
        g.scale(1, 0.18);
        glow(g, 0, 0, W * 0.4, "rgba(240,248,242,0.45)");
        g.restore();
      }
    },
  };

  // 4. 夜のビル街
  S.city = {
    label: "CITY", ja: "街",
    render(g, W, H, rng) {
      g.fillStyle = vgrad(g, 0, H, [[0, "#05081a"], [0.55, "#1b2150"], [0.8, "#4a3466"], [1, "#4a3466"]]);
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 120; i++) {
        g.fillStyle = `rgba(230,236,255,${rng() * 0.7})`;
        g.fillRect(rng() * W, rng() * H * 0.4, 1.5, 1.5);
      }
      for (let layer = 0; layer < 3; layer++) {
        let x = -rng() * 40;
        const dark = ["#1b2150", "#11163a", "#080b22"][layer];
        while (x < W) {
          const w = W * (0.03 + rng() * 0.06) * (1 + layer * 0.4);
          const h = H * (0.2 + rng() * 0.45) * (1 - layer * 0.15);
          const top = H - h;
          g.fillStyle = dark;
          g.fillRect(x, top, w, h);
          const cw = Math.max(2, w * 0.06), ch = cw * 1.4;
          const lit = 0.15 + rng() * 0.35;
          for (let y = top + ch * 2; y < H - ch; y += ch * 2.2) {
            for (let xx = x + cw; xx < x + w - cw * 1.5; xx += cw * 2) {
              if (rng() < lit) {
                g.fillStyle = rng() < 0.8 ? `rgba(255,214,130,${0.5 + layer * 0.2})` : "rgba(170,190,255,0.8)";
                g.fillRect(xx, y, cw, ch);
              }
            }
          }
          if (rng() < 0.3) glow(g, x + w / 2, top - 4, 6, "rgba(255,70,70,0.9)");
          x += w + rng() * 6;
        }
      }
    },
  };

  // 5. ネオンの路地
  S.neon = {
    label: "NIGHT", ja: "夜",
    render(g, W, H, rng) {
      g.fillStyle = vgrad(g, 0, H, [[0, "#07040e"], [0.6, "#160b26"], [1, "#05030a"]]);
      g.fillRect(0, 0, W, H);
      const vx = W * 0.5, vy = H * 0.48;
      g.fillStyle = "#120a1d";
      g.beginPath(); g.moveTo(0, 0); g.lineTo(vx - W * 0.06, vy - H * 0.2); g.lineTo(vx - W * 0.06, vy + H * 0.05); g.lineTo(0, H); g.fill();
      g.beginPath(); g.moveTo(W, 0); g.lineTo(vx + W * 0.06, vy - H * 0.2); g.lineTo(vx + W * 0.06, vy + H * 0.05); g.lineTo(W, H); g.fill();
      const neon = ["#ff3d9a", "#35e0ff", "#ffcc33", "#9d5cff", "#ff5a3d"];
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 60; i++) {        // ボケた光
        const x = rng() * W, y = H * (0.2 + rng() * 0.5);
        const r = Math.min(W, H) * (0.01 + rng() * 0.06);
        glow(g, x, y, r, neon[(rng() * neon.length) | 0], 0.25 + rng() * 0.35);
      }
      for (let i = 0; i < 8; i++) {         // 看板
        const side = i % 2 ? 1 : -1;
        const x = vx + side * W * (0.12 + rng() * 0.3);
        const y = H * (0.15 + rng() * 0.4);
        const c = neon[i % neon.length];
        glow(g, x, y, W * 0.08, c, 0.35);
        g.fillStyle = c;
        g.fillRect(x - W * 0.012, y - H * 0.07, W * 0.024, H * 0.14);
      }
      for (let i = 0; i < 90; i++) {        // 濡れた路面の映り込み
        const x = rng() * W, c = neon[(rng() * neon.length) | 0];
        g.globalAlpha = 0.12 * rng();
        g.fillStyle = c;
        g.fillRect(x, vy + H * 0.1 + rng() * H * 0.2, W * 0.004, H * (0.1 + rng() * 0.3));
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    },
    animate(g, W, H, t, seed) {
      const on = hash(Math.floor(t * 8), seed) > 0.25;
      if (on) glow(g, W * (0.2 + hash(1, seed) * 0.6), H * 0.3, W * 0.12, "rgba(255,61,154,0.35)");
    },
  };

  // 6. 高速道路の光の筋
  S.highway = {
    label: "LIGHT", ja: "光",
    render(g, W, H, rng) {
      const hz = H * 0.45;
      g.fillStyle = vgrad(g, 0, hz, [[0, "#0b1030"], [0.7, "#3a2a5a"], [1, "#d0705a"]]);
      g.fillRect(0, 0, W, hz);
      g.fillStyle = "#0e0c1c";
      let x = 0;
      while (x < W) {                        // 地平線の街
        const w = W * (0.01 + rng() * 0.03), h = H * (0.01 + rng() * 0.07);
        g.fillRect(x, hz - h, w, h);
        x += w;
      }
      g.fillStyle = vgrad(g, hz, H, [[0, "#14111f"], [1, "#05040a"]]);
      g.fillRect(0, hz, W, H - hz);
      g.strokeStyle = "rgba(255,255,255,0.25)";
      g.lineWidth = 2;
      for (const xb of [-0.3, 0.2, 0.5, 0.8, 1.3]) {
        g.beginPath(); g.moveTo(W * 0.5, hz); g.lineTo(W * xb, H); g.stroke();
      }
    },
    animate(g, W, H, t, seed) {
      const vx = W * 0.5, vy = H * 0.45;
      g.globalCompositeOperation = "lighter";
      g.lineCap = "round";
      for (let i = 0; i < 26; i++) {
        const lane = i % 4;
        const xb = W * [-0.05, 0.35, 0.65, 1.05][lane];
        const toward = lane < 2;
        const sp = 0.25 + hash(i, seed) * 0.25;
        let d = frac(hash(i + 50, seed) + t * sp);
        if (!toward) d = 1 - d;
        const [x0, y0, s0] = persp(vx, vy, xb, H * 1.05, d);
        const [x1, y1] = persp(vx, vy, xb, H * 1.05, Math.max(0, d - 0.12));
        g.strokeStyle = toward ? "rgba(255,246,220,0.9)" : "rgba(255,60,60,0.9)";
        g.lineWidth = 1 + s0 * 10;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      }
      g.globalCompositeOperation = "source-over";
    },
  };

  // 7. オーロラと星
  S.aurora = {
    label: "STARS", ja: "星",
    render(g, W, H, rng) {
      g.fillStyle = vgrad(g, 0, H, [[0, "#02040f"], [0.7, "#0a1a33"], [1, "#0d2030"]]);
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 500; i++) {
        g.fillStyle = `rgba(235,240,255,${rng()})`;
        const s = rng() < 0.05 ? 2 : 1;
        g.fillRect(rng() * W, rng() * H * 0.8, s, s);
      }
      g.globalCompositeOperation = "lighter";
      for (let c = 0; c < 3; c++) {
        const f = 2 + rng() * 3, ph = rng() * TAU, base = H * (0.2 + c * 0.08);
        const col = c === 1 ? [140, 90, 255] : [60, 255, 160];
        for (let x = 0; x < W; x += 2) {
          const y0 = base + Math.sin(x / W * f * TAU + ph) * H * 0.07 + Math.sin(x / W * 13 + ph) * H * 0.015;
          const len = H * (0.15 + 0.1 * Math.sin(x / W * 7 + ph * 2));
          const gr = g.createLinearGradient(0, y0, 0, y0 + len);
          gr.addColorStop(0, `rgba(${col},0)`);
          gr.addColorStop(0.7, `rgba(${col},0.10)`);
          gr.addColorStop(1, `rgba(${col},0)`);
          g.fillStyle = gr;
          g.fillRect(x, y0, 2, len);
        }
      }
      g.globalCompositeOperation = "source-over";
      fillRidge(g, W, H, rng, H * 0.86, H * 0.06, "#03060d", 0.6);
    },
    animate(g, W, H, t, seed) {
      for (let i = 0; i < 40; i++) {
        const a = Math.max(0, Math.sin(t * (2 + hash(i, seed) * 4) + i));
        g.fillStyle = `rgba(255,255,255,${a})`;
        g.fillRect(hash(i + 1, seed) * W, hash(i + 2, seed) * H * 0.7, 2, 2);
      }
    },
  };

  // 8. 雨の街
  S.rain = {
    label: "RAIN", ja: "雨",
    render(g, W, H, rng) {
      g.fillStyle = vgrad(g, 0, H, [[0, "#1a2230"], [1, "#2f3d50"]]);
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 50; i++) {
        const c = rng() < 0.6 ? "rgba(255,210,150,1)" : rng() < 0.5 ? "rgba(200,220,255,1)" : "rgba(255,120,110,1)";
        glow(g, rng() * W, H * (0.3 + rng() * 0.55), Math.min(W, H) * (0.03 + rng() * 0.08), c, 0.15 + rng() * 0.3);
      }
      g.fillStyle = "rgba(10,14,22,0.5)";
      g.fillRect(0, H * 0.85, W, H * 0.15);
    },
    animate(g, W, H, t, seed) {
      g.strokeStyle = "rgba(210,225,255,0.35)";
      g.lineWidth = 1.2;
      g.beginPath();
      for (let i = 0; i < 220; i++) {
        const x = hash(i, seed) * W * 1.2;
        const y = frac(hash(i + 300, seed) + t * (1.2 + hash(i + 600, seed))) * H * 1.2 - H * 0.1;
        const len = H * 0.05;
        g.moveTo(x - len * 0.2, y);
        g.lineTo(x - len * 0.2 - len * 0.15, y + len);
      }
      g.stroke();
    },
  };

  // 9. 雪山
  S.snow = {
    label: "SNOW", ja: "雪",
    render(g, W, H, rng) {
      g.fillStyle = vgrad(g, 0, H, [[0, "#9fb6d4"], [0.5, "#dfe8f3"], [1, "#f4f7fb"]]);
      g.fillRect(0, 0, W, H);
      fillRidge(g, W, H, rng, H * 0.5, H * 0.2, "#c3d2e6", 0.6);
      fillRidge(g, W, H, rng, H * 0.62, H * 0.12, "#e4ecf6", 0.55);
      g.fillStyle = "#2a3644";
      for (let i = 0; i < 70; i++) {
        const x = rng() * W, base = H * (0.78 + rng() * 0.25), h = H * (0.05 + rng() * 0.1);
        g.beginPath(); g.moveTo(x, base - h); g.lineTo(x + h * 0.18, base); g.lineTo(x - h * 0.18, base); g.fill();
      }
    },
    animate(g, W, H, t, seed) {
      g.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 160; i++) {
        const sp = 0.05 + hash(i, seed) * 0.1;
        const y = frac(hash(i + 1, seed) + t * sp) * H;
        const x = hash(i + 2, seed) * W + Math.sin(t * 1.5 + i) * W * 0.01;
        const r = 1 + hash(i + 3, seed) * 2.5;
        g.fillRect(x, y, r, r);
      }
    },
  };

  // 10. 青空と雲
  S.sky = {
    label: "SKY", ja: "空",
    render(g, W, H, rng) {
      g.fillStyle = vgrad(g, 0, H, [[0, "#1663c9"], [0.6, "#7cc0ff"], [1, "#d7eeff"]]);
      g.fillRect(0, 0, W, H);
      glow(g, W * 0.85, H * 0.08, Math.max(W, H) * 0.4, "rgba(255,255,240,0.55)");
      for (let c = 0; c < 7; c++) {
        const cx = rng() * W, cy = H * (0.35 + rng() * 0.6), s = Math.min(W, H) * (0.06 + rng() * 0.08);
        for (let i = 0; i < 14; i++) {
          const x = cx + (rng() - 0.5) * s * 4, y = cy + (rng() - 0.7) * s * 1.2, r = s * (0.5 + rng() * 0.7);
          g.fillStyle = "#e3ecf7";
          g.beginPath(); g.arc(x, y + r * 0.15, r, 0, TAU); g.fill();
          g.fillStyle = "#ffffff";
          g.beginPath(); g.arc(x, y, r * 0.95, 0, TAU); g.fill();
        }
      }
    },
  };

  // 11. 花畑と夕焼け
  S.field = {
    label: "FIELD", ja: "花",
    render(g, W, H, rng) {
      const hz = H * 0.5;
      g.fillStyle = vgrad(g, 0, hz, [[0, "#5d7fc4"], [0.75, "#f2a983"], [1, "#ffd9a8"]]);
      g.fillRect(0, 0, W, hz);
      fillRidge(g, W, H, rng, hz + 2, H * 0.015, "#2c3f22", 0.7);
      g.fillStyle = vgrad(g, hz, H, [[0, "#556f2f"], [1, "#1c2e12"]]);
      g.fillRect(0, hz + 2, W, H - hz);
      const cols = ["#ffd84d", "#fff3c4", "#ff8fb1", "#ffb84d"];
      for (let i = 0; i < 2600; i++) {
        const k = Math.pow(rng(), 1.8);
        const y = hz + 4 + k * (H - hz);
        const r = 0.6 + k * Math.min(W, H) * 0.012;
        g.fillStyle = cols[(rng() * cols.length) | 0];
        g.globalAlpha = 0.5 + k * 0.5;
        g.beginPath(); g.arc(rng() * W, y, r, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    },
  };

  // 12. トンネルのナトリウム灯
  S.tunnel = {
    label: "TUNNEL", ja: "道",
    render(g, W, H, rng) {
      g.fillStyle = "#0d0805";
      g.fillRect(0, 0, W, H);
      const vx = W * 0.5, vy = H * 0.45;
      g.fillStyle = vgrad(g, vy, H, [[0, "#1c130b"], [1, "#3a2615"]]);
      g.beginPath(); g.moveTo(vx, vy); g.lineTo(W * 1.2, H); g.lineTo(-W * 0.2, H); g.fill();
      g.fillStyle = "#24180e";
      g.beginPath(); g.moveTo(vx, vy); g.lineTo(-W * 0.2, -H * 0.1); g.lineTo(-W * 0.2, H); g.fill();
      g.beginPath(); g.moveTo(vx, vy); g.lineTo(W * 1.2, -H * 0.1); g.lineTo(W * 1.2, H); g.fill();
      glow(g, vx, vy, Math.min(W, H) * 0.15, "rgba(255,200,120,0.6)");
    },
    animate(g, W, H, t, seed) {
      const vx = W * 0.5, vy = H * 0.45;
      g.globalCompositeOperation = "lighter";
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 14; i++) {
          const d = frac(i / 14 + t * 0.6);
          const [x, y, s] = persp(vx, vy, vx + side * W * 0.75, -H * 0.15, d);
          const r = 2 + s * Math.min(W, H) * 0.12;
          glow(g, x, y, r * 2.5, "rgba(255,150,50,0.5)");
          g.fillStyle = "rgba(255,220,160,0.95)";
          g.fillRect(x - r * 0.6, y - r * 0.12, r * 1.2, r * 0.24);
        }
      }
      g.globalCompositeOperation = "source-over";
    },
  };

  window.PROC_SCENES = S;
})();
