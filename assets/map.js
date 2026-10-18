/* =========================================================================
 * 江湖行纪 · 剑网三江湖舆图  —  数据 + 渲染
 * 舆图坐标基于 1000×620 的写意江湖疆域；门派驻地按江湖方位排布，
 * 点击舆图上的山门 => 打开该派行旅卡片（复用 app.js 的 openDetail）。
 * ========================================================================= */

// 门派驻地（含门派诗的完整版、山门注与舆图坐标）
const MAP_POINTS = [
  // ── 西陲大漠 ──
  { school: '明教', x: 108, y: 300, sub: '大漠光明顶', area: '西陲大漠', verse: '白沙大漠玉笛吹，一去三生渐忘谁。\n日月同辉出乱世，光明圣火盼东归。' },
  { school: '衍天宗', x: 158, y: 132, sub: '西域观星台', area: '西域', verse: '象载古今循大道，星占太乙衍天机。\n不求一世红尘梦，但问千年月朗稀。' },
  { school: '凌雪', x: 196, y: 196, sub: '西北雪山', area: '河西雪线', verse: '山河覆血风波恶，吴钩拂拭与君同。\n此身未悔补天裂，哪问青史载浮沉。' },
  { school: '唐门', x: 168, y: 392, sub: '蜀中唐家堡', area: '剑南蜀道', verse: '针翎钉棘十指牵，暴雨飞星乾坤颠。\n蜀中世家纷争事，暗起云涌逍九天。' },
  // ── 昆仑雪域 ──
  { school: '纯阳', x: 252, y: 232, sub: '昆仑玄境', area: '西陲', verse: '昆仑玄境山外山，乾坤阴阳有洞天。\n只问真君何处有，不向江湖寻剑仙。' },
  // ── 中原 ──
  { school: '少林', x: 432, y: 196, sub: '嵩山少林寺', area: '中原', verse: '古刹紫竹禅钟鸣，降妖伏魔江湖行。\n佛音亦有豪情意，天下武功出少林！' },
  { school: '万花', x: 400, y: 300, sub: '青岩万花谷', area: '中原', verse: '春兰秋菊夏清风，三星望月挂夜空。\n不求独避风雨外，只笑桃源非梦中。' },
  { school: '天策', x: 492, y: 206, sub: '长安天策府', area: '关中', verse: '长河落日东都城，铁马戍边将军坟。\n尽诸宵小天策义，长枪独守大唐魂。' },
  { school: '丐帮', x: 478, y: 418, sub: '君山总舵', area: '洞庭', verse: '搅动君山五十州，风尘几历尽翩遥。\n散罢千金未束手，餐风吞酒不寂寥。' },
  { school: '霸刀', x: 520, y: 156, sub: '太原霸刀山庄', area: '河东', verse: '寥落尘寰数十载，何曾开眼论豪英。\n刀光起处鲸吞海，誓将浮名敬死生。' },
  // ── 东北 ──
  { school: '北天药宗', x: 632, y: 86, sub: '长白山', area: '北地', verse: '道是所痴皆药石，敢同生死簿上试。\n人间几度披霜雪，留春与君最萦思。' },
  // ── 江南 ──
  { school: '藏剑', x: 548, y: 298, sub: '西湖藏剑山庄', area: '江南', verse: '秀水灵山隐剑踪，不问江湖铸青锋。\n逍遥此身君子意，一壶温酒向长空。' },
  { school: '七秀', x: 592, y: 336, sub: '扬州七秀坊', area: '江淮', verse: '西子湖畔西子情，楼外楼中雨霖铃。\n画廊绣舫霓裳舞，小桥流水叶娉婷。' },
  { school: '长歌', x: 628, y: 276, sub: '长歌门', area: '江南 · 山水', verse: '儒门有志羁风雨，失鹿山河散若星。\n千古文人侠客梦，肯将碧血写丹青。' },
  { school: '刀宗', x: 746, y: 224, sub: '东海刀宗', area: '东海', verse: '断雨穿风斩不平，何须四海惜浮名。\n凌云百战砺心铁，修得孤锋照此生。' },
  // ── 东境 ──
  { school: '蓬莱', x: 758, y: 316, sub: '海上蓬莱', area: '东海仙山', verse: '崖岸穿云卷怒涛，清风三尺削蓬蒿。\n古来侠客俱已矣，天下谁人共箫骚。' },
  // ── 华南 ──
  { school: '万灵山庄', x: 628, y: 420, sub: '桂林', area: '岭南', verse: '踽行浊世茕茕影，试以稚心问万灵。\n合神成契同归去，山海与游赴苍冥。' },
  // ── 晋北 ──
  { school: '苍云', x: 532, y: 244, sub: '雁门关', area: '晋北', verse: '歌起征思芦管怨，透穿玄甲朔风寒。\n黄泉作酒酬兄弟，战尽狂沙血未干。' },
  // ── 南疆 ──
  { school: '五毒', x: 540, y: 436, sub: '苗疆五毒教', area: '苗疆', verse: '蛇蝎为伴蛛为邻，千蝶绕笛蛊无形。\n世人皆惧断肠物，不见最毒在人心。' },
  { school: '南诏段氏', x: 612, y: 486, sub: '南诏大理', area: '南疆', verse: '苍山雪覆衡门外，洱月观花倦尘嚣。\n世第含章远逐鹿，周天风劲予逍遥。' },
];

// 图版环绕卡的落位：按江湖方位分四组，组内由西向东 / 由北向南。
// 与舆图上的点位一一对应，hover 任一侧都会点亮另一侧。
const ATLAS_SLOTS = {
  top: ['少林', '天策', '霸刀', '北天药宗'],
  left: ['衍天宗', '凌雪', '纯阳', '明教', '万花', '唐门'],
  right: ['苍云', '刀宗', '长歌', '藏剑', '蓬莱', '七秀'],
  bot: ['丐帮', '五毒', '万灵山庄', '南诏段氏'],
};

// 江湖行旅连线
const MAP_ROUTES = [
  { from: '明教', to: '衍天宗', label: '大漠观星' },
  { from: '衍天宗', to: '凌雪', label: '雪线西行' },
  { from: '明教', to: '纯阳', label: '西陲问道' },
  { from: '纯阳', to: '天策', label: '玄境长安' },
  { from: '天策', to: '少林', label: '中原论武' },
  { from: '少林', to: '万花', label: '嵩山访花' },
  { from: '万花', to: '唐门', label: '蜀道入剑' },
  { from: '唐门', to: '丐帮', label: '巴楚寻醉' },
  { from: '丐帮', to: '五毒', label: '洞庭入苗' },
  { from: '五毒', to: '南诏段氏', label: '苗疆南行' },
  { from: '南诏段氏', to: '万灵山庄', label: '苍山问灵' },
  { from: '万灵山庄', to: '丐帮', label: '江汉灵踪' },
  { from: '天策', to: '霸刀', label: '河东访刀' },
  { from: '霸刀', to: '北天药宗', label: '北地寻药' },
  { from: '霸刀', to: '藏剑', label: '并州下江南' },
  { from: '藏剑', to: '七秀', label: '西湖泛舟' },
  { from: '七秀', to: '长歌', label: '琴剑相和' },
  { from: '长歌', to: '蓬莱', label: '海上仙山' },
  { from: '长歌', to: '刀宗', label: '东境砺锋' },
  { from: '蓬莱', to: '刀宗', label: '东海同游' },
  { from: '藏剑', to: '苍云', label: '江南入晋' },
];

// 简化山河轮廓（写意折线）
const MAP_LAND = 'M 60 250 C 150 180, 210 170, 250 200 C 300 160, 350 180, 430 170 C 500 140, 560 150, 620 190 C 700 140, 760 170, 810 220 C 840 270, 820 340, 770 380 C 740 430, 690 460, 630 470 C 580 490, 520 460, 470 430 C 410 460, 340 440, 290 390 C 230 410, 170 370, 140 320 C 80 300, 70 275, 60 250 Z';

// 主要水系（长江 / 黄河 / 钱塘江 写意）
const MAP_RIVERS = [
  'M 110 300 C 220 340, 320 330, 420 330 C 520 330, 600 350, 700 300',
  'M 180 200 C 300 230, 400 210, 500 180 C 580 160, 640 170, 700 150',
  'M 620 260 C 660 280, 700 300, 760 290',
];

// 地域名注记
const MAP_AREA_LABELS = [
  { text: '西陲大漠', x: 92, y: 262 },
  { text: '西域', x: 138, y: 116 },
  { text: '昆仑雪域', x: 232, y: 186 },
  { text: '中原', x: 452, y: 260 },
  { text: '江 南', x: 600, y: 330 },
  { text: '东境', x: 762, y: 250 },
  { text: '南疆', x: 610, y: 530 },
  { text: '华南', x: 660, y: 470 },
  { text: '东北', x: 636, y: 70 },
];

/* ============================== 渲染逻辑 ============================== */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  // 地形：几团晕开的深浅，暗示山脉与水泽的起伏，不画具体山形
  const MAP_RELIEF = [
    { cx: 250, cy: 306, rx: 88, ry: 46, o: .9 },
    { cx: 348, cy: 232, rx: 62, ry: 32, o: .7 },
    { cx: 470, cy: 344, rx: 74, ry: 34, o: .85 },
    { cx: 580, cy: 244, rx: 58, ry: 26, o: .6 },
    { cx: 636, cy: 384, rx: 66, ry: 30, o: .75 },
    { cx: 372, cy: 442, rx: 58, ry: 24, o: .55 },
    { cx: 700, cy: 286, rx: 46, ry: 24, o: .5 },
    { cx: 200, cy: 372, rx: 46, ry: 24, o: .5 },
  ];

  function buildTerrain(svg) {
    const g = el('g', { class: 'map-reliefs', 'clip-path': 'url(#clipLand)' });
    MAP_RELIEF.forEach((r) => {
      const e = el('ellipse', { cx: r.cx, cy: r.cy, rx: r.rx, ry: r.ry, class: 'map-relief' });
      e.style.opacity = r.o;
      g.appendChild(e);
    });
    svg.appendChild(g);
  }

  function buildBase(svg) {
    const defs = el('defs', {});
    const clip = el('clipPath', { id: 'clipLand' });
    clip.appendChild(el('path', { d: MAP_LAND }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    svg.appendChild(el('path', { d: MAP_LAND, class: 'map-land' }));
    buildTerrain(svg);
    svg.appendChild(el('path', { d: MAP_LAND, class: 'map-land-edge' }));
    MAP_RIVERS.forEach((d, i) => svg.appendChild(el('path', { d, class: 'map-river', id: 'river' + i })));
    MAP_AREA_LABELS.forEach((a) => {
      const t = el('text', { x: a.x, y: a.y, class: 'map-area' });
      t.textContent = a.text;
      svg.appendChild(t);
    });
  }

  function buildRoutes(svg, pos) {
    const g = el('g', { class: 'map-routes' });
    MAP_ROUTES.forEach((r) => {
      const a = pos[r.from], b = pos[r.to];
      if (!a || !b) return;
      const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.08;
      const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.08;
      const p = el('path', { d: `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`, class: 'map-route' });
      p.setAttribute('data-from', r.from);
      p.setAttribute('data-to', r.to);
      g.appendChild(p);
    });
    svg.appendChild(g);
  }

  function buildNodes(svg, points) {
    const g = el('g', { class: 'map-nodes' });
    points.forEach((p) => {
      const g2 = el('g', { class: 'map-node', 'data-school': p.school, tabindex: '0', role: 'button' });
      g2.setAttribute('aria-label', p.school + ' · ' + p.sub);
      const color = (SCHOOLS[p.school] && SCHOOLS[p.school].color) || '#6b4a8a';
      g2.appendChild(el('circle', { cx: p.x, cy: p.y, r: 17, class: 'map-halo', fill: color }));
      g2.appendChild(el('circle', { cx: p.x, cy: p.y, r: 8.5, class: 'map-dot', fill: color }));
      const t = el('text', { x: p.x, y: p.y + 26, class: 'map-label' });
      t.textContent = p.school;
      g2.appendChild(t);
      const t2 = el('text', { x: p.x, y: p.y + 39, class: 'map-sub' });
      t2.textContent = p.sub;
      g2.appendChild(t2);
      g.appendChild(g2);
    });
    svg.appendChild(g);
  }

  // 立绘小像：优先用门派立绘的头部，缺图时退回印章字
  function portraitOf(school) {
    const pkey = PORTRAITS && PORTRAITS[school];
    const d = findBySchool(school);
    if (!pkey) return `<i>${(d && d.mark) || school[0]}</i>`;
    return `<img src="assets/img/school/${pkey}.webp" alt="" loading="lazy"
      onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src=this.src.replace('.webp','.jpg');}else{this.remove();}">`;
  }

  // 环绕卡：门派 / 山门 / 一句朱批，三行如图册的条目，缩略用立绘
  function cardHTML(school) {
    const p = findPoint(school);
    if (!p) return '';
    const meta = SCHOOLS[p.school] || {};
    const color = meta.color || '#6b4a8a';
    const d = findBySchool(p.school);
    const city = d ? `<em>${d.city}</em>` : '';
    return `<button class="pcard" data-school="${p.school}" style="--accent:${color}">
        <span class="pcard__ava">${portraitOf(p.school)}</span>
        <span class="pcard__body">
          <span class="pcard__name">${p.school}</span>
          <span class="pcard__place">${p.sub}${city}</span>
          <span class="pcard__tag">${meta.tag || p.area}</span>
        </span>
      </button>`;
  }

  function buildCards() {
    Object.keys(ATLAS_SLOTS).forEach((slot) => {
      const box = $('#atlas-' + slot);
      if (!box) return;
      box.innerHTML = ATLAS_SLOTS[slot].map((s) => cardHTML(s)).join('');
    });
  }

  function findPoint(school) {
    return (MAP_POINTS || []).find((p) => p.school === school);
  }

  function findBySchool(school) {
    return DESTINATIONS.find((d) => d.school === school);
  }

  function activate(school, on) {
    if (!school) {
      document.querySelectorAll('.map-node, .pcard, .map-route').forEach((n) => n.classList.remove('is-active'));
      return;
    }
    document.querySelectorAll('.map-node[data-school="' + school + '"]').forEach((n) => n.classList.toggle('is-active', on));
    document.querySelectorAll('.pcard[data-school="' + school + '"]').forEach((n) => n.classList.toggle('is-active', on));
    document.querySelectorAll('.map-route').forEach((r) => {
      const hit = r.dataset.from === school || r.dataset.to === school;
      r.classList.toggle('is-active', on && hit);
    });
  }

  function animateMap() {
    // 行旅连线：先量长度，再逐条画出
    document.querySelectorAll('.map-route').forEach((p, i) => {
      const len = p.getTotalLength ? p.getTotalLength() : 600;
      p.style.setProperty('--len', len);
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      setTimeout(() => { p.classList.add('is-drawn'); }, 400 + i * 60);
    });

    // 山门节点逐个弹出
    document.querySelectorAll('.map-node').forEach((n, i) => {
      const halo = n.querySelector('.map-halo');
      if (halo) halo.style.animationDelay = (i * 0.08) + 's';
      setTimeout(() => { n.classList.add('is-loaded'); }, 200 + i * 80);
    });

    // 地域注记淡入
    document.querySelectorAll('.map-area').forEach((t, i) => {
      t.style.animationDelay = (0.6 + i * 0.12) + 's';
    });

    // 环绕卡错峰浮起
    document.querySelectorAll('.pcard').forEach((b, i) => {
      b.style.animationDelay = (0.15 + i * 0.045) + 's';
    });
  }

  function init() {
    const svg = $('#map-svg');
    if (!svg) return;
    const points = MAP_POINTS || [];
    const pos = {};
    points.forEach((p) => { pos[p.school] = p; });

    buildBase(svg);
    buildRoutes(svg, pos);
    buildNodes(svg, points);
    buildCards();

    // 触发入场动画
    animateMap();

    svg.addEventListener('click', (e) => {
      const node = e.target.closest('.map-node');
      if (!node) return;
      openSchool(node.dataset.school);
    });
    svg.addEventListener('keydown', (e) => {
      const node = e.target.closest('.map-node');
      if (node && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openSchool(node.dataset.school); }
    });

    // 环绕卡：点击进详情，悬停点亮舆图上的对应山门与连线
    const atlas = $('.atlas');
    if (atlas) {
      atlas.addEventListener('click', (e) => {
        const c = e.target.closest('.pcard');
        if (c) openSchool(c.dataset.school);
      });
      atlas.addEventListener('mouseover', (e) => {
        const c = e.target.closest('.pcard');
        if (c) activate(c.dataset.school, true);
      });
      atlas.addEventListener('mouseout', (e) => {
        const c = e.target.closest('.pcard');
        if (c && !c.contains(e.relatedTarget)) activate(c.dataset.school, false);
      });
      atlas.addEventListener('focusin', (e) => {
        const c = e.target.closest('.pcard');
        if (c) activate(c.dataset.school, true);
      });
      atlas.addEventListener('focusout', (e) => {
        const c = e.target.closest('.pcard');
        if (c) activate(c.dataset.school, false);
      });
    }

    svg.addEventListener('mouseover', (e) => {
      const node = e.target.closest('.map-node');
      if (node) activate(node.dataset.school, true);
    });
    svg.addEventListener('mouseout', (e) => {
      const node = e.target.closest('.map-node');
      if (node) activate(node.dataset.school, false);
    });
  }

  function openSchool(school) {
    const d = findBySchool(school);
    if (d && typeof window.openDetail === 'function') {
      window.openDetail(d.id);
    } else {
      activate(school, true);
    }
  }

  window.mapHighlight = activate;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
