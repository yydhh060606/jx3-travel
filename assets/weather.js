/* =========================================================================
 * 江湖行纪 · 天气系统  —  晴 / 雨 / 雪 / 夜
 * Canvas 全屏粒子层：雨滴带风斜落+落底溅花；雪花带摆动+缓降+积聚感
 * 晴天：淡淡云影漂移 + 页头红日
 * 夜间：高处星子明灭 + 低处萤火浮沉（灯下读信的调子）
 * ========================================================================= */
(function () {
  'use strict';

  const canvas = document.getElementById('weather-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  let mode = 'sunny';          // sunny | rain | snow | night
  let wind = 0.6;              // 风向系数（-1 左 / 1 右）
  let raf = null;
  let drops = [], splashes = [], flakes = [], clouds = [], stars = [], flies = [];

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  /* ---------- 粒子播种 ---------- */
  function seed() {
    const area = W * H / 1000000;
    drops = Array.from({ length: Math.round(140 * area) + 60 }, () => spawnDrop(true));
    flakes = Array.from({ length: Math.round(90 * area) + 40 }, () => spawnFlake(true));
    stars = Array.from({ length: Math.round(58 * area) + 26 }, () => spawnStar());
    flies = Array.from({ length: Math.round(12 * area) + 7 }, () => spawnFly());
    clouds = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random() * W,
      y: 40 + Math.random() * (H * 0.35),
      r: 90 + Math.random() * 180,
      v: 0.08 + Math.random() * 0.18,
      a: 0.05 + Math.random() * 0.07,
    }));
  }
  function spawnDrop(anywhere) {
    return {
      x: Math.random() * (W + 200) - 100,
      y: anywhere ? Math.random() * H : -20 - Math.random() * 120,
      len: 12 + Math.random() * 16,
      v: 9 + Math.random() * 6,
      w: Math.random() * 0.8 + 0.4,
      o: 0.12 + Math.random() * 0.22,
    };
  }
  function spawnFlake(anywhere) {
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : -14 - Math.random() * 80,
      r: 1.2 + Math.random() * 2.6,
      v: 0.5 + Math.random() * 1.1,
      sway: Math.random() * Math.PI * 2,
      swayV: 0.008 + Math.random() * 0.014,
      swayA: 0.4 + Math.random() * 0.9,
      o: 0.35 + Math.random() * 0.5,
    };
  }
  function spawnStar() {
    return {
      x: Math.random() * W,
      y: Math.random() * H * 0.52,
      r: 0.5 + Math.random() * 1.0,
      p: Math.random() * Math.PI * 2,
      pv: 0.004 + Math.random() * 0.012,
      o: 0.16 + Math.random() * 0.40,
    };
  }
  function spawnFly() {
    return {
      x: Math.random() * W,
      y: H * 0.34 + Math.random() * H * 0.66,
      r: 1.3 + Math.random() * 1.7,
      vx: (Math.random() - 0.5) * 0.18,
      sway: Math.random() * Math.PI * 2,
      swayV: 0.005 + Math.random() * 0.012,
      swayA: 0.22 + Math.random() * 0.55,
      p: Math.random() * Math.PI * 2,
      pv: 0.010 + Math.random() * 0.020,
      o: 0.32 + Math.random() * 0.52,
    };
  }

  /* ---------- 绘制 ---------- */
  function drawClouds() {
    ctx.save();
    const rgb = mode === 'night' ? '150,172,192' : '120,118,112';
    clouds.forEach((c) => {
      c.x += c.v * (1 + Math.abs(wind) * 1.6);
      if (c.x - c.r > W) c.x = -c.r;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      g.addColorStop(0, 'rgba(' + rgb + ',' + c.a + ')');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  function drawRain() {
    ctx.save();
    ctx.lineCap = 'round';
    drops.forEach((d) => {
      d.x += wind * d.v * 0.55;   // 风斜
      d.y += d.v;
      if (d.y > H) {
        // 落底溅花
        if (Math.random() < 0.5) {
          splashes.push({ x: d.x, y: H - 2, r: 1, v: 0.8 + Math.random(), o: 0.35 });
        }
        Object.assign(d, spawnDrop(false));
      }
      if (d.x > W + 100) d.x = -80;
      ctx.strokeStyle = 'rgba(70,80,92,' + d.o + ')';
      ctx.lineWidth = d.w;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - wind * d.len * 0.55, d.y - d.len);
      ctx.stroke();
    });
    // 溅花（扩散圆环）
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i];
      s.r += s.v * 1.6; s.o -= 0.02;
      if (s.o <= 0) { splashes.splice(i, 1); continue; }
      ctx.strokeStyle = 'rgba(70,80,92,' + s.o + ')';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawSnow() {
    ctx.save();
    flakes.forEach((f) => {
      f.sway += f.swayV;
      f.x += Math.sin(f.sway) * f.swayA + wind * 0.35;
      f.y += f.v;
      if (f.y > H + 10 || f.x < -20 || f.x > W + 20) Object.assign(f, spawnFlake(false));
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 2.4);
      g.addColorStop(0, 'rgba(255,255,255,' + f.o + ')');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(f.o + 0.25, 1) + ')';
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.6, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  /* ---------- 夜：星子明灭 + 萤火浮沉 ---------- */
  function drawNight() {
    ctx.save();

    // 星子：只在上半空，缓慢明灭
    stars.forEach((s) => {
      s.p += s.pv;
      const a = s.o * (0.5 + 0.5 * Math.sin(s.p));
      if (a <= 0.02) return;
      ctx.fillStyle = 'rgba(232, 238, 241, ' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    });

    // 萤火：低空浮游，一呼一吸
    flies.forEach((f) => {
      f.sway += f.swayV;
      f.p += f.pv;
      f.x += Math.sin(f.sway) * f.swayA + f.vx;
      f.y -= 0.04 + Math.sin(f.p * 0.7) * 0.05;
      if (f.y < H * 0.22 || f.x < -40 || f.x > W + 40) Object.assign(f, spawnFly());

      const a = f.o * (0.35 + 0.65 * Math.abs(Math.sin(f.p)));
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 7);
      g.addColorStop(0, 'rgba(255, 228, 156, ' + (a * 0.86).toFixed(3) + ')');
      g.addColorStop(0.34, 'rgba(242, 198, 112, ' + (a * 0.26).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(242, 198, 112, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 7, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = 'rgba(255, 240, 196, ' + Math.min(a * 1.35, 1).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.55, 0, Math.PI * 2); ctx.fill();
    });

    ctx.restore();
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    drawClouds();
    if (mode === 'rain') drawRain();
    else if (mode === 'snow') drawSnow();
    else if (mode === 'night') drawNight();
    raf = requestAnimationFrame(frame);
  }

  /* ---------- 天气切换 ---------- */
  function setMode(next) {
    mode = next;
    document.body.classList.remove('w-sunny', 'w-rain', 'w-snow', 'w-night');
    document.body.classList.add('w-' + next);
    if (next === 'rain' && wind === 0.6) wind = 0.8;
    document.querySelectorAll('.wbtn').forEach((b) => {
      b.classList.toggle('is-on', b.dataset.weather === next);
    });
  }

  document.getElementById('weather').addEventListener('click', (e) => {
    const btn = e.target.closest('.wbtn');
    if (btn) setMode(btn.dataset.weather);
  });

  // 微风缓慢变化，粒子更有生命感
  setInterval(() => {
    if (mode === 'sunny' || mode === 'night') return;
    wind += (Math.random() - 0.5) * 0.3;
    wind = Math.max(-1.4, Math.min(1.4, wind));
  }, 2400);

  window.addEventListener('resize', resize);
  resize();
  // 支持 ?weather=rain/snow/night 直达（便于分享与验证）
  const q = new URLSearchParams(location.search).get('weather');
  setMode(['rain', 'snow', 'night'].includes(q) ? q : 'sunny');
  frame();
})();
