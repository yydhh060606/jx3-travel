/* =========================================================================
 * 江湖行纪 · 剑网三门派旅行图鉴  —  江湖来信：拆封交互
 * 信封 → 揭开火漆 → 信封退场 → 信笺展开
 * ========================================================================= */
(function () {
  'use strict';

  var section = document.getElementById('letter');
  var envelope = document.getElementById('envelope');
  var btn = document.getElementById('letter-btn');
  var missive = document.getElementById('missive');
  if (!section || !btn || !missive) return;

  function set(open) {
    section.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? '收　起' : '拆　阅';
    // 合着时信笺不可见，也不该被读屏读到
    missive.setAttribute('aria-hidden', String(!open));
    if (envelope) envelope.setAttribute('aria-hidden', String(open));
  }

  function isOpen() { return section.classList.contains('is-open'); }

  btn.addEventListener('click', function () { set(!isOpen()); });

  if (envelope) {
    envelope.addEventListener('click', function () { if (!isOpen()) set(true); });
  }

  // 键盘：Esc 收起
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) {
      set(false);
      btn.focus();
    }
  });

  // 深链：?letter=open 直接展开
  if (new URLSearchParams(location.search).get('letter') === 'open') {
    set(true);
  }
})();
