# 江湖行纪 · 剑网3 门派旅行图鉴

二十处真实名胜，对应《剑网3》二十个门派。纯静态站点：一张手绘江湖舆图、二十张行旅卡片、
十条现成行程、可自拟的行程编造台，以及侠客留言板。

## 技术构成

无框架、无打包器、无依赖。原生 HTML + CSS + ES6 脚本，字体自托管（woff2），
图片 WebP（`onerror` 回退 JPG）。

```
index.html          单页入口，四个视图（舆图 / 卡片 / 行程 / 留言）
assets/
  style.css         全站样式（含夜间主题、响应式、打印与减弱动效降级）
  audio.js          背景音与四类音效（手势解锁、静音开关、切后台暂停）
  audio/            bgm.mp3（64 秒循环）+ tap / swish / seal / unseal
  cloud.js          云服务访问层：入籍身份、留言读写、错误翻译
  vendor/           @tencent-ai/workbuddy-cloud-sdk 的 IIFE 构建（自托管）
  data.js           20 个去处、20 个门派（含心法表）、10 条行程（含城际交通）、留言种子
  app.js            视图切换、收藏、行程编造、留言板、本地存储适配层
  map.js            舆图 SVG：疆域、点位、门派卡、双向联动
  letter.js         拆封动画
  weather.js        雨 / 雪 / 夜 三种天气
  img/              20 处实景（webp + jpg）
  fonts/            Noto Serif SC（400 正文 / 900 标题）、Ma Shan Zheng 子集
_fonts/             字体子集化与 favicon 生成脚本（开发用，不参与构建）
_tools/             图片压缩、音频合成脚本（开发用，不参与构建）
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

**两个在线地址，能力不同：**

| 地址 | 留言 | 说明 |
| --- | --- | --- |
| <https://jx3-travel.app.workbuddy.host/> | 云端、人人可见 | 主站。云服务只放行这个域名 |
| <https://yydhh060606.github.io/jx3-travel/> | 仅本机 | 镜像。域名没被云端授权，页面会显式提示 |

仓库地址：<https://github.com/yydhh060606/jx3-travel>

主站来自「WorkBuddy 应用发布」（`wbapp_02Jb2dmAj2rUzoUgdSOB9C`），
与云数据库共用同一个应用身份；换域名会让登录失效，请不要另建应用。
GitHub Pages 侧改完直接推 `main`，Pages 会在 30–60 秒后自动重新发布。

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

## 资源规格

站点在国内访问 GitHub Pages 偏慢，图片按实际显示尺寸输出，不做「原图直出」：

| 用途 | 文件 | 规格 |
| --- | --- | --- |
| 卡片实景 | `assets/img/*.webp` | 宽 ≤800，WebP q72，平均 54 KB |
| 卡片实景兜底 | `assets/img/*.jpg` | 宽 ≤800，JPEG q66 |
| 弹层立绘 | `assets/img/school/*.webp` | 宽 ≤620，q78 |
| 卡片头像 | `assets/img/school/*-sm.webp` | 宽 ≤160，q76，约 11 KB |

- 卡片视图首次进入才构建，实景图随之按需加载；舆图首屏只拉 20 张头像（合计约 185 KB）
- 所有 `<img>` 带 `loading="lazy" decoding="async"`，WebP 失败时 `onerror` 回落到同名 JPG
- 改图后重跑 `_tools/optimize-images.py` 重新压缩

## 声音

全部素材由 `_tools/make_audio.py` 合成，无第三方录音，无版权顾虑：

| 文件 | 用途 | 规格 |
| --- | --- | --- |
| `bgm.mp3` | 全站背景音，64 秒无缝循环 | 古筝 + 箫 + 碰铃 + 低音散音，D 宫五声，64 kbps 单声道，500 KB |
| `tap.mp3` | 按钮轻叩 | 0.16 s，2.4 KB |
| `swish.mp3` | 视图切换（纸页翻动） | 0.55 s，7 KB |
| `seal.mp3` | 收藏落印 | 0.62 s，7.7 KB |
| `unseal.mp3` | 拆信封 | 0.95 s，11.6 KB |

- 浏览器不允许无交互自动播放，所以等第一次点击 / 按键才起乐；点击音量淡入 1.6 s
- 导航右侧「音 / 静」可随时关闭，选择存在 `jx3.sound.v1`，下次进来沿用
- 切到后台自动暂停，切回来接着放；`prefers-reduced-motion` 下关掉提示呼吸动画
- 想换曲子：替换 `assets/audio/bgm.mp3` 即可，代码只认这个路径

## 数据说明

分两套存储，按能力分工：

**云端（留言）** —— 云数据库三张表 + 七个函数，前端拿不到表，只能调函数：

| 对象 | 作用 |
| --- | --- |
| `jx3_comments` | 留言本体；含 `parent_id` / `reply_to` / `mentions` 三个楼中楼字段；RLS 打开且不建任何策略 = 只有服务端函数能读写 |
| `jx3_likes` | 一人一条赞，(comment_id, device_hash) 主键天然去重 |
| `jx3_reports` | 举报去重；满 4 条自动置 `hidden`，列表不再返回 |
| `jx3_list_comments` | 读：公开可读，带 `mine` / `liked` 标记与父级、回复对象、提及名单 |
| `jx3_add_comment` | 写：校验长度、敏感词、同设备 20 秒一条 / 每天 30 条；带 `p_parent_id` 时自动继承去处并把楼主写进 `mentions` |
| `jx3_del_comment` | 删：比对设备密钥哈希，只删得掉自己那条（父留言删掉后，楼内回复升为顶层，不连带删） |
| `jx3_toggle_like` | 赞 / 取消，返回最新计数 |
| `jx3_report_comment` | 举报，按设备去重 |
| `jx3_mentions_me` | 读：谁在留言里 @ 了我（按名号匹配 `mentions`，排除自己写的） |

**本机（收藏、行程、身份、声音开关）** —— `localStorage`，键名 `jx3.*`。
身份只存 `{ name, school, key }`，云端只收 `key` 的 sha256，不收明文。

## 落籍（登录）

没有密码，也不收手机号：名号 + 门派 + 一枚 32 位随机设备密钥。首次发言时弹出入籍面板，
之后表单里的名号与门派锁定，删改只认这台设备。

- 换浏览器 / 清缓存 = 换了个人，重新报一次即可，旧留言还在
- 想升级成真账号（手机号验证码 / 微信扫码），在同一套表上把 `device_hash` 换成 `auth.uid()`
  即可，`cloud.js` 之外不用改
- 云端只放行 `https://jx3-travel.app.workbuddy.host` 与 `http://localhost:*`；
  换到 GitHub Pages 打开会 403，页面退回本机留言并给出主站链接

### 楼中楼与 @ 提醒

留言只排两层：父留言 + 楼内回复。回「回复」也挂进同一楼里，靠「回 某某」交代对象，
不做无限缩进——窄屏缩到第三层就没法读了。

- 每条留言下有「回复」，点了编辑框上方出现可取消的「回复 某某」条；发出去自动继承父留言的去处
- 编辑框的 `@` 按钮列出当前在场的人，选中即把 `@名号` 插到光标处；正文里手写 `@名号` 也认
- 服务端把提到的名号存进 `mentions`（最多 5 个、去重、去掉 @ 前缀），回复时楼主自动进名单
- 留言板「@我」一栏读 `jx3_mentions_me`；未读数按本机 `jx3.mentions.seen` 的时间点算，点进去即清零
- 名号是自由文本，@ 的匹配是子串命中：若有人叫「半盏」也有人叫「半盏灯」，写 `@半盏灯` 会两个都算提到

### 门派心法

定位（输出 / 治疗 / 铁卫）属于**心法**，不属于门派。`SCHOOLS[name].chi` 是唯一事实来源：

```js
明教: { color: '#e8722b', tag: '…', chi: [['焚影圣诀', '输出'], ['明尊琉璃体', '铁卫']] },
丐帮: { color: '#8a6d3b', tag: '…', chi: [['笑尘诀', '输出']] },
```

- `chi[0]` 是主修，`ROLE_OF()` 取它的定位做卡片小签；`ROLES_OF()` 去重后给筛选与卡片标签
- 定位筛选按"该门派能担任的定位"命中，所以选「铁卫」会同时出现明教
- 弹层「门派心法」一栏逐条列出心法与定位；加心法只需改 `chi`

### 城际交通

`ROUTES[].moves` 与 `cities` 一一对应（第 n 段 = 第 n 站 → 第 n+1 站），渲染成城与城之间的
小签「方式 / 时长 / 票价」：

```js
moves: [{ mode: '高铁', time: '2 小时 20 分', cost: '¥185', note: '扬州东 → 杭州东' }]
```

票价为二等座 / 普通票的约数，随季节浮动，不写死车次；`note` 只在 `title` 里作补充说明。

### 题名字体

首屏与图鉴题名用思源宋体 **900**（`assets/fonts/NotoSerifSC-Heavy.woff2`，子集化后约 256 KB），
副标题仍用毛笔体，一重一轻。想回到行楷狂墨（侧掠 + 渗墨 + 飞白）：

```html
<html class="title-ink">
```

改文案后若出现缺字，重跑 `_fonts/build_fonts.py`（会同时重建 400 与 900 两个字重）。

## 声明

门派与世界观设定参考《剑网3》，版权归原作者；旅行地均为真实名胜。
其中**澎湖**一处的卡片实景图为生成图（`assets/img/penghu.jpg`），只作意象，不作地理凭据；
其余实景图为实拍素材。音频全部由 `_tools/make_audio.py` 合成，无第三方录音。
本项目为非商业的练手作品。
