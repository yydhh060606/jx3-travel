# -*- coding: utf-8 -*-
"""字体子集构建脚本（不参与线上运行，改文案后重跑一次即可）。

做法：从 fontsource 取「简体中文」完整子集（未压缩前的 1.5–2.6MB），
按站点实际出现的字符再压一次，输出到 assets/fonts/。

    python _fonts/build_fonts.py

依赖：fonttools + brotli（byte 级 woff2 输出需要 brotli）。
触发时机：data.js / index.html / 各个 js 里新增了原字体没有的字时，
新字会回落到系统宋体——重跑本脚本即可补上。
"""
import os, subprocess, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "fonts")
SRC = os.path.join(ROOT, "_fonts", "src")
os.makedirs(OUT, exist_ok=True)
os.makedirs(SRC, exist_ok=True)

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0"}

# 源：fontsource 的简体中文子集（OFL 开源字体，可自托管）
SOURCES = {
    "msz.woff2": "https://unpkg.com/@fontsource/ma-shan-zheng@5.0.13/"
                 "files/ma-shan-zheng-chinese-simplified-400-normal.woff2",
    "nssc.woff2": "https://unpkg.com/@fontsource/noto-serif-sc@5/"
                  "files/noto-serif-sc-chinese-simplified-400-normal.woff2",
    # 标题用黑体级的宋：900 字重做「醒目」的标题，正文仍用 400
    "nssc900.woff2": "https://unpkg.com/@fontsource/noto-serif-sc@5/"
                     "files/noto-serif-sc-chinese-simplified-900-normal.woff2",
}
# (源, 产物, 专用字表文件)；字表为 None 时用整站字表
JOBS = [
    ("msz.woff2", "MaShanZheng.woff2", None),
    ("nssc.woff2", "NotoSerifSC.woff2", None),
    # 900 只服务题名（首屏与图鉴都是「江湖行纪」四字），单出一份极小子集，别让首页多背 250KB
    ("nssc900.woff2", "NotoSerifSC-Heavy.woff2", "title.txt"),
]
TITLE_CHARS = "江湖行纪"

FILES = ["assets/data.js", "index.html", "assets/app.js", "assets/map.js",
         "assets/letter.js", "assets/weather.js"]


def collect_chars():
    text = ""
    for f in FILES:
        p = os.path.join(ROOT, f)
        if os.path.exists(p):
            with open(p, encoding="utf-8") as fh:
                text += fh.read()
    chars = {c for c in text if "\u4e00" <= c <= "\u9fff"}
    chars |= set("，。、；：？！“”‘’（）《》〈〉「」『』【】〔〕—…·～×÷°％＋－＝／"
                 "0123456789"
                 "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
                 ".,-:;!?'\"()[]&@#%*+=<>_|~^$/")
    # 注意：U+3000（全角空格）不能当空白过滤掉，信件落款里用到，缺了会掉回系统字体
    return {c for c in chars if c.strip() or c == "\u3000"}


def ensure_source(name):
    path = os.path.join(SRC, name)
    if os.path.exists(path) and os.path.getsize(path) > 10000:
        return path
    print("  下载 %s ..." % name)
    for i in range(3):
        r = subprocess.run(["curl", "-sL", "--max-time", "180", "-A", UA["User-Agent"],
                            "-o", path, SOURCES[name]], capture_output=True)
        if r.returncode == 0 and os.path.exists(path) and os.path.getsize(path) > 10000:
            return path
        print("    重试 %d" % (i + 1))
    raise SystemExit("下载失败：%s（检查网络后重跑，assets/fonts 未被改动）" % name)


def merge_extras(main_path, extra_path, out_path):
    """把源字体里缺的字（如「踽」）从补丁字体并回来。"""
    from fontTools.merge import Merger
    m = Merger().merge([main_path, extra_path])
    m.flavor = "woff2"
    m.save(out_path)


def main():
    chars = collect_chars()
    print("页面用字 %d 个" % len(chars))
    charfile = os.path.join(SRC, "chars.txt")
    with open(charfile, "w", encoding="utf-8") as fh:
        fh.write("".join(sorted(chars)))

    pyft = os.path.join(os.path.dirname(sys.executable), "pyftsubset.exe")
    titlefile = os.path.join(SRC, "title.txt")
    with open(titlefile, "w", encoding="utf-8") as fh:
        fh.write(TITLE_CHARS)

    for src, dst, own_chars in JOBS:
        s = ensure_source(src)
        o = os.path.join(OUT, dst)
        r = subprocess.run([pyft, s, "--output-file=" + o, "--flavor=woff2",
                            "--text-file=" + (os.path.join(SRC, own_chars) if own_chars else charfile),
                            # --text-file 会把全角空格当空白丢掉，单独补回来
                            "--unicodes=U+3000",
                            "--layout-features=kern,liga,clig,calt,locl,vert,vrt2",
                            "--no-hinting", "--desubroutinize"],
                           capture_output=True, text=True)
        if r.returncode != 0:
            print("  !! 失败", src, r.stderr[-500:]); sys.exit(1)
        # 源字体本身缺的字，从 _fonts/extra 里并回来（如「踽」）
        extra = os.path.join(ROOT, "_fonts", "extra", dst.replace(".woff2", "-extra.woff2"))
        if os.path.exists(extra):
            tmp = o + ".merged"
            merge_extras(o, extra, tmp)
            os.replace(tmp, o)
            print("    已合并补字 %s" % os.path.basename(extra))
        print("  %-20s %7.1f KB -> %7.1f KB"
              % (dst, os.path.getsize(s) / 1024, os.path.getsize(o) / 1024))
    print("完成。若新增文案出现缺字，重跑本脚本。")


if __name__ == "__main__":
    main()
