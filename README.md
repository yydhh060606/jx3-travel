# 江湖行纪 · 剑网3 门派旅行图鉴

二十处真实名胜，对应《剑网3》二十个门派。纯静态站点：一张手绘江湖舆图、二十张行旅卡片、
九条现成行程、可自拟的行程编造台，以及同门留言板。

## 技术构成

无框架、无打包器、无依赖。原生 HTML + CSS + ES6 脚本，字体自托管（woff2），
图片 WebP（`onerror` 回退 JPG）。

```
index.html          单页入口，四个视图（舆图 / 卡片 / 行程 / 留言）
assets/
  style.css         全站样式（含夜间主题、响应式、打印与减弱动效降级）
  data.js           20 个去处、20 个门派、9 条行程、留言种子
  app.js            视图切换、收藏、行程编造、留言板、本地存储适配层
  map.js            舆图 SVG：疆域、点位、门派卡、双向联动
  letter.js         拆封动画
  weather.js        雨 / 雪 / 夜 三种天气
  img/              20 处实景（webp + jpg）
  fonts/            Noto Serif SC、Ma Shan Zheng 子集
_fonts/             字体子集化与 favicon 生成脚本（开发用，不参与构建）
_share/             分享卡源文件
```

## 构建命令

**没有构建步骤。** 源码即产物，`index.html` 可直接打开或原样托管。

```bash
# 本地预览（任意静态服务器均可）
python -m http.server 8000
# 打开 http://127.0.0.1:8000
```

> 直接双击 `index.html` 也能看，但浏览器对 `file://` 的存储与字体策略较严；
> 需要留言、收藏、自拟行程持久化时，请用上面的本地服务器或线上地址访问。

## 部署

GitHub Pages，`main` 分支根目录直接发布，无 Actions、无产物目录。
仓库根部的 `.nojekyll` 关闭 Jekyll 处理，避免下划线目录被忽略。

在线地址：<https://yydhh060606.github.io/jx3-travel/>
仓库地址：<https://github.com/yydhh060606/jx3-travel>

更新流程：改完直接推 `main`，Pages 会在 30–60 秒后自动重新发布。

```bash
git add -A && git commit -m "改了什么" && git push
```

> **本机注意**：Windows 的证书吊销检查（schannel）在当前离线证书列表下会报
> `CRYPT_E_NO_REVOCATION_CHECK`，导致 `git push` 与浏览器访问 GitHub 都失败。
> 本仓库的 `.git/config` 里为此设了 `http.sslVerify = false` 与
> `http.schannelCheckRevoke = false`；网络环境正常后建议删掉这两项
> （`git config --unset http.sslVerify`）。

> 网页上传亦可：解压 `jx3-travel-site.zip`，把 `index.html`、`assets/` 拖进仓库根目录，
> 其余目录只是开发期脚本，不影响站点运行。

## 数据说明

收藏、留言、自拟行程都存在浏览器 `localStorage`（键名 `jx3.*`），不上传、他人不可见。
沙箱预览（如内嵌 iframe）会禁用本地存储，此时站点自动退回内存存储并在页面上说明，
功能可用但刷新即清空。要多人共享需自建后端。

## 声明

门派与世界观设定参考《剑网3》，版权归原作者；旅行地均为真实名胜。
本项目为非商业的练手作品。
