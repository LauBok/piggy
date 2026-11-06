# Fonts come from github.com/CyanoHao/Resource-Han-Rounded (RHR-CN) and github.com/atelier-anchor/smiley-sans.
# Re-run after adding text with new characters, or those characters fall back to the system font.
# Cuts the fonts down to the characters the game's renderer files use, and writes them into
# src/renderer/fonts.css as base64 @font-face rules (the content bundle only carries text files).
# usage: python -I make_fonts.py <font dir> <renderer dir>
import base64
import io
import pathlib
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

font_dir = pathlib.Path(sys.argv[1])
renderer = pathlib.Path(sys.argv[2])

text = ''.join(p.read_text(encoding='utf-8') for p in renderer.rglob('*') if p.suffix in ('.js', '.html', '.css') and p.name != 'fonts.css')
# everything printable in ASCII and common Chinese punctuation, so names and numbers always work
chars = set(text) | set(chr(c) for c in range(32, 127)) | set('，。、！？：；“”‘’（）《》【】…—·～￥')
chars = {c for c in chars if ord(c) >= 32 and not (0x1F000 <= ord(c) <= 0x1FFFF) and not (0xFE00 <= ord(c) <= 0xFE0F) and ord(c) != 0x200D}
print('characters:', len(chars))

FONTS = [
    ('PigRound', 400, 'ResourceHanRoundedCN-Regular.ttf'),
    ('PigRound', 700, 'ResourceHanRoundedCN-Bold.ttf'),
    ('PigTitle', 400, 'SmileySans-Oblique.ttf'),
]

css = ['/* Fonts, cut down to the characters the game uses (made by make_fonts.py; do not edit).',
       '   思源圆体 Resource Han Rounded and 得意黑 Smiley Sans, both under the SIL Open Font License. */']
for family, weight, name in FONTS:
    font = TTFont(font_dir / name)
    opts = subset.Options()
    opts.flavor = 'woff'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    sub = subset.Subsetter(opts)
    sub.populate(text=''.join(chars))
    sub.subset(font)
    font.flavor = 'woff'
    buf = io.BytesIO()
    font.save(buf)
    data = buf.getvalue()
    print(f'{name}: {len(data) // 1024} KB')
    css.append(f"@font-face {{ font-family: '{family}'; font-weight: {weight}; font-display: block; "
               f"src: url(data:font/woff;base64,{base64.b64encode(data).decode()}) format('woff'); }}")

(renderer / 'fonts.css').write_text('\n'.join(css) + '\n', encoding='utf-8')
