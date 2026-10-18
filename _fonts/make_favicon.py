# -*- coding: utf-8 -*-
"""从自托管字体中取出「江」字轮廓，生成印章式 favicon。
运行：python _fonts/make_favicon.py
输出：assets/favicon.svg
"""
import os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "assets", "favicon.svg")
CH = "江"


def glyph_path(font_path):
    font = TTFont(font_path)
    cmap = font.getBestCmap()
    gname = cmap[ord(CH)]
    gs = font.getGlyphSet()
    glyph = gs[gname]

    bp = BoundsPen(gs)
    glyph.draw(bp)
    xMin, yMin, xMax, yMax = bp.bounds

    pen = SVGPathPen(gs)
    glyph.draw(pen)
    return pen.getCommands(), (xMin, yMin, xMax, yMax)


def build(font_rel, seed=0):
    d, (x0, y0, x1, y1) = glyph_path(os.path.join(ROOT, font_rel))
    # 目标：字心落在 64x64 画布的 10..54 之间（方印内留边）
    box = 44.0
    scale = box / max(x1 - x0, y1 - y0)
    # 居中：把 bbox 中心移到 32,32；字体 y 轴向上，需翻转
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    tx = 32 - cx * scale
    ty = 32 + cy * scale
    tf = f"translate({tx:.2f} {ty:.2f}) scale({scale:.5f} -{scale:.5f})"
    return d, tf


if __name__ == "__main__":
    d, tf = build(os.path.join("assets", "fonts", "MaShanZheng.woff2"))
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="江湖行纪">
  <title>江湖行纪</title>
  <rect x="2" y="2" width="60" height="60" rx="7" fill="#b23a26"/>
  <rect x="5.2" y="5.2" width="53.6" height="53.6" rx="5" fill="none" stroke="#f4efe2" stroke-opacity=".55" stroke-width="1.1"/>
  <g fill="#f6f1e4">
    <path transform="{tf}" d="{d}"/>
  </g>
</svg>
"""
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(svg)
    print("written", OUT, len(svg), "bytes")
    print("transform", tf)
