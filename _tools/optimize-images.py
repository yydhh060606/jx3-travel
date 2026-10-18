"""图片再压缩：实景 800px 宽 / WebP q72，立绘 620px + 160px 缩略。

改图后重跑一次即可（需要 Pillow）：
    C:/Users/15594/.workbuddy/binaries/python/envs/default/Scripts/python.exe _tools/optimize-images.py

规则：
- assets/img/*.webp|jpg     卡片实景，显示宽度约 330px（2 倍屏 660），800 足够
- assets/img/school/*.webp  弹层立绘，显示约 300px 宽
- assets/img/school/*-sm.webp  卡片上的 52px 圆形头像，160 足够

注意：脚本以「当前文件」为源，反复跑会二次压缩掉画质。
要重压请先从原始素材覆盖回来，或 git checkout 到压缩前的提交。
"""
from PIL import Image
import glob
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)


def fit(im, maxw):
    w, h = im.size
    return im if w <= maxw else im.resize((maxw, round(h * maxw / w)), Image.LANCZOS)


def webp(im, path, q):
    im.save(path, 'WEBP', quality=q, method=6)


def jpg(im, path, q):
    im.convert('RGB').save(path, 'JPEG', quality=q, optimize=True, progressive=True)


def main():
    total = 0
    for p in sorted(glob.glob('assets/img/*.webp')):
        im = Image.open(p).convert('RGB')
        webp(fit(im, 800), p, 72)
        total += os.path.getsize(p)
    for p in sorted(glob.glob('assets/img/*.jpg')):
        im = Image.open(p).convert('RGB')
        jpg(fit(im, 800), p, 66)
        total += os.path.getsize(p)
    for p in sorted(glob.glob('assets/img/school/*.webp')):
        if p.endswith('-sm.webp'):
            continue
        im = Image.open(p).convert('RGB')
        webp(fit(im, 620), p, 78)
        webp(fit(im, 160), p.replace('.webp', '-sm.webp'), 76)
        total += os.path.getsize(p)
    for p in sorted(glob.glob('assets/img/school/*.jpg')):
        im = Image.open(p).convert('RGB')
        jpg(fit(im, 620), p, 70)
        total += os.path.getsize(p)
    print('完成，图片合计 %.1f MB' % (total / 1048576))


if __name__ == '__main__':
    main()
