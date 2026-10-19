/* =========================================================================
 * 江湖行纪 · 声音
 * ---------------------------------------------------------------------
 * 一、背景音（bgm.mp3）：古筝 + 箫 + 碰铃，64 秒无缝循环，全站不停。
 *   浏览器不允许无交互自动播放，所以等第一次点击/按键才起乐，
 *   这不是"没做自动播放"，是硬限制。
 * 二、音效：tap 轻叩 / swish 翻页 / seal 落印 / unseal 拆封。
 *   用事件委托统一挂，不用每处按钮单独绑。
 *
 * 实现上用 Audio 元素而不是 Web Audio：前者在 file:// 下也能出声，
 * 后者要 fetch 解码，本地直接双击打开就没声了。
 * ========================================================================= */
(function () {
  'use strict';

  var KEY = 'jx3.sound.v1';
  var DIR = 'assets/audio/';
  var BGM_VOL = 0.32;

  // 音效表：音量都压得低，是"有反馈"而不是"吵"
  var SFX = {
    tap: { file: 'tap.mp3', vol: 0.30 },
    swish: { file: 'swish.mp3', vol: 0.26 },
    seal: { file: 'seal.mp3', vol: 0.34 },
    unseal: { file: 'unseal.mp3', vol: 0.38 }
  };

  var cfg = { bgm: true, sfx: true };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var o = JSON.parse(raw);
      if (o && typeof o === 'object') {
        if (typeof o.bgm === 'boolean') cfg.bgm = o.bgm;
        if (typeof o.sfx === 'boolean') cfg.sfx = o.sfx;
      }
    }
  } catch (e) { /* 隐私模式 / 沙箱：用默认值，不报错 */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  var unlocked = false;      // 是否已经拿到用户手势
  var bgm = null;            // Audio 元素
  var fading = 0;            // 淡入淡出的 rAF 句柄
  var pools = {};            // 音效池：同类音效可叠放
  var lastAt = {};           // 同类音效最小间隔，避免连点时糊成噪音

  /* ---------------------------------------------------------- 背景音 */
  function ensureBgm() {
    if (bgm) return bgm;
    bgm = new Audio(DIR + 'bgm.mp3');
    bgm.loop = true;
    bgm.preload = 'auto';
    bgm.volume = 0;
    bgm.setAttribute('playsinline', '');
    // 加载失败（文件缺失、离线）时安静收场，不弹错
    bgm.addEventListener('error', function () { bgm = null; });
    return bgm;
  }

  function fadeTo(target, ms) {
    if (!bgm) return;
    if (fading) cancelAnimationFrame(fading);
    var from = bgm.volume;
    var t0 = performance.now();
    function step(t) {
      var k = Math.min(1, (t - t0) / ms);
      // 缓入缓出，别让音量线性爬升显得机械
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      bgm.volume = Math.max(0, Math.min(1, from + (target - from) * e));
      if (k < 1) fading = requestAnimationFrame(step);
      else fading = 0;
    }
    fading = requestAnimationFrame(step);
  }

  function startBgm() {
    if (!cfg.bgm || !unlocked) return;
    var el = ensureBgm();
    if (!el) return;
    var p = el.play();
    if (p && p.then) {
      p.then(function () { fadeTo(BGM_VOL, 1600); }).catch(function () {
        // 仍被拦截（例如用户关了站点声音）：把按钮打成静音态，给个交代
        setBgm(false, true);
      });
    } else {
      fadeTo(BGM_VOL, 1600);
    }
  }

  function stopBgm(ms) {
    if (!bgm) return;
    fadeTo(0, ms || 420);
    setTimeout(function () {
      if (bgm && bgm.volume < 0.01) bgm.pause();
    }, (ms || 420) + 40);
  }

  /* ---------------------------------------------------------- 音效 */
  function playSfx(kind) {
    if (!unlocked || !cfg.sfx) return;
    var def = SFX[kind];
    if (!def) return;
    var now = performance.now();
    if (lastAt[kind] && now - lastAt[kind] < 55) return;
    lastAt[kind] = now;

    var pool = pools[kind];
    if (!pool) {
      pool = pools[kind] = [];
      for (var i = 0; i < 3; i++) {
        var a = new Audio(DIR + def.file);
        a.preload = 'auto';
        a.volume = def.vol;
        pool.push(a);
      }
    }
    // 找一条空闲的，实在都在响就抢第一条
    var pick = pool.filter(function (a) { return a.paused || a.ended; })[0] || pool[0];
    try {
      pick.currentTime = 0;
      var p = pick.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  /* ---------------------------------------------------------- 开关 UI */
  var btn = null;
  function paintBtn() {
    if (!btn) return;
    var on = cfg.bgm;
    btn.textContent = on ? '音' : '静';
    btn.classList.toggle('is-off', !on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? '背景音：开，点击关闭' : '背景音：关，点击开启');
    btn.title = on ? '背景音：开' : '背景音：关';
  }

  function setBgm(on, silent) {
    cfg.bgm = !!on;
    save();
    paintBtn();
    if (cfg.bgm) {
      if (unlocked) startBgm();
    } else {
      stopBgm(silent ? 200 : 500);
    }
  }

  /* ---------------------------------------------------------- 解锁
   * 第一次真实手势才能起乐。用 pointerdown 而不是 click：
   * 按下就出声，反馈更跟手，也顺带满足浏览器的自动播放策略。
   */
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (btn) btn.classList.remove('is-await');
    startBgm();
  }

  /* ---------------------------------------------------------- 绑定 */
  function bind() {
    btn = document.getElementById('sound-btn');
    if (btn) {
      paintBtn();
      // 还没起乐时按钮是"待解锁"态，提示点一下就有声
      if (cfg.bgm) btn.classList.add('is-await');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        unlock();
        setBgm(!cfg.bgm);
        // 开的那一下给一记轻叩，确认真的有声
        setTimeout(function () { playSfx('tap'); }, 60);
      });
    }

    // 手势解锁：一次就够，之后解绑
    function onGesture() {
      unlock();
      document.removeEventListener('pointerdown', onGesture, true);
      document.removeEventListener('keydown', onGesture, true);
    }
    document.addEventListener('pointerdown', onGesture, true);
    document.addEventListener('keydown', onGesture, true);

    // 全站音效：事件委托，后加的按钮也自动有声音
    document.addEventListener('pointerdown', function (e) {
      if (!cfg.sfx) return;
      var el = e.target.closest && e.target.closest('[data-sfx], button, a, [role="button"]');
      if (!el) return;
      var kind = el.getAttribute('data-sfx');
      if (!kind) {
        // 只有视图切换那一排用翻页声；天气、按钮一律轻叩
        var isView = el.classList.contains('vbtn') || el.hasAttribute('data-view');
        kind = isView ? 'swish' : 'tap';
      }
      playSfx(kind);
    }, true);

    // 切到后台就停，回来再淡入——省电，也避免"看不见还在响"
    document.addEventListener('visibilitychange', function () {
      if (!bgm || !cfg.bgm) return;
      if (document.hidden) {
        bgm.pause();
      } else if (unlocked && bgm.paused) {
        startBgm();
      }
    });

    // 页面整体卸载前松手，避免 iOS 上音频会话残留
    window.addEventListener('pagehide', function () {
      if (bgm) { bgm.pause(); }
    });
  }

  var Sound = {
    get bgmOn() { return cfg.bgm; },
    get sfxOn() { return cfg.sfx; },
    toggle: function () { setBgm(!cfg.bgm); },
    setBgm: setBgm,
    setSfx: function (on) { cfg.sfx = !!on; save(); },
    sfx: playSfx,
    unlock: unlock,
    // 自检用：外部只能读状态，改不了
    _state: function () {
      return {
        unlocked: unlocked, cfg: { bgm: cfg.bgm, sfx: cfg.sfx },
        bgm: bgm ? { paused: bgm.paused, t: +bgm.currentTime.toFixed(2), vol: +bgm.volume.toFixed(2),
                     ready: bgm.readyState, err: bgm.error ? bgm.error.code : 0 } : null,
        sfxPools: Object.keys(pools).map(function (k) { return k + ':' + pools[k].length; })
      };
    }
  };
  window.Sound = Sound;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();
