/* =========================================================================
 * 江湖行纪 · 剑网三门派旅行图鉴  —  交互逻辑
 * ========================================================================= */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);

  // 筛选状态
  const state = { region: '全部', role: '全部', school: '全部', journey: '全部', q: '' };
  const GROUPS = [
    { key: 'region', label: '地域', order: REGION_ORDER, field: 'region' },
    { key: 'role', label: '门派定位', order: ROLE_ORDER, field: 'role' },
    { key: 'school', label: '门派', order: null, field: 'school' },
  ];
  const JOURNEY_ORDER = ['全部', '已行', '愿往', '未行'];

  /* ---------- 存储层：localStorage 不可用时退回内存 ----------
   * 三种情况会让 localStorage 直接抛 SecurityError 而不是静默失败：
   * 沙箱 iframe（内置预览面板就是）、隐私模式、跨源限制；配额写满则是 QuotaExceededError。
   * 以前把这些一律当「写不进去」红字报错，用户就卡在存不下这一步。
   * 现在先探一次可用性：不可用就存进内存，功能照常能玩，只是在界面上如实说明「仅此一窗」。
   */
  const store = (() => {
    const mem = new Map();
    let ls = null;
    try {
      const probe = '__jx3_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      ls = window.localStorage;
    } catch (e) { ls = null; }
    let volatile = !ls;          // true = 内容只活在这一个窗口
    return {
      get volatile() { return volatile; },
      read(key) {
        if (ls) {
          try {
            const v = ls.getItem(key);
            if (v !== null) return v;
          } catch (e) { ls = null; volatile = true; }
        }
        return mem.has(key) ? mem.get(key) : null;
      },
      write(key, raw) {
        mem.set(key, raw);       // 内存里总留一份，写盘失败也不丢当前这次浏览
        if (!ls) return false;
        try { ls.setItem(key, raw); return true; }
        catch (e) { volatile = true; return false; }   // 配额满：降级为内存
      },
    };
  })();

  /* 存储不可用时给一条可关掉的说明，免得存了东西、刷新才发现没了 */
  function showStoreTip() {
    if (!store.volatile || document.querySelector('.store-tip')) return;
    const tip = document.createElement('div');
    tip.className = 'store-tip';
    tip.setAttribute('role', 'status');
    tip.innerHTML =
      '<p class="store-tip__tx">这个窗口禁用了本地存储（内置预览的沙箱、隐私模式或站点设置都会如此）。'
      + '标「已行 / 愿往」、留言、自拟行程只在此次浏览有效，刷新即清空；'
      + '想留住它们，请用浏览器新窗口直接打开 <b>index.html</b>。</p>'
      + '<button class="store-tip__x" type="button">知道了</button>';
    document.body.appendChild(tip);
    tip.querySelector('.store-tip__x').addEventListener('click', () => tip.remove());
  }

  /* ---------- 我的行旅：本地收藏（已行 / 愿往） ---------- */
  const J_KEY = 'jx3.journey.v1';
  const journey = { done: new Set(), wish: new Set() };

  // id → 去处，路线与留言都要按 id 反查
  const DEST_BY_ID = {};
  DESTINATIONS.forEach((d) => { DEST_BY_ID[d.id] = d; });

  function loadJourney() {
    try {
      const raw = JSON.parse(store.read(J_KEY) || '{}');
      const ids = new Set(DESTINATIONS.map((d) => d.id));
      (raw.done || []).forEach((id) => { if (ids.has(id)) journey.done.add(id); });
      (raw.wish || []).forEach((id) => { if (ids.has(id)) journey.wish.add(id); });
    } catch (e) { /* 隐私模式或数据损坏：静默降级为未标记 */ }
    // 同一处不能既已行又愿往
    journey.wish.forEach((id) => journey.done.delete(id));
  }
  function saveJourney() {
    store.write(J_KEY, JSON.stringify({
      done: [...journey.done], wish: [...journey.wish],
    }));
  }
  function markOf(id) {
    if (journey.done.has(id)) return 'done';
    if (journey.wish.has(id)) return 'wish';
    return '';
  }
  function setMark(id, mark) {
    journey.done.delete(id);
    journey.wish.delete(id);
    if (mark === 'done') journey.done.add(id);
    else if (mark === 'wish') journey.wish.add(id);
    saveJourney();
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function schoolColor(name) {
    return (SCHOOLS[name] && SCHOOLS[name].color) || '#6b4a8a';
  }
  // 定位：主定位给卡片小签，全部定位给筛选（明教这类双心法门派两职都算）
  function schoolRole(name) {
    return ROLE_OF(name);
  }
  function schoolRoles(name) {
    return ROLES_OF(name);
  }
  function schoolChi(name) {
    return (SCHOOLS[name] && SCHOOLS[name].chi) || [];
  }
  // small=true 取 160px 缩略（卡片上只有 52px，不必下整张立绘）
  function schoolPortrait(name, small) {
    const key = PORTRAITS && PORTRAITS[name];
    if (!key) return '';
    return 'assets/img/school/' + key + (small ? '-sm' : '') + '.webp';
  }
  // 图片统一走 WebP；万一某张缺失，onerror 里回落到同名 .jpg
  function toWebp(path) {
    return /\.jpe?g$/i.test(path) ? path.replace(/\.jpe?g$/i, '.webp') : path;
  }

  /* ---------- 筛选 chips（带数量角标） ---------- */
  function journeyCounts(v) {
    const t = DESTINATIONS.length;
    if (v === '已行') return journey.done.size;
    if (v === '愿往') return journey.wish.size;
    if (v === '未行') return t - journey.done.size;
    return t;
  }

  function buildChips() {
    const filters = $('#filters');
    filters.innerHTML = GROUPS.map((g) => {
      const counts = {};
      DESTINATIONS.forEach((d) => {
        // 定位按「可担任的定位」计数：一间门派有两门心法时，两种定位各算一次
        const keys = g.key === 'role' ? schoolRoles(d.school) : [d[g.field]];
        keys.forEach((key) => { if (key) counts[key] = (counts[key] || 0) + 1; });
      });
      let values = g.order ? g.order : Object.keys(counts);
      values = ['全部', ...values];
      const chips = values.map((v) => {
        const n = v === '全部' ? DESTINATIONS.length : (counts[v] || 0);
        const pressed = state[g.key] === v;
        return `<button class="chip" data-group="${g.key}" data-value="${escapeHTML(v)}" aria-pressed="${pressed}">${escapeHTML(v)}<span class="n">${n}</span></button>`;
      }).join('');
      return `<div class="fgroup"><span class="fgroup__label">${g.label}</span><div class="chips">${chips}</div></div>`;
    }).join('');

    // 行旅分组：数量随收藏变化，需要单独重绘
    filters.insertAdjacentHTML('beforeend', `
      <div class="fgroup fgroup--journey">
        <span class="fgroup__label">行旅</span>
        <div class="chips" id="jchips">${journeyChipsHTML()}</div>
      </div>`);
  }

  function journeyChipsHTML() {
    return JOURNEY_ORDER.map((v) => {
      const pressed = state.journey === v;
      return `<button class="chip" data-group="journey" data-value="${v}" aria-pressed="${pressed}">${v}<span class="n">${journeyCounts(v)}</span></button>`;
    }).join('');
  }

  function repaintJourneyChips() {
    const box = $('#jchips');
    if (box) box.innerHTML = journeyChipsHTML();
  }

  function syncChips() {
    $('#filters').querySelectorAll('.chip').forEach((b) => {
      b.setAttribute('aria-pressed', String(state[b.dataset.group] === b.dataset.value));
    });
  }

  /* ---------- 过滤 ---------- */
  function filtered() {
    const q = state.q.trim().toLowerCase();
    return DESTINATIONS.filter((d) => {
      if (state.region !== '全部' && d.region !== state.region) return false;
      if (state.role !== '全部' && schoolRoles(d.school).indexOf(state.role) === -1) return false;
      if (state.school !== '全部' && d.school !== state.school) return false;
      if (state.journey === '已行' && !journey.done.has(d.id)) return false;
      if (state.journey === '愿往' && !journey.wish.has(d.id)) return false;
      if (state.journey === '未行' && journey.done.has(d.id)) return false;
      if (q) {
        const hay = [d.city, d.alias, d.province, d.region, d.school, d.era, d.verse, d.blurb, d.origin, d.tip, d.spots.join(' ')].join(' ').toLowerCase();
        // 空格分词取交集
        if (!q.split(/\s+/).every((t) => hay.includes(t))) return false;
      }
      return true;
    });
  }

  /* ---------- 卡片渲染 ---------- */
  // 行旅小印：已行 = 朱砂实印，愿往 = 素墨空印
  const MARK_TEXT = { done: ['已', '行'], wish: ['愿', '往'] };
  function markHTML(id) {
    const m = markOf(id);
    if (!m) return '';
    const [a, b] = MARK_TEXT[m];
    return `<span class="card__mark card__mark--${m}" aria-hidden="true"><i>${a}</i><i>${b}</i></span>`;
  }

  // 只重绘印面，不重建整张卡片（避免入场动画重播、焦点丢失）
  function paintMarks() {
    document.querySelectorAll('.card').forEach((card) => {
      const media = card.querySelector('.card__media');
      if (!media) return;
      const old = media.querySelector('.card__mark');
      const html = markHTML(card.dataset.id);
      if (!html) { if (old) old.remove(); return; }
      const tmp = document.createElement('span');
      tmp.innerHTML = html;
      const fresh = tmp.firstElementChild;
      if (old) old.replaceWith(fresh);
      else media.appendChild(fresh);
    });
  }

  /* ---------- 行旅进度：卷首计数 + 卡片区进度条 + 筛选角标 ---------- */
  function paintJourneyCount() {
    const b = document.querySelector('#stats .hero__stats-j b');
    if (b) b.textContent = journey.done.size;
  }

  function paintBoard() {
    const box = $('#journey');
    if (!box) return;
    const d = journey.done.size, w = journey.wish.size, t = DESTINATIONS.length;
    if (!d && !w) {
      box.innerHTML = '<span class="jr jr--hint">未落印 · 详情页可记「已行 / 愿往」</span>';
      return;
    }
    const pct = t ? Math.round((d / t) * 100) : 0;
    box.innerHTML = `
      <span class="jr"><b>${d}</b>处已行</span>
      <span class="jr"><b>${w}</b>处愿往</span>
      <span class="jrbar" role="img" aria-label="已行 ${d} 处，占 ${pct}%"><i style="width:${pct}%"></i></span>`;
  }

  function syncJourney(opts) {
    repaintJourneyChips();
    paintBoard();
    paintJourneyCount();
    if (opts && opts.rerender) render();
    else paintMarks();
  }

  function cardHTML(d) {
    const color = schoolColor(d.school);
    const portrait = schoolPortrait(d.school, true);
    return `
      <article class="card" data-id="${d.id}" tabindex="0" role="button"
               aria-label="${escapeHTML(d.city)} · ${escapeHTML(d.school)}"
               style="--accent:${color}">
        <div class="card__media">
          <img class="card__img" src="${escapeHTML(toWebp(d.image))}" alt="${escapeHTML(d.city)}·${escapeHTML(d.school)}实景"
               loading="lazy" decoding="async" onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src=this.src.replace('.webp','.jpg');}else{this.classList.add('is-broken');this.removeAttribute('src');}">
          ${portrait ? `<img class="card__ava" src="${portrait}" alt="${escapeHTML(d.school)}立绘" loading="lazy" decoding="async"
               onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src=this.src.replace('-sm.webp','.jpg');}else{this.remove();}">` : ''}
          <span class="card__school">${escapeHTML(d.school)}</span>
          <span class="card__role" title="心法：${escapeHTML(schoolChi(d.school).map(([n, r]) => n + '（' + r + '）').join(' · '))}">${escapeHTML(schoolRoles(d.school).join('·'))}</span>
          ${markHTML(d.id)}
          <span class="card__schoolname">${escapeHTML(d.school)}</span>
        </div>
        <div class="card__body">
          <div class="card__main">
            <div class="card__head">
              <h2 class="card__city">${escapeHTML(d.city)}</h2>
              <span class="card__alias">${escapeHTML(d.alias)}</span>
            </div>
            <p class="card__meta">${escapeHTML(d.province)} · ${escapeHTML(d.region)} · ${escapeHTML(d.era)}</p>
            <p class="card__blurb">${escapeHTML(d.blurb)}</p>
          </div>
          <p class="card__vverse">${escapeHTML(d.verse)}</p>
        </div>
      </article>`;
  }

  /* ---------- 侠客留言 ----------
   * 在线：全部来自云端（cloud.js 的四个函数），任何人写，任何人看得见。
   * 离线：退回本机存储（C_KEY / CL_KEY），界面明说"只有这一台看得见"。
   * 两条路的行数据在这里归一化成同一副样子，上层渲染不用分叉。
   */
  const C_KEY = 'jx3.comments.v1';      // 本机留言 { destId: [ {cid,name,school,text,ts,likes} ] }
  const CU_KEY = 'jx3.commenter.v1';    // 上次落款 { name, school }
  const CL_KEY = 'jx3.likes.v1';        // 本机赞 { 'destId:cid': 1 }

  let cmOnline = false;                 // 云端是否可用
  let cmRows = [];                      // 云端全量留言（含 destId），在线时唯一数据源
  let cmLastError = '';

  function readJSON(key, fallback) {
    try {
      const v = JSON.parse(store.read(key) || 'null');
      return v === null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { store.write(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }   // 只有数据本身无法序列化才走到这里
  }

  let userComments = readJSON(C_KEY, {});
  let likedMap = readJSON(CL_KEY, {});
  let commenter = readJSON(CU_KEY, { name: '', school: '' });
  let pendingDel = null;

  /* ---------- 落籍：名号 + 门派，存在本机；云端只认它的哈希 ---------- */
  function ident() {
    return (window.JHCloud && JHCloud.ident()) || null;
  }

  function paintIdCard() {
    const card = $('#idcard');
    const me = ident();
    if (card) {
      card.classList.toggle('is-on', !!me);
      card.querySelector('.idcard__ava').textContent = me ? me.name.slice(0, 1) : '未';
      card.querySelector('.idcard__name').textContent = me
        ? (me.school ? me.name + ' · ' + me.school : me.name)
        : '未入籍';
      card.querySelector('.idcard__hint').textContent = me ? '点此换个名号' : '点此报名号与门派';
    }
    // 表单里的名号 / 门派跟着锁死，避免"卡片是一个名、表单是另一个名"
    const nameEl = $('#cmt-name');
    const schoolEl = $('#cmt-school');
    if (nameEl) {
      nameEl.value = me ? me.name : (commenter.name || '');
      nameEl.disabled = !!me;
    }
    if (schoolEl && me) {
      schoolEl.value = me.school;
      schoolEl.disabled = true;
    } else if (schoolEl) {
      schoolEl.disabled = false;
    }
  }

  let identAfter = null;   // 落籍之后接着做的那件事（通常是"把这条留言发出去"）

  function openIdent(after) {
    identAfter = typeof after === 'function' ? after : null;
    const box = $('#ident');
    if (!box) return;
    const me = ident();
    const nameEl = $('#ident-name');
    const schoolEl = $('#ident-school');
    const errEl = $('#ident-err');
    if (schoolEl && !schoolEl.options.length) {
      schoolEl.innerHTML = Object.keys(SCHOOLS).map((s) => (
        `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`
      )).join('');
    }
    if (nameEl) {
      nameEl.value = me ? me.name : (commenter.name || '');
      nameEl.classList.remove('is-err');
    }
    if (schoolEl) schoolEl.value = me ? me.school : (commenter.school || '天策');
    if (errEl) errEl.textContent = '';
    box.hidden = false;
    lockScroll();
    if (window.Sound) Sound.sfx('swish');
    setTimeout(() => { if (nameEl) nameEl.focus(); }, 80);
  }

  function closeIdent() {
    const box = $('#ident');
    if (box) box.hidden = true;
    identAfter = null;
    const detail = $('#modal');
    if (!detail || detail.hidden) unlockScroll();
  }

  function bindIdent() {
    const box = $('#ident');
    if (!box) return;
    const card = $('#idcard');
    if (card) card.addEventListener('click', () => openIdent());
    box.addEventListener('click', (e) => {
      if (e.target.closest('[data-ident-close]')) closeIdent();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !box.hidden) closeIdent();
    });
    const form = $('#ident-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameEl = $('#ident-name');
      const schoolEl = $('#ident-school');
      const errEl = $('#ident-err');
      const name = (nameEl.value || '').trim();
      if (name.length < 2) {
        nameEl.classList.add('is-err');
        errEl.textContent = '名号至少两个字，不然不好称呼。';
        nameEl.focus();
        return;
      }
      JHCloud.enrol(name, schoolEl.value);
      paintIdCard();
      if (window.Sound) Sound.sfx('seal');
      const after = identAfter;
      closeIdent();
      if (after) after();
    });
    // 输入即清错
    $('#ident-name').addEventListener('input', (e) => {
      e.target.classList.remove('is-err');
      $('#ident-err').textContent = '';
    });
  }

  /* ---------- 云端留言：拉取 / 重绘 ---------- */
  function remoteRow(r) {
    return {
      cid: String(r.id),
      destId: r.dest_id,
      name: r.name,
      school: r.school,
      text: r.body,
      ts: r.created_at,
      likes: r.likes || 0,
      mine: !!r.mine,
      liked: !!r.liked,
      remote: true
    };
  }

  // 云端只认一个域名（发布域名），换到别的地址打开就只剩本机留言
  const CANON = 'https://jx3-travel.app.workbuddy.host/';

  function paintCloudTip() {
    const tip = $('#cmt-cloud');
    if (!tip) return;
    if (cmOnline) { tip.classList.remove('is-on'); tip.textContent = ''; return; }
    tip.classList.add('is-on');
    const why = cmLastError ? '（' + cmLastError + '）' : '';
    let html = `云端留言没连上${why}。现在显示的是本机留言，别人看不到你写的。`;
    if (location.origin !== CANON.replace(/\/$/, '')) {
      html += ` 想看全站的留言，请到 <a href="${CANON}" rel="noopener">${CANON.replace('https://', '')}</a>。`;
    }
    tip.innerHTML = html;
  }

  async function refreshComments() {
    if (!window.JHCloud || !JHCloud.available) {
      cmOnline = false;
      cmLastError = '云端脚本没加载出来';
      paintCloudTip();
      return;
    }
    const res = await JHCloud.list();
    if (res.ok && Array.isArray(res.data)) {
      cmOnline = true;
      cmLastError = '';
      cmRows = res.data.map(remoteRow);
    } else {
      cmOnline = false;
      cmLastError = res.error || '';
    }
    paintCloudTip();
    paintCommentsEverywhere();
  }

  // 云端数据变了以后，把看得见的几处一起重画
  function paintCommentsEverywhere() {
    const total = cmtCounts().total;
    ['#cmt-total', '#foot-cmt-n'].forEach((sel) => {
      const el = $(sel);
      if (el) el.textContent = total;
    });
    const board = $('#cmt-list');
    if (board) renderCmtBoard();
    const openId = $('#modal').hidden ? null : currentDetailId;
    if (openId) repaintComments(openId);
  }

  function todayStr() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  // 相对时间：近 30 天说「N 天前」，再往前按月，超过一年直接给日期
  function relTime(ts) {
    if (!ts) return '';
    // 云端给的是 ISO（2026-10-12T00:00:00+08:00），本机存的是 2026-10-12
    let t = Date.parse(ts);
    if (isNaN(t)) t = new Date(String(ts).replace(/-/g, '/')).getTime();
    if (isNaN(t)) return ts;
    const days = Math.floor((Date.now() - t) / 86400000);
    if (days <= 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 30) return days + ' 天前';
    if (days < 365) return Math.floor(days / 30) + ' 个月前';
    return ts;
  }
  // 某一处的留言。在线时全部来自云端；离线时退回本机那份
  function listComments(id) {
    if (cmOnline) return cmRows.filter((c) => c.destId === id);
    const seed = (SEED_COMMENTS[id] || []).map((c, i) => Object.assign({ mine: false }, c, { cid: 's' + i }));
    const mine = (userComments[id] || []).map((c) => Object.assign({ mine: true }, c));
    return mine.concat(seed).sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  }
  function schoolOptions(id, prefer) {
    const d = DEST_BY_ID[id];
    const cur = prefer || commenter.school || (d && d.school) || '天策';
    return Object.keys(SCHOOLS).map((n) => (
      `<option value="${escapeHTML(n)}"${n === cur ? ' selected' : ''}>${escapeHTML(n)}</option>`
    )).join('');
  }

  function commentHTML(c, id) {
    const key = id + ':' + c.cid;
    const on = c.remote ? !!c.liked : !!likedMap[key];
    const n = c.remote ? (c.likes || 0) : (c.likes || 0) + (on ? 1 : 0);
    return `
      <li class="cm${c.mine ? ' cm--mine' : ''}" data-cid="${escapeHTML(c.cid)}">
        <span class="cm__ava" style="--c:${schoolColor(c.school)}" aria-hidden="true">${escapeHTML(String(c.school).slice(0, 1))}</span>
        <div class="cm__body">
          <p class="cm__top">
            <b class="cm__name">${escapeHTML(c.name)}</b>
            <span class="cm__school">${escapeHTML(c.school)}</span>
            <time class="cm__time" datetime="${escapeHTML(c.ts)}">${escapeHTML(relTime(c.ts))}</time>
          </p>
          <p class="cm__text">${escapeHTML(c.text)}</p>
          <p class="cm__acts">
            <button class="cm__like${on ? ' is-on' : ''}" type="button" data-like="${escapeHTML(c.cid)}" data-base="${c.likes || 0}" aria-pressed="${on}" aria-label="赞同这条留言">赞 <b>${n}</b></button>
            <button class="cm__del" type="button" data-del="${escapeHTML(c.cid)}"${c.mine ? '' : ' hidden'}>删去</button>
            <button class="cm__report" type="button" data-report="${escapeHTML(c.cid)}" title="举报这条留言">举报</button>
          </p>
        </div>
      </li>`;
  }

  function commentsHTML(id) {
    const list = listComments(id);
    const me = ident();
    const items = list.length
      ? list.map((c) => commentHTML(c, id)).join('')
      : '<li class="cm-empty">这一处还没有人留言，来做第一个。</li>';
    return `
      <div class="m-section m-section--cm">
        <h3>侠客留言<span class="cm__count">${list.length}</span></h3>
        <form class="cm-form" id="cm-form" novalidate>
          <div class="cm-form__row">
            <input class="cm-form__name" name="name" type="text" maxlength="10" autocomplete="nickname"
                   placeholder="你的江湖名号" aria-label="昵称"
                   value="${escapeHTML(me ? me.name : (commenter.name || ''))}"${me ? ' disabled' : ''} />
            <select class="cm-form__school" name="school" aria-label="门派"${me ? ' disabled' : ''}>${schoolOptions(id, me && me.school)}</select>
          </div>
          <textarea class="cm-form__text" name="text" rows="2" maxlength="140"
                    placeholder="说说这处地方 —— 路怎么走、什么时候去、值不值得。" aria-label="留言内容"></textarea>
          <div class="cm-form__foot">
            <span class="cm-form__count"><b>0</b>/140</span>
            <span class="cm-form__hint" role="status" aria-live="polite"></span>
            <button class="cm-form__send" type="submit">落　款</button>
          </div>
        </form>
        <ul class="cm-list" id="cm-list">${items}</ul>
        <p class="cm-note">留言写在云端，人人都看得见；删去只认你这台设备。</p>
      </div>`;
  }

  // 只重绘列表，不重建表单（避免抢走正在输入的焦点）
  function repaintComments(id) {
    const ul = $('#cm-list');
    if (!ul) return;
    const list = listComments(id);
    ul.innerHTML = list.length
      ? list.map((c) => commentHTML(c, id)).join('')
      : '<li class="cm-empty">这一处还没有人留言，来做第一个。</li>';
    const cnt = $('.m-section--cm .cm__count');
    if (cnt) cnt.textContent = list.length;
  }

  function mountComments(id, panel) {
    const box = panel.querySelector('#m-comments');
    if (!box) return;
    box.innerHTML = commentsHTML(id);

    const form = box.querySelector('#cm-form');
    const nameEl = box.querySelector('.cm-form__name');
    const schoolEl = box.querySelector('.cm-form__school');
    const textEl = box.querySelector('.cm-form__text');
    const countEl = box.querySelector('.cm-form__count b');
    const hintEl = box.querySelector('.cm-form__hint');

    const say = (msg, bad) => {
      hintEl.textContent = msg;
      hintEl.classList.toggle('is-bad', !!bad);
    };

    textEl.addEventListener('input', () => {
      countEl.textContent = textEl.value.length;
      say('');
    });
    nameEl.addEventListener('input', () => {
      nameEl.classList.remove('is-err');
      say('');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = textEl.value.trim();
      const me = ident();
      if (!me) { openIdent(() => form.requestSubmit()); return; }
      if (!text) { textEl.focus(); say('还没写内容。', true); return; }

      const btn = form.querySelector('.cm-form__send');
      btn.disabled = true;

      if (cmOnline) {
        const res = await JHCloud.add(id, text.slice(0, 140));
        btn.disabled = false;
        if (!res.ok) { say(res.error, true); return; }
        const raw = Array.isArray(res.data) ? res.data[0] : res.data;
        const row = remoteRow(raw);
        row.mine = true;
        row.liked = false;
        cmRows.unshift(row);
      } else {
        const rec = {
          cid: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          name: me.name.slice(0, 10),
          school: me.school,
          text: text.slice(0, 140),
          ts: todayStr(),
          likes: 0,
        };
        (userComments[id] = userComments[id] || []).push(rec);
        if (!writeJSON(C_KEY, userComments)) {
          userComments[id].pop();
          btn.disabled = false;
          say('留言没能存下：数据本身有问题，刷新后再试一次。', true);
          return;
        }
        btn.disabled = false;
      }

      textEl.value = '';
      countEl.textContent = '0';
      repaintComments(id);
      say(cmOnline ? '已落款。' : (store.volatile ? '已落款，仅此一窗。' : '已落款，但只在本机。'));
      // 让新留言出现在视野里
      const first = box.querySelector('#cm-list .cm');
      if (first) first.scrollIntoView({ block: 'nearest' });
    });

    // 赞 / 删 / 举报：事件委托，重绘列表后依然有效
    box.addEventListener('click', (e) => {
      const rep = e.target.closest('[data-report]');
      if (rep) {
        if (!ident()) { openIdent(); return; }
        if (!cmOnline) { say('本机留言不必举报。'); return; }
        rep.disabled = true;
        JHCloud.report(rep.dataset.report).then((res) => {
          rep.disabled = false;
          say(res.ok ? '已报官，多谢。' : res.error, !res.ok);
        });
        return;
      }

      const like = e.target.closest('.cm__like');
      if (like) {
        const cid = like.dataset.like;
        const row = cmRows.find((c) => c.remote && c.cid === cid);
        if (row) {
          like.disabled = true;
          JHCloud.like(cid).then((res) => {
            like.disabled = false;
            if (!res.ok) { say(res.error, true); return; }
            row.liked = !!res.data.liked;
            row.likes = res.data.likes;
            repaintComments(id);
          });
          return;
        }
        const key = id + ':' + cid;
        const on = !like.classList.contains('is-on');
        if (on) likedMap[key] = 1; else delete likedMap[key];
        writeJSON(CL_KEY, likedMap);
        like.classList.toggle('is-on', on);
        like.setAttribute('aria-pressed', String(on));
        like.querySelector('b').textContent = Number(like.dataset.base) + (on ? 1 : 0);
        return;
      }

      const del = e.target.closest('.cm__del');
      if (del && !del.hidden) {
        const cid = del.dataset.del;
        if (pendingDel === cid) {
          pendingDel = null;
          const row = cmRows.find((c) => c.remote && c.cid === cid);
          if (row) {
            JHCloud.del(cid).then((res) => {
              if (!res.ok) { say(res.error, true); return; }
              cmRows = cmRows.filter((c) => c !== row);
              repaintComments(id);
              say('已删去。');
            });
            return;
          }
          userComments[id] = (userComments[id] || []).filter((c) => c.cid !== cid);
          writeJSON(C_KEY, userComments);
          repaintComments(id);
          say('已删去。');
        } else {
          pendingDel = cid;
          del.textContent = '确定删去？';
          del.classList.add('is-ask');
          setTimeout(() => {
            if (pendingDel === cid) {
              pendingDel = null;
              del.textContent = '删去';
              del.classList.remove('is-ask');
            }
          }, 3000);
        }
      }
    });
  }

  /* ---------- 江湖客话：全站留言板 ----------
   * 与详情弹层里的留言共用一份存储（C_KEY / CL_KEY）。
   * 弹层按「这一处」看，留言板按「所有去处 + 全书」看，两边改动互相同步。
   */
  const CM_ALL = '_general';   // 不属于某一处的全书留言
  const cmtState = { scope: 'all', sort: 'new', city: 'all' };
  let cmtPendingDel = null;

  function allComments() {
    if (cmOnline) return cmRows.slice();
    const out = [];
    DESTINATIONS.forEach((d) => {
      listComments(d.id).forEach((c) => out.push(Object.assign({}, c, { destId: d.id })));
    });
    // 全书留言
    listComments(CM_ALL).forEach((c) => out.push(Object.assign({}, c, { destId: CM_ALL })));
    return out;
  }

  function likeCount(c) {
    if (c.remote) return c.likes || 0;
    return (c.likes || 0) + (likedMap[c.destId + ':' + c.cid] ? 1 : 0);
  }

  function cmtCounts() {
    const all = allComments();
    const cities = new Set();
    let mine = 0;
    let liked = 0;
    all.forEach((c) => {
      if (c.mine) mine++;
      if (c.destId !== CM_ALL) cities.add(c.destId);
      if (c.remote ? c.liked : likedMap[c.destId + ':' + c.cid]) liked++;
    });
    return { total: all.length, cities: cities.size, mine: mine, liked: liked };
  }

  function cmtStatsHTML() {
    const n = cmtCounts();
    return `<li><b>${n.total}</b><span>条留言</span></li>
      <li><b>${n.cities}</b><span>处被提起</span></li>
      <li><b>${n.mine}</b><span>条我写的</span></li>
      <li><b>${n.liked}</b><span>条我赞过</span></li>`;
  }

  function cmtCityChipsHTML() {
    const counts = {};
    let total = 0;
    allComments().forEach((c) => {
      counts[c.destId] = (counts[c.destId] || 0) + 1;
      total++;
    });
    const chip = (key, label, n) => {
      const on = cmtState.city === key;
      return `<button class="cmt-citychip${on ? ' is-on' : ''}" type="button" data-city="${escapeHTML(key)}"
        aria-pressed="${on}">${escapeHTML(label)}<span class="n">${n}</span></button>`;
    };
    const out = [chip('all', '全部去处', total)];
    if (counts[CM_ALL]) out.push(chip(CM_ALL, '全书', counts[CM_ALL]));
    DESTINATIONS.forEach((d) => {
      if (!counts[d.id]) return;
      out.push(chip(d.id, d.city, counts[d.id]));
    });
    return out.join('');
  }

  function cmtCardHTML(c) {
    const key = c.destId + ':' + c.cid;
    const on = c.remote ? !!c.liked : !!likedMap[key];
    const dest = DEST_BY_ID[c.destId];
    const at = dest
      ? `<button class="cc__at" type="button" data-goto-city="${escapeHTML(c.destId)}"
           title="看${escapeHTML(dest.city)}的详情">${escapeHTML(dest.city)}</button>`
      : '<span class="cc__at cc__at--all">全书</span>';
    return `
      <li class="cc${c.mine ? ' cc--mine' : ''}" data-dest="${escapeHTML(c.destId)}" data-cid="${escapeHTML(c.cid)}"
          style="--c:${schoolColor(c.school)}">
        <span class="cc__ava" aria-hidden="true">${escapeHTML(String(c.school).slice(0, 1))}</span>
        <div class="cc__body">
          <p class="cc__top">
            <b class="cc__name">${escapeHTML(c.name)}</b>
            <span class="cc__school">${escapeHTML(c.school)}</span>
            ${at}
            <time class="cc__time" datetime="${escapeHTML(c.ts)}">${escapeHTML(relTime(c.ts))}</time>
          </p>
          <p class="cc__text">${escapeHTML(c.text)}</p>
          <p class="cc__acts">
            <button class="cc__like${on ? ' is-on' : ''}" type="button"
              data-like="${escapeHTML(c.cid)}" data-dest="${escapeHTML(c.destId)}"
              data-base="${c.likes || 0}" aria-pressed="${on}" aria-label="赞同这条留言">赞 <b>${likeCount(c)}</b></button>
            <button class="cc__del" type="button" data-del="${escapeHTML(c.cid)}"
              data-dest="${escapeHTML(c.destId)}"${c.mine ? '' : ' hidden'}>删去</button>
            <button class="cc__report" type="button" data-report="${escapeHTML(c.cid)}"
              data-dest="${escapeHTML(c.destId)}" title="举报这条留言">举报</button>
          </p>
        </div>
      </li>`;
  }

  function renderCmtBoard() {
    const listBox = $('#cmt-list');
    if (!listBox) return;

    const stats = $('#cmt-stats');
    if (stats) stats.innerHTML = cmtStatsHTML();
    // 视图按钮上的角标、页脚入口
    const n = cmtCounts();
    const totalEl = $('#cmt-total');
    if (totalEl) totalEl.textContent = n.total;
    const footEl = $('#foot-cmt-n');
    if (footEl) footEl.textContent = n.total;

    const chipBox = $('#cmt-cities');
    if (chipBox) chipBox.innerHTML = cmtCityChipsHTML();

    let rows = allComments();
    if (cmtState.city !== 'all') rows = rows.filter((c) => c.destId === cmtState.city);
    if (cmtState.scope === 'mine') rows = rows.filter((c) => c.mine);
    if (cmtState.scope === 'liked') {
      rows = rows.filter((c) => (c.remote ? c.liked : likedMap[c.destId + ':' + c.cid]));
    }

    rows.sort(cmtState.sort === 'hot'
      ? (a, b) => likeCount(b) - likeCount(a) || String(b.ts).localeCompare(String(a.ts))
      : (a, b) => String(b.ts).localeCompare(String(a.ts)) || likeCount(b) - likeCount(a));

    let empty = '这一处还没有人说话，来做第一个。';
    if (cmtState.scope === 'mine') empty = '你还没有留过言。左边写一句，就算来过。';
    else if (cmtState.scope === 'liked') empty = '还没有赞过哪一条。看到合意的，点一下「赞」。';
    else if (cmtState.city === CM_ALL) empty = '全书留言还空着，说说这套图鉴本身。';

    listBox.innerHTML = rows.length
      ? rows.map(cmtCardHTML).join('')
      : `<li class="cc-empty">${empty}</li>`;
  }

  // 筛选/排序按钮的按压态；选中具体去处时，顺手把落款表单的「何处」也切过去
  function syncCmtControls() {
    const scope = $('#cmt-scope');
    if (scope) {
      scope.querySelectorAll('[data-scope]').forEach((b) => {
        const on = b.dataset.scope === cmtState.scope;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
    }
    const sort = $('#cmt-sort');
    if (sort) {
      sort.querySelectorAll('[data-sort]').forEach((b) => {
        const on = b.dataset.sort === cmtState.sort;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
    }
    const cityEl = $('#cmt-city');
    if (cityEl && cmtState.city !== 'all') cityEl.value = cmtState.city;
  }

  function initCmtForm() {
    const form = $('#cmt-form');
    if (!form) return;
    const nameEl = $('#cmt-name');
    const schoolEl = $('#cmt-school');
    const cityEl = $('#cmt-city');
    const textEl = $('#cmt-text');
    const countEl = $('.cmt-form__count b');
    const hintEl = $('#cmt-hint');

    schoolEl.innerHTML = Object.keys(SCHOOLS).map((s) => (
      `<option value="${escapeHTML(s)}"${s === (commenter.school || '天策') ? ' selected' : ''}>${escapeHTML(s)}</option>`
    )).join('');
    cityEl.innerHTML = [`<option value="${CM_ALL}">全书 · 不拘何处</option>`]
      .concat(DESTINATIONS.map((d) => (
        `<option value="${escapeHTML(d.id)}">${escapeHTML(d.city)} · ${escapeHTML(d.school)}</option>`
      ))).join('');
    if (commenter.name) nameEl.value = commenter.name;
    paintIdCard();

    const say = (msg, bad) => {
      hintEl.textContent = msg;
      hintEl.classList.toggle('is-bad', !!bad);
    };
    textEl.addEventListener('input', () => {
      countEl.textContent = textEl.value.length;
      say('');
    });
    nameEl.addEventListener('input', () => {
      nameEl.classList.remove('is-err');
      say('');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = textEl.value.trim();
      const me = ident();
      // 没落籍先落籍，落完自动接着发
      if (!me) { openIdent(() => form.requestSubmit()); return; }
      if (!text) { textEl.focus(); say('还没写内容。', true); return; }

      const destId = cityEl.value || CM_ALL;
      const btn = form.querySelector('.cmt-form__send');
      btn.disabled = true;
      say(cmOnline ? '落款中…' : '');

      if (cmOnline) {
        const res = await JHCloud.add(destId, text.slice(0, 140));
        btn.disabled = false;
        if (!res.ok) { say(res.error, true); return; }
        const raw = Array.isArray(res.data) ? res.data[0] : res.data;
        const row = remoteRow(raw || { id: Date.now(), dest_id: destId, name: me.name,
          school: me.school, body: text.slice(0, 140), likes: 0, created_at: new Date().toISOString() });
        row.mine = true;
        row.liked = false;
        cmRows.unshift(row);
      } else {
        const rec = {
          cid: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          name: me.name.slice(0, 10),
          school: me.school,
          text: text.slice(0, 140),
          ts: todayStr(),
          likes: 0,
        };
        (userComments[destId] = userComments[destId] || []).push(rec);
        if (!writeJSON(C_KEY, userComments)) {
          userComments[destId].pop();
          btn.disabled = false;
          say('留言没能存下：数据本身有问题，刷新后再试一次。', true);
          return;
        }
        btn.disabled = false;
      }

      textEl.value = '';
      countEl.textContent = '0';
      // 落到刚写的那一处，方便立刻看到自己这条
      cmtState.city = destId;
      cmtState.scope = 'all';
      syncCmtControls();
      renderCmtBoard();
      say(cmOnline ? '已落款。' : (store.volatile ? '已落款，仅此一窗。' : '已落款，但只在本机。'));
      const listBox = $('#cmt-list');
      if (listBox) listBox.scrollIntoView({ block: 'nearest' });
    });
  }

  function bindCmtBoard() {
    const listBox = $('#cmt-list');
    if (!listBox) return;

    const scopeBox = $('#cmt-scope');
    if (scopeBox) {
      scopeBox.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-scope]');
        if (!btn) return;
        cmtState.scope = btn.dataset.scope;
        syncCmtControls();
        renderCmtBoard();
      });
    }
    const sortBox = $('#cmt-sort');
    if (sortBox) {
      sortBox.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-sort]');
        if (!btn) return;
        cmtState.sort = btn.dataset.sort;
        syncCmtControls();
        renderCmtBoard();
      });
    }
    const chipBox = $('#cmt-cities');
    if (chipBox) {
      chipBox.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-city]');
        if (!btn) return;
        cmtState.city = btn.dataset.city;
        syncCmtControls();
        renderCmtBoard();
      });
    }

    listBox.addEventListener('click', (e) => {
      // 去处名 → 打开该处详情
      const go = e.target.closest('[data-goto-city]');
      if (go) { openDetail(go.dataset.gotoCity); return; }

      // 举报：低权重入口，连点也只算一次（服务端按设备去重）
      const rep = e.target.closest('[data-report]');
      if (rep) {
        if (!ident()) { openIdent(); return; }
        if (!cmOnline) { $('#cmt-hint').textContent = '本机留言不必举报。'; return; }
        rep.disabled = true;
        JHCloud.report(rep.dataset.report).then((res) => {
          rep.disabled = false;
          $('#cmt-hint').textContent = res.ok ? '已报官，多谢。' : res.error;
        });
        return;
      }

      const like = e.target.closest('.cc__like');
      if (like) {
        const cid = like.dataset.like;
        const row = cmRows.find((c) => c.remote && c.cid === cid);
        if (row) {
          like.disabled = true;
          JHCloud.like(cid).then((res) => {
            like.disabled = false;
            if (!res.ok) { $('#cmt-hint').textContent = res.error; return; }
            row.liked = !!res.data.liked;
            row.likes = res.data.likes;
            renderCmtBoard();
          });
          return;
        }
        const key = like.dataset.dest + ':' + cid;
        const on = !like.classList.contains('is-on');
        if (on) likedMap[key] = 1; else delete likedMap[key];
        writeJSON(CL_KEY, likedMap);
        if (cmtState.scope === 'liked') { renderCmtBoard(); return; }
        like.classList.toggle('is-on', on);
        like.setAttribute('aria-pressed', String(on));
        like.querySelector('b').textContent = Number(like.dataset.base) + (on ? 1 : 0);
        const stats = $('#cmt-stats');
        if (stats) stats.innerHTML = cmtStatsHTML();
        return;
      }

      const del = e.target.closest('.cc__del');
      if (del && !del.hidden) {
        const destId = del.dataset.dest;
        const cid = del.dataset.del;
        if (cmtPendingDel === destId + ':' + cid) {
          cmtPendingDel = null;
          const row = cmRows.find((c) => c.remote && c.cid === cid);
          if (row) {
            JHCloud.del(cid).then((res) => {
              if (!res.ok) { $('#cmt-hint').textContent = res.error; return; }
              cmRows = cmRows.filter((c) => c !== row);
              $('#cmt-hint').textContent = '已删去。';
              renderCmtBoard();
            });
            return;
          }
          userComments[destId] = (userComments[destId] || []).filter((c) => c.cid !== cid);
          writeJSON(C_KEY, userComments);
          $('#cmt-hint').textContent = '已删去。';
          renderCmtBoard();
        } else {
          cmtPendingDel = destId + ':' + cid;
          del.textContent = '确定删去？';
          del.classList.add('is-ask');
          setTimeout(() => {
            if (cmtPendingDel === destId + ':' + cid) {
              cmtPendingDel = null;
              del.textContent = '删去';
              del.classList.remove('is-ask');
            }
          }, 3000);
        }
      }
    });

    // 页脚入口
    const footBtn = $('[data-goto="comments"]');
    if (footBtn) {
      footBtn.addEventListener('click', () => {
        switchView('comments');
        const v = $('#cmtview');
        if (v) v.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  /* ---------- 详情弹层 ---------- */
  let lastFocused = null;
  let currentDetailId = null;
  function openDetail(id) {
    const d = DESTINATIONS.find((x) => x.id === id);
    if (!d) return;
    currentDetailId = id;
    // 详情里再点开另一处时，不要把「返回焦点」记到旧画轴的关闭按钮上
    if ($('#modal').hidden) lastFocused = document.activeElement;
    const color = schoolColor(d.school);
    const portrait = schoolPortrait(d.school);
    const panel = $('#modal-panel');
    panel.style.setProperty('--accent', color);
    panel.innerHTML = `
      <button class="modal__close" data-close aria-label="关闭">×</button>
      <div class="m-portrait" aria-hidden="false">
        ${portrait
          ? `<img src="${portrait}" alt="${escapeHTML(d.school)}立绘" decoding="async" onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src=this.src.replace('.webp','.jpg');}else{this.parentElement.classList.add('is-none');this.remove();}">`
          : ''}
        <span class="m-portrait__bg"></span>
        <div class="m-portrait__veil"></div>
        <p class="m-portrait__verse">${escapeHTML(d.verse)}</p>
      </div>
      <div class="m-wrap">
      <div class="m-head">
        ${portrait ? '' : '<span class="m-seal">' + escapeHTML(d.mark) + '</span>'}
        <h2 class="m-head__city" id="m-city">${escapeHTML(d.city)}</h2>
        <p class="m-head__sub">${escapeHTML(d.alias)} · ${escapeHTML(d.province)} · ${escapeHTML(d.region)} · ${escapeHTML(d.era)}</p>
        <span class="m-head__school">${escapeHTML(d.school)}<span class="r">${escapeHTML(schoolRoles(d.school).join('/'))}</span></span>
      </div>
      <div class="m-journey" role="group" aria-label="行旅印记">
        <span class="m-journey__label">行旅印记</span>
        <button class="m-seal-btn m-seal-btn--done" type="button" data-mark="done" data-sfx="seal" aria-pressed="false"><i>已</i><i>行</i></button>
        <button class="m-seal-btn m-seal-btn--wish" type="button" data-mark="wish" data-sfx="seal" aria-pressed="false"><i>愿</i><i>往</i></button>
        <span class="m-journey__hint">落印记下 · 再点一次抹去</span>
      </div>
      <div class="m-body">
        <div class="m-section m-chi">
          <h3>门派心法</h3>
          <ul class="m-chi__list">
            ${schoolChi(d.school).map(([n, r]) => `
              <li><b>${escapeHTML(n)}</b><em class="m-chi__role" data-role="${escapeHTML(r)}">${escapeHTML(r)}</em></li>`).join('')}
          </ul>
          <p class="m-chi__tag">${escapeHTML((SCHOOLS[d.school] && SCHOOLS[d.school].tag) || '')}</p>
        </div>
        <div class="m-section">
          <h3>门派渊源</h3>
          <p>${escapeHTML(d.origin)}</p>
        </div>
        <div class="m-section">
          <h3>出行建议</h3>
          <p>${escapeHTML(d.tip)}</p>
        </div>
        <div class="m-section">
          <h3>江湖打卡点</h3>
          <ul class="m-spots">${d.spots.map((s) => `<li>${escapeHTML(s)}</li>`).join('')}</ul>
        </div>
        <div class="m-section">
          <h3>推荐语</h3>
          <p>${escapeHTML(d.blurb)}</p>
        </div>
        <div class="m-section m-trip">
          <h3>编入行程</h3>
          <p>把这一处加进「自拟行程」的草稿，攒够几处便能存成一条自己走的线。</p>
          <button class="m-trip__btn" type="button" data-add-trip="${escapeHTML(d.id)}">＋ 加进草稿</button>
        </div>
        <div class="m-comments" id="m-comments"></div>
      </div>
      </div>`;
    const modal = $('#modal');
    modal.hidden = false;
    lockScroll();

    // 行旅印记：落印 / 抹印
    const cur = markOf(d.id);
    panel.querySelectorAll('.m-seal-btn').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.mark === cur));
      b.addEventListener('click', () => {
        const m = b.dataset.mark;
        setMark(d.id, markOf(d.id) === m ? '' : m);
        const now = markOf(d.id);
        panel.querySelectorAll('.m-seal-btn').forEach((x) => {
          x.setAttribute('aria-pressed', String(x.dataset.mark === now));
        });
        syncJourney({ rerender: state.journey !== '全部' });
      });
    });

    // 编入行程：把这一处丢进自拟行程的草稿，草稿区随时可排序、命名、存下
    const tripBtn = $('[data-add-trip]', panel);
    if (tripBtn) {
      const syncTrip = () => {
        const i = draft.cities.indexOf(d.id);
        tripBtn.classList.toggle('is-on', i >= 0);
        tripBtn.textContent = i >= 0
          ? `已在草稿 · 第 ${i + 1} 处（点此移出）`
          : '＋ 加进草稿';
      };
      syncTrip();
      tripBtn.addEventListener('click', () => {
        togglePick(d.id);
        syncTrip();
      });
    }

    $('.modal__close', panel).focus({ preventScroll: true });
    panel.scrollTop = 0; // 换一处去处时，画轴总从卷首展开
    mountComments(d.id, panel);
  }

  /* ---------- 锁滚动 ----------
   * 1) body 固定 + 负 top 定位：避免 overflow:hidden 把滚动位置丢掉；
   * 2) 重入保护：详情里再开另一城时不再重新记录（此刻 scrollY 已是 0，
   *    再记一次就会把原位置覆盖成 0，关闭后直接回到顶部）；
   * 3) 收起时强制「瞬时」归位：html 上有 scroll-behavior:smooth，
   *    直接 scrollTo 会走平滑动画，与取消 fixed 同帧时会被打断，
   *    结果页面停在 scrollY=0，也就是关闭后一路滑回顶部。 */
  let scrollLockY = 0;
  let scrollLocked = false;

  function lockScroll() {
    if (scrollLocked) return;
    const body = document.body;
    scrollLockY = Math.round(window.scrollY || document.documentElement.scrollTop || 0);
    const bar = window.innerWidth - document.documentElement.clientWidth;
    body.style.position = 'fixed';
    body.style.top = -scrollLockY + 'px';
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    if (bar > 0) body.style.paddingRight = bar + 'px'; // 补回滚动条宽度，版面不横移
    body.classList.add('is-locked');
    scrollLocked = true;
  }

  function unlockScroll() {
    if (!scrollLocked) return;
    // 入籍弹层还开着就别解，否则底下的正文会跟着滚
    const identBox = $('#ident');
    if (identBox && !identBox.hidden) return;
    scrollLocked = false;
    const body = document.body;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    body.style.paddingRight = '';
    body.classList.remove('is-locked');

    const root = document.documentElement;
    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto'; // 临时关掉平滑，位置一次到位
    window.scrollTo(0, scrollLockY);
    root.style.scrollBehavior = prev;
  }

  function closeDetail() {
    const modal = $('#modal');
    if (modal.hidden) return;
    modal.hidden = true;
    currentDetailId = null;
    unlockScroll();
    const back = lastFocused;
    lastFocused = null;
    // preventScroll：恢复焦点时别再触发一次滚动
    if (back && back.isConnected) back.focus({ preventScroll: true });
    // 在详情里改过留言，回到留言板要能看到
    if (currentView === 'comments') renderCmtBoard();
  }

  /* ---------- 渲染主流程 ---------- */
  // 卡片视图首屏并不显示，构建它会把 20 张实景图一并拉下来（display:none 也照样下载），
  // 所以推迟到第一次切过去再建，舆图视图就只剩 20 张几 KB 的小像。
  let cardsBuilt = false;
  function render() {
    const list = filtered();
    const grid = $('#grid');
    const empty = $('#empty');
    grid.innerHTML = list.map(cardHTML).join('');
    cardsBuilt = true;
    empty.hidden = list.length !== 0;
    updateCount(list.length);

    grid.querySelectorAll('.card').forEach((el, i) => {
      el.style.transitionDelay = Math.min(i * 26, 320) + 'ms';
      io.observe(el);
    });
  }

  function updateCount(n) {
    const total = DESTINATIONS.length;
    $('#count').textContent = n === total ? `共 ${total} 处江湖去处` : `筛选出 ${n} / ${total} 处`;
  }

  /* ---------- 入场观察 ---------- */
  let io;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
  }

  /* ---------- 绑定 ---------- */
  function bind() {
    $('#filters').addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      state[btn.dataset.group] = btn.dataset.value;
      syncChips();
      render();
    });

    $('#search').addEventListener('input', (e) => {
      state.q = e.target.value;
      render();
    });

    $('#grid').addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (card) openDetail(card.dataset.id);
    });
    $('#grid').addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('card')) {
        e.preventDefault(); openDetail(e.target.dataset.id);
      }
    });

    $('#modal').addEventListener('click', (e) => {
      if (e.target.dataset.close !== undefined) closeDetail();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('#modal').hidden) closeDetail();
    });
  }

  /* ---------- 现成行程 ---------- */
  const ROUTE_FILTERS = [
    { key: '全部', label: '全部', test: () => true },
    { key: '三日', label: '三日短途', test: (n) => n <= 3 },
    { key: '四五日', label: '四至五日', test: (n) => n === 4 || n === 5 },
    { key: '六日', label: '六日以上', test: (n) => n >= 6 },
  ];
  const routeState = { days: '全部', open: new Set() };

  function routeFilterHTML() {
    return ROUTE_FILTERS.map((f) => {
      const n = ROUTES.filter((r) => f.test(r.days)).length;
      return `<button class="rchip" type="button" data-days="${f.key}" aria-pressed="${routeState.days === f.key}">${f.label}<span class="n">${n}</span></button>`;
    }).join('');
  }

  function dayHTML(p) {
    return `<li class="plan__day">
      <span class="plan__d">${escapeHTML(p.d)}</span>
      <span class="plan__where">${escapeHTML(p.where)}</span>
      <ul class="plan__items">${p.items.map((t) => `<li>${escapeHTML(t)}</li>`).join('')}</ul>
    </li>`;
  }

  // 两城之间的一段交通：怎么去、要多久、多少钱
  function moveHTML(m) {
    const tip = `交通：${m.mode} 约 ${m.time} · ${m.cost}${m.note ? '（' + m.note + '）' : ''}`;
    return `<span class="rt__move" title="${escapeHTML(tip)}">
      <i class="rt__move__m">${escapeHTML(m.mode)}</i>
      <b class="rt__move__t">${escapeHTML(m.time)}</b>
      <s class="rt__move__c">${escapeHTML(m.cost)}</s>
    </span>`;
  }

  function routeHTML(r) {
    const open = routeState.open.has(r.id);
    const mine = !!r.mine;
    const moves = r.moves || [];
    const chain = r.cities.map((cid, i) => {
      const d = DEST_BY_ID[cid];
      if (!d) return '';
      const arrow = i ? '<span class="rt__arrow" aria-hidden="true">›</span>' : '';
      const mv = i > 0 && moves[i - 1] ? moveHTML(moves[i - 1]) : '';
      return `${arrow}${mv}<button class="rt__city" type="button" data-city="${cid}" title="看 ${escapeHTML(d.city)} 的详情">
        <i class="rt__mark" style="--c:${schoolColor(d.school)}">${escapeHTML(d.mark)}</i>
        <b>${escapeHTML(d.city)}</b>
        <em>${escapeHTML(d.school)}</em>
      </button>`;
    }).join('');

    return `
      <article class="rt${open ? ' is-open' : ''}${mine ? ' rt--mine' : ''}" data-route="${r.id}">
        <span class="rt__no" aria-hidden="true">${mine ? '我' : r.no}</span>
        <div class="rt__main">
          <header class="rt__head">
            <h3 class="rt__name">${escapeHTML(r.name)}</h3>
            ${mine ? '<span class="rt__tag">自拟</span>' : ''}
            <span class="rt__sub">${escapeHTML(r.sub)}</span>
          </header>
          <p class="rt__hook">${escapeHTML(r.hook)}</p>
          <ul class="rt__meta">
            <li class="rt__days"><b>${r.days}</b>天${r.nights}晚</li>
            <li><span class="rt__k">强度</span>${escapeHTML(r.level)}</li>
            <li><span class="rt__k">宜</span>${escapeHTML(r.season)}</li>
          </ul>
          <div class="rt__chain">${chain}</div>
          <div class="rt__plan"${open ? '' : ' hidden'}>
            <ol class="plan">${r.plan.map(dayHTML).join('')}</ol>
            <p class="rt__tips"><span>行前一句</span>${escapeHTML(r.tips)}</p>
          </div>
          <button class="rt__toggle" type="button" data-toggle="${r.id}" aria-expanded="${open}">
            <span>${open ? '收起日程' : '逐日行程'}</span><i aria-hidden="true"></i>
          </button>
          ${mine ? `<div class="rt__acts">
            <button type="button" data-edit-route="${r.id}">再改</button>
            <button type="button" data-del-route="${r.id}">删去</button>
          </div>` : ''}
        </div>
      </article>`;
  }

  function togglePlan(toggle) {
    const id = toggle.dataset.toggle;
    const art = toggle.closest('.rt');
    const plan = art.querySelector('.rt__plan');
    const on = !routeState.open.has(id);
    if (on) routeState.open.add(id); else routeState.open.delete(id);
    plan.hidden = !on;
    art.classList.toggle('is-open', on);
    toggle.setAttribute('aria-expanded', String(on));
    toggle.querySelector('span').textContent = on ? '收起日程' : '逐日行程';
  }

  function renderRoutes() {
    const filterBox = $('#routes-filter');
    const listBox = $('#routes-list');
    if (!filterBox || !listBox) return;
    filterBox.innerHTML = routeFilterHTML();
    const f = ROUTE_FILTERS.find((x) => x.key === routeState.days) || ROUTE_FILTERS[0];
    listBox.innerHTML = ROUTES.filter((r) => f.test(r.days)).map(routeHTML).join('');
  }

  function bindRoutes() {
    const filterBox = $('#routes-filter');
    const listBox = $('#routes-list');
    if (!filterBox || !listBox) return;

    filterBox.addEventListener('click', (e) => {
      const btn = e.target.closest('.rchip');
      if (!btn) return;
      routeState.days = btn.dataset.days;
      filterBox.querySelectorAll('.rchip').forEach((b) => (
        b.setAttribute('aria-pressed', String(b.dataset.days === routeState.days))
      ));
      renderRoutes();
    });

    listBox.addEventListener('click', (e) => {
      // 城市名 → 打开该处详情
      const city = e.target.closest('.rt__city');
      if (city) { openDetail(city.dataset.city); return; }

      const toggle = e.target.closest('.rt__toggle');
      if (!toggle) return;
      togglePlan(toggle);
    });
  }

  /* ---------- 自拟行程（纯本地：只存在这台设备的 localStorage） ----------
   * 草稿是「一串去处 id」，点选的先后即成行次序。
   * 天数、强度、逐日安排全部由这一串推导，用户只出主意，不写日程。
   */
  const MK_KEY = 'jx3.routes.v1';
  const MKD_KEY = 'jx3.draft.v1';
  const MK_NOTE = '每城按留一晚推算，天数自己长出来；城市之间的车次船班未计入。';
  const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '二十一'];
  const draft = { cities: [], editing: null };
  let myRoutes = [];
  let mkPendingDel = null;
  let mkNoteTimer = 0;

  function loadMyRoutes() {
    const raw = readJSON(MK_KEY, []);
    const valid = new Set(DESTINATIONS.map((d) => d.id));
    myRoutes = (Array.isArray(raw) ? raw : [])
      .filter((o) => o && Array.isArray(o.cities))
      .map((o) => ({
        id: String(o.id || ''),
        name: String(o.name || '').slice(0, 12),
        hook: String(o.hook || '').slice(0, 46),
        cities: o.cities.filter((c) => valid.has(c)),
        ts: Number(o.ts) || 0,
      }))
      .filter((o) => o.id && o.cities.length);
    // 草稿也留一手：浏览中用「加进草稿」攒的几处，刷新后还在
    const dft = readJSON(MKD_KEY, null);
    if (dft && Array.isArray(dft.cities)) {
      draft.cities = dft.cities.filter((c) => valid.has(c)).slice(0, CN_NUM.length);
    }
  }
  function saveMyRoutes() { return writeJSON(MK_KEY, myRoutes); }
  function saveDraftCities() { writeJSON(MKD_KEY, { cities: draft.cities }); }

  function dayName(i) { return `第${CN_NUM[i] || (i + 1)}日`; }

  // 由城市串推导出卡片需要的全部字段
  function deriveRoute(r) {
    const n = r.cities.length;
    const first = DEST_BY_ID[r.cities[0]];
    const last = DEST_BY_ID[r.cities[n - 1]];
    const plan = r.cities.map((cid, i) => {
      const d = DEST_BY_ID[cid];
      const prev = i ? DEST_BY_ID[r.cities[i - 1]] : null;
      const s = d.spots || [];
      const items = [];
      if (s[0]) items.push(`上午　${s[0]}`);
      if (s[1]) items.push(`午后　${s[1]}`);
      items.push(`夜里　宿${d.city}${s[2] ? '，夜游' + s[2] : ''}`);
      return { d: dayName(i), where: prev ? `${prev.city} → ${d.city}` : d.city, items };
    });
    // 每城留一晚，末尾补一个返程日：天数 = 城市数 + 1，与晚数自然对齐
    plan.push({
      d: dayName(n),
      where: `自${last.city}返程`,
      items: [
        `上午　在${last.city}再走一段，把没吃着的吃一次`,
        `午后　自${last.city}返程`,
      ],
    });
    return {
      cities: r.cities,
      days: n + 1, nights: n,
      level: n <= 3 ? '轻装' : n <= 5 ? '适中' : '硬核',
      season: n === 1 ? '单城细看' : `${n} 处串行`,
      sub: n === 1 ? `单城 · ${first.school}` : `${n} 处 · ${first.school} 至 ${last.school}`,
      name: r.name || (n === 1 ? `${first.city}一游` : `${first.city}—${last.city}`),
      hook: r.hook || (n === 1 ? `只去${first.city}，慢慢走。` : `自${first.city}一路到${last.city}，${n} 处挨着走。`),
      plan,
      tips: `按每城留一晚推算，共 ${n} 天 ${n} 晚、末日下午返程；城市之间的车次、船班请自行核对，别赶路。`,
    };
  }

  function mkStatText() {
    const n = draft.cities.length;
    if (!n) return '尚无去处';
    return `${n} 处 · ${n + 1} 天 ${n} 晚 · ${n <= 3 ? '轻装' : n <= 5 ? '适中' : '硬核'}`;
  }

  function mkGridHTML() {
    return DESTINATIONS.map((d) => {
      const i = draft.cities.indexOf(d.id);
      const on = i >= 0;
      return `<button class="pk${on ? ' is-on' : ''}" type="button" data-pk="${d.id}"
        aria-pressed="${on}" style="--c:${schoolColor(d.school)}"
        title="${on ? '移出' : '加入'}${escapeHTML(d.city)}">
        <i class="pk__mark" aria-hidden="true">${escapeHTML(d.mark)}</i>
        <span class="pk__city">${escapeHTML(d.city)}</span>
        <span class="pk__school">${escapeHTML(d.school)}</span>
        ${on ? `<b class="pk__no" aria-hidden="true">${i + 1}</b>` : ''}
      </button>`;
    }).join('');
  }

  function mkChainHTML() {
    const last = draft.cities.length - 1;
    return draft.cities.map((cid, i) => {
      const d = DEST_BY_ID[cid];
      return `<li class="mkc" style="--c:${schoolColor(d.school)}">
        <span class="mkc__no" aria-hidden="true">${i + 1}</span>
        <i class="mkc__mark" aria-hidden="true">${escapeHTML(d.mark)}</i>
        <span class="mkc__city">${escapeHTML(d.city)}<em>${escapeHTML(d.school)}</em></span>
        <span class="mkc__acts">
          <button type="button" data-mv="up" data-id="${cid}" aria-label="${escapeHTML(d.city)}上移"${i === 0 ? ' disabled' : ''}>↑</button>
          <button type="button" data-mv="down" data-id="${cid}" aria-label="${escapeHTML(d.city)}下移"${i === last ? ' disabled' : ''}>↓</button>
          <button type="button" data-rm="${cid}" aria-label="移出${escapeHTML(d.city)}">×</button>
        </span>
      </li>`;
    }).join('');
  }

  function renderMaker() {
    const grid = $('#mk-grid');
    const chain = $('#mk-chain');
    if (!grid || !chain) return;
    grid.innerHTML = mkGridHTML();
    chain.innerHTML = mkChainHTML();

    const n = draft.cities.length;
    const stat = $('#mk-stat');
    if (stat) stat.textContent = mkStatText();
    $('#mk-empty').hidden = n > 0;
    $('#mk-save').disabled = n === 0;
    $('#mk-clear').disabled = n === 0;
    $('#mk-save').textContent = draft.editing ? '保存修改' : '存下此程';
    $('#mk-cancel').hidden = !draft.editing;
  }

  function renderMine() {
    const box = $('#mk-saved');
    if (!box) return;
    const count = $('#mk-count');
    if (count) count.textContent = myRoutes.length ? `已存 ${myRoutes.length} 条自拟行程` : '';

    if (!myRoutes.length) {
      box.innerHTML = `<p class="mk-saved__empty">还没有存下的行程。挑两处以上，点「存下此程」，它就会列在这里，和现成线路一样能展开逐日安排。</p>`;
      return;
    }
    box.innerHTML = `<div class="mk-saved__head">
        <span class="mk-label">我存的行程</span>
        <span class="mk-saved__hint">${myRoutes.length} 条 · 只存在这台设备</span>
      </div>
      <div class="routes-list">${myRoutes.map((r) => (
        routeHTML(Object.assign({ mine: true }, deriveRoute(r), { id: r.id }))
      )).join('')}</div>`;
  }

  function togglePick(id) {
    if (!DEST_BY_ID[id]) return;
    const i = draft.cities.indexOf(id);
    if (i >= 0) draft.cities.splice(i, 1);
    else draft.cities.push(id);
    saveDraftCities();
    renderMaker();
  }

  function moveCity(id, dir) {
    const i = draft.cities.indexOf(id);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= draft.cities.length) return;
    draft.cities.splice(j, 0, draft.cities.splice(i, 1)[0]);
    saveDraftCities();
    renderMaker();
    // 重建后把焦点放回同一个按钮，键盘可连续调整
    const next = document.querySelector(`#mk-chain [data-mv="${dir}"][data-id="${id}"]`);
    if (next && !next.disabled) next.focus({ preventScroll: true });
  }

  // tone: true = 出错（朱砂），'vol' = 只此一窗（藏青），其余为默认淡墨
  function setNote(msg, tone) {
    const note = $('#mk-note');
    if (!note) return;
    note.textContent = msg;
    note.classList.toggle('is-err', tone === true);
    note.classList.toggle('is-vol', tone === 'vol');
    clearTimeout(mkNoteTimer);
    if (msg !== MK_NOTE) {
      mkNoteTimer = setTimeout(() => {
        note.textContent = MK_NOTE;
        note.classList.remove('is-err', 'is-vol');
      }, tone === 'vol' ? 8000 : 4200);
    }
  }

  function clearMaker() {
    draft.cities = [];
    draft.editing = null;
    mkPendingDel = null;
    const nm = $('#mk-name'); if (nm) nm.value = '';
    const hk = $('#mk-hook'); if (hk) hk.value = '';
    saveDraftCities();
    setNote(MK_NOTE);
    renderMaker();
  }

  function saveDraft() {
    const cities = draft.cities.slice();
    if (!cities.length) return;
    const nameBox = $('#mk-name');
    const hookBox = $('#mk-hook');
    const name = (nameBox.value || '').trim().slice(0, 12);
    const hook = (hookBox.value || '').trim().slice(0, 46);

    let id;
    if (draft.editing) {
      const r = myRoutes.find((x) => x.id === draft.editing);
      if (r) {
        r.cities = cities; r.name = name; r.hook = hook; r.ts = Date.now();
        id = r.id;
      }
    }
    if (!id) {
      id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      myRoutes.unshift({ id, name, hook, cities, ts: Date.now() });
    }
    if (!saveMyRoutes()) {
      setNote('行程没能存下：数据本身有问题，刷新后再试一次。', true);
      return;
    }
    clearMaker();
    setNote(store.volatile
      ? '已存下，但只在这个窗口里——此处禁用本地存储，刷新就没了。'
      : '已存下。下次打开还在这里，可以随时「再改」。', store.volatile ? 'vol' : null);
    routeState.open.add(id);   // 新存的这条直接展开逐日安排
    renderMine();
  }

  function startEdit(id) {
    const r = myRoutes.find((x) => x.id === id);
    if (!r) return;
    draft.cities = r.cities.slice();
    draft.editing = id;
    $('#mk-name').value = r.name || '';
    $('#mk-hook').value = r.hook || '';
    saveDraftCities();
    renderMaker();
    const mk = $('#mk');
    if (mk) mk.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => { const nm = $('#mk-name'); if (nm) nm.focus({ preventScroll: true }); }, 340);
  }

  function confirmDel(btn, id) {
    if (mkPendingDel === id) {
      mkPendingDel = null;
      myRoutes = myRoutes.filter((x) => x.id !== id);
      saveMyRoutes();
      if (draft.editing === id) clearMaker();
      renderMine();
      return;
    }
    mkPendingDel = id;
    btn.textContent = '确定删去？';
    btn.classList.add('is-ask');
    setTimeout(() => {
      if (mkPendingDel === id) {
        mkPendingDel = null;
        btn.textContent = '删去';
        btn.classList.remove('is-ask');
      }
    }, 3000);
  }

  function bindMaker() {
    const grid = $('#mk-grid');
    const chain = $('#mk-chain');
    const saved = $('#mk-saved');
    if (!grid || !chain || !saved) return;

    grid.addEventListener('click', (e) => {
      const b = e.target.closest('.pk');
      if (b) togglePick(b.dataset.pk);
    });

    chain.addEventListener('click', (e) => {
      const mv = e.target.closest('[data-mv]');
      if (mv) { moveCity(mv.dataset.id, mv.dataset.mv); return; }
      const rm = e.target.closest('[data-rm]');
      if (rm) togglePick(rm.dataset.rm);
    });

    $('#mk-save').addEventListener('click', saveDraft);
    $('#mk-clear').addEventListener('click', clearMaker);
    $('#mk-cancel').addEventListener('click', clearMaker);

    saved.addEventListener('click', (e) => {
      const city = e.target.closest('.rt__city');
      if (city) { openDetail(city.dataset.city); return; }

      const edit = e.target.closest('[data-edit-route]');
      if (edit) { startEdit(edit.dataset.editRoute); return; }

      const del = e.target.closest('[data-del-route]');
      if (del) { confirmDel(del, del.dataset.delRoute); return; }

      const toggle = e.target.closest('.rt__toggle');
      if (toggle) togglePlan(toggle);
    });
  }

  /* ---------- 视图切换 ---------- */
  let currentView = 'map';
  function switchView(view) {
    const sw = $('#viewswitch');
    const mapV = $('#mapview'), cardV = $('#cardsview'), routeV = $('#routesview'), cmtV = $('#cmtview');
    if (!sw || !mapV || !cardV) return;

    const views = { map: mapV, cards: cardV, routes: routeV, comments: cmtV };
    if (!views[view]) view = 'map';
    currentView = view;

    sw.querySelectorAll('.vbtn').forEach((b) => {
      const on = b.dataset.view === view;
      b.classList.toggle('is-on', on);
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    Object.keys(views).forEach((k) => { if (views[k]) views[k].hidden = k !== view; });

    if (view === 'map') {
      if (typeof window.mapHighlight === 'function') window.mapHighlight(null, false);
    } else if (view === 'cards') {
      if (cardsBuilt) paintMarks(); else render();
    } else if (view === 'routes') {
      renderMaker();
      renderMine();
      renderRoutes();
    } else {
      renderCmtBoard();
    }
  }

  function bindViewSwitch() {
    const sw = $('#viewswitch');
    if (!sw) return;
    sw.addEventListener('click', (e) => {
      const btn = e.target.closest('.vbtn');
      if (btn) switchView(btn.dataset.view);
    });
    const initView = new URLSearchParams(location.search).get('view');
    if (['cards', 'routes', 'comments'].indexOf(initView) > -1) switchView(initView);
  }

  // 暴露给地图模块联动
  window.openDetail = openDetail;
  window.switchView = switchView;

  /* ---------- 启动 ---------- */
  function initStats() {
    const schools = new Set(DESTINATIONS.map((d) => d.school)).size;
    const regions = new Set(DESTINATIONS.map((d) => d.region)).size;
    $('#stats').innerHTML = `
      <li><b>${DESTINATIONS.length}</b><span>处山水</span></li>
      <li><b>${schools}</b><span>大门派</span></li>
      <li><b>${regions}</b><span>方地域</span></li>
      <li class="hero__stats-j"><b>${journey.done.size}</b><span>处已行</span></li>`;
  }

  // 兜底：若观察器未触发（如无头环境），1.2s 后强制显示
  function safetyReveal() {
    setTimeout(() => {
      document.querySelectorAll('.card:not(.is-in)').forEach((el) => el.classList.add('is-in'));
    }, 1200);
  }

  /* ---------- 狂墨动效：入视口才落笔，出视口就休眠 ---------- */
  function watchInk() {
    const all = document.querySelectorAll('.ink-write');
    if (!('IntersectionObserver' in window)) {
      all.forEach((el) => el.classList.add('is-ready'));
      return;
    }
    // 首页题名已在 HTML 上标了 is-ready（首屏即刻落笔），只观察图册里那几个
    const pen = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-ready'); pen.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    all.forEach((el) => { if (!el.classList.contains('is-ready')) pen.observe(el); });

    // 题名滚出视口后停掉反光与呼吸，回来再续
    const hero = $('.hero');
    if (hero) {
      new IntersectionObserver((entries) => {
        entries.forEach((e) => document.body.classList.toggle('hero-far', !e.isIntersecting));
      }).observe(hero);
    }
  }

  loadJourney();
  loadMyRoutes();
  buildChips();
  bind();
  bindViewSwitch();
  bindRoutes();
  bindMaker();
  bindCmtBoard();
  bindIdent();
  initCmtForm();
  paintIdCard();
  initStats();
  refreshComments();   // 异步：拿到云端留言后自己重绘
  paintBoard();
  if (currentView === 'cards') render();   // 深链 ?view=cards 才立刻建卡片
  renderMaker();
  renderMine();
  renderCmtBoard();
  safetyReveal();
  watchInk();
  showStoreTip();

  // 深链：index.html#xian 直接打开某张卡片
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash && DESTINATIONS.some((d) => d.id === hash)) openDetail(hash);
})();
