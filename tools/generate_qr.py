#!/usr/bin/env python3
"""Generate real UTF-8 QR labels from the mini program's one sample-data source.

Developer-only dependencies: Python, Pillow, reportlab, Node.js.
The delivered PNGs are ready to use; none of these tools is needed by WeChat.
"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont
from reportlab.graphics.barcode.qrencoder import (
    QR8bitByte, QRCode, QRECI, QRErrorCorrectLevel,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "qrcodes"
SCALE = 8
QUIET = 4


class UTF8ECI(QRECI):
    # Reportlab's base QRECI does not count the assignment bits when picking a
    # version. UTF-8's assignment number (26) occupies exactly eight bits.
    @property
    def bitlength(self):
        return 8


def make_qr(payload):
    qr = QRCode(version=None, errorCorrectLevel=QRErrorCorrectLevel.M)
    qr.addData(UTF8ECI(26))
    qr.addData(QR8bitByte(payload.encode("utf-8")))
    qr.make()
    side = (qr.moduleCount + 2 * QUIET) * SCALE
    image = Image.new("RGB", (side, side), "white")
    draw = ImageDraw.Draw(image)
    for row in range(qr.moduleCount):
        for col in range(qr.moduleCount):
            if qr.modules[row][col]:
                x, y = (col + QUIET) * SCALE, (row + QUIET) * SCALE
                draw.rectangle((x, y, x + SCALE - 1, y + SCALE - 1), fill="black")
    return image, qr.moduleCount


def font(size):
    candidates = [
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "C:/Windows/Fonts/msyh.ttc",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    raise RuntimeError("请安装中文字体后生成汇总标签；单张二维码已生成。")


def contact_sheet(foods, images):
    columns = 5
    rows = (len(foods) + columns - 1) // columns
    cell_w, cell_h = 360, 470
    sheet = Image.new("RGB", (40 + columns * cell_w, 180 + rows * cell_h), "#f7f4f1")
    draw = ImageDraw.Draw(sheet)
    draw.text((32, 28), "食见 · JSON 测试二维码", font=font(40), fill="#2c241e")
    draw.text((32, 84), "模拟食品 · 每 100 克或 100 毫升 · 仅供参考，不构成食品优劣评价", font=font(22), fill="#6d5c50")
    thumb = 250
    for index, (food, code) in enumerate(zip(foods, images)):
        col, row = index % columns, index // columns
        x, y = 24 + col * cell_w, 140 + row * cell_h
        draw.rounded_rectangle((x, y, x + cell_w - 24, y + cell_h - 24), radius=16, fill="white", outline="#eadfd4", width=2)
        draw.text((x + 16, y + 14), food["name"], font=font(22), fill="#2c241e")
        draw.text((x + 16, y + 44), food["id"], font=font(16), fill="#6d5c50")
        resized = code.resize((thumb, thumb), Image.Resampling.NEAREST)
        sheet.paste(resized, (x + (cell_w - 24 - thumb) // 2, y + 74))
        sodium = food["nutrition"]["sodium_mg"]
        sugar = food["nutrition"]["sugar_g"]
        unit = "100mL" if food.get("basis") == "100mL" else "100g"
        draw.text((x + 16, y + 336), f"钠 {sodium} mg / 糖 {sugar} g · 每{unit}", font=font(16), fill="#2c241e")
        allergens = "、".join(food["allergens"]) or ("字段未录入" if food.get("allergenFieldMissing") else "标签未列出")
        draw.text((x + 16, y + 364), "致敏原：" + allergens, font=font(16), fill="#6d5c50")
    sheet.save(OUTPUT / "test-labels.png")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node", default=shutil.which("node"), help="Node.js 可执行文件路径")
    args = parser.parse_args()
    if not args.node:
        parser.error("未找到 Node.js，请使用 --node 指定路径。")
    source = ROOT / "miniprogram" / "data" / "foods.js"
    result = subprocess.run(
        [args.node, "-e", "process.stdout.write(JSON.stringify(require(process.argv[1]).PRODUCTS))", str(source)],
        check=True, capture_output=True, text=True, encoding="utf-8",
    )
    foods = json.loads(result.stdout)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    # A previous independent-decoder report must not cover newly generated codes.
    (OUTPUT / "verification.json").unlink(missing_ok=True)
    images = []
    manifest = []
    for food in foods:
        payload = json.dumps(food, ensure_ascii=False, separators=(",", ":"))
        json_path = OUTPUT / (food["id"] + ".json")
        json_path.write_text(payload, encoding="utf-8")
        image, modules = make_qr(payload)
        image.save(OUTPUT / (food["id"] + ".png"))
        images.append(image)
        manifest.append({"id": food["id"], "name": food["name"], "utf8_bytes": len(payload.encode("utf-8")), "modules": modules, "pixels_per_module": SCALE, "quiet_zone_modules": QUIET, "encoding": "UTF-8 with ECI 26", "error_correction": "M"})
        print(f'{food["id"]}: {image.width} × {image.height} px, {modules} modules, UTF-8 ECI 26')
    contact_sheet(foods, images)
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
