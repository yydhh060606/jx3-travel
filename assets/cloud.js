/* =========================================================================
 * 江湖行纪 · 云端（侠客留言 / 落籍）
 * ---------------------------------------------------------------------
 * 一、身份：名号 + 门派 + 一枚设备密钥（32 位十六进制，只在本机）。
 *    服务器只存密钥的 sha256，用来判断"这条是不是你写的"。
 *    所以没有密码、没有手机号，换设备就要重新落籍——这是刻意的取舍。
 * 二、留言：全部走云数据库，任何人可读，写/删/赞/报都过服务端函数，
 *    前端拿不到表，也改不了别人的东西。
 * 三、连不上时（离线、域名不对）返回 ok:false，界面退回本机留言并明说，
 *    不做静默降级。
 * ========================================================================= */
(function () {
  'use strict';

  // 这三个值来自云服务的 publicConfig，属于可公开的客户端标识
  var CFG = {
    endpoint: 'https://jx3-travel.app.workbuddy.host',
    oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
    publishableKey: 'wbpk_02Jb2dmAj2rUzoUgdSOB9C_mfl5Uu0dZj4mUARUaKLOd5e2UUffJmo3'
  };

  var ID_KEY = 'jx3.ident.v1';
  var hasLS = true;
  try {
    window.localStorage.setItem('__jx3_probe2__', '1');
    window.localStorage.removeItem('__jx3_probe2__');
  } catch (e) { hasLS = false; }

  var memIdent = null;   // localStorage 不可用时的临时身份

  function readIdent() {
    if (!hasLS) return memIdent;
    try {
      var raw = localStorage.getItem(ID_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.name || !o.key) return null;
      return o;
    } catch (e) { return null; }
  }

  function writeIdent(o) {
    if (!hasLS) { memIdent = o; return true; }
    try {
      if (o) localStorage.setItem(ID_KEY, JSON.stringify(o));
      else localStorage.removeItem(ID_KEY);
      return true;
    } catch (e) { memIdent = o; return false; }
  }

  function makeKey() {
    var buf = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(buf);
    } else {
      for (var i = 0; i < 16; i++) buf[i] = Math.floor(Math.random() * 256);
    }
    return Array.prototype.map.call(buf, function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  }

  var cloud = null;
  var sdkMissing = false;

  function boot() {
    if (cloud) return true;
    if (typeof window.WorkBuddyCloud === 'undefined' ||
        typeof window.WorkBuddyCloud.createWorkBuddyCloud !== 'function') {
      sdkMissing = true;
      return false;
    }
    try {
      cloud = window.WorkBuddyCloud.createWorkBuddyCloud({
        endpoint: CFG.endpoint,
        oauthRelayBaseUrl: CFG.oauthRelayBaseUrl,
        publishableKey: CFG.publishableKey
      });
      return true;
    } catch (e) {
      sdkMissing = true;
      return false;
    }
  }

  // 服务端抛的是 jx3:xxx 码，翻成人话
  function human(err) {
    var msg = (err && (err.message || err.error_description || err.hint)) || '';
    if (typeof err === 'string') msg = err;
    if (msg.indexOf('jx3:identity') >= 0) return '身份认不出了，重新落一次籍。';
    if (msg.indexOf('jx3:name') >= 0) return '名号要两到十个字。';
    if (msg.indexOf('jx3:body') >= 0) return '留言要一到一百四十字。';
    if (msg.indexOf('jx3:dest') >= 0) return '去处没对上。';
    if (msg.indexOf('jx3:blocked') >= 0) return '这句里有不宜公开的内容，换个说法。';
    if (msg.indexOf('jx3:too_fast') >= 0) return '刚说过一句，喝口茶再来。';
    if (msg.indexOf('jx3:daily_limit') >= 0) return '今天说得够多了，明日再叙。';
    if (msg.indexOf('jx3:missing') >= 0) return '这条留言已经不在了。';
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) {
      return '云端连不上：网络不通，或这个域名没被授权。';
    }
    return msg || '云端没有应答，稍后再试。';
  }

  function call(fn, args) {
    if (!boot()) {
      return Promise.resolve({
        ok: false,
        error: sdkMissing ? '云端脚本没加载出来' : '云端未就绪'
      });
    }
    return cloud.database.rpc(fn, args).then(function (res) {
      if (res.error) return { ok: false, error: human(res.error) };
      return { ok: true, data: res.data };
    }).catch(function (e) {
      return { ok: false, error: human(e) };
    });
  }

  function ident() { return readIdent(); }

  function enrol(name, school) {
    var prev = readIdent();
    var o = {
      name: String(name || '').trim().slice(0, 10),
      // 门派下拉万一没选中，沿用上一次，最差给个默认，别写进空值
      school: String(school || (prev && prev.school) || '').trim() || '天策',
      key: (prev && prev.key) || makeKey(),
      at: Date.now()
    };
    writeIdent(o);
    return o;
  }

  function leave() { writeIdent(null); }

  function list(dest) {
    var id = readIdent();
    var args = { p_key: id ? id.key : null };
    if (dest) args.p_dest = dest;
    return call('jx3_list_comments', args);
  }

  function add(dest, body) {
    var id = readIdent();
    if (!id) return Promise.resolve({ ok: false, error: '先落个籍再说话。', needIdent: true });
    return call('jx3_add_comment', {
      p_dest: dest, p_name: id.name, p_school: id.school, p_body: body, p_key: id.key
    });
  }

  function del(commentId) {
    var id = readIdent();
    if (!id) return Promise.resolve({ ok: false, error: '先落个籍。', needIdent: true });
    return call('jx3_del_comment', { p_id: Number(commentId), p_key: id.key });
  }

  function like(commentId) {
    var id = readIdent();
    if (!id) return Promise.resolve({ ok: false, error: '先落个籍再赞。', needIdent: true });
    return call('jx3_toggle_like', { p_id: Number(commentId), p_key: id.key });
  }

  function report(commentId) {
    var id = readIdent();
    if (!id) return Promise.resolve({ ok: false, error: '先落个籍。', needIdent: true });
    return call('jx3_report_comment', { p_id: Number(commentId), p_key: id.key });
  }

  window.JHCloud = {
    get available() { return !sdkMissing; },
    get persistLocal() { return hasLS; },
    ident: ident,
    enrol: enrol,
    leave: leave,
    list: list,
    add: add,
    del: del,
    like: like,
    report: report
  };
})();
