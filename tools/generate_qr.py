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
    sheet = Image.new("RGB", (1920, 1020), "#f4f7f6")
    draw = ImageDraw.Draw(sheet)
    draw.text((64, 46), "食见 · JSON 测试二维码", font=font(48), fill="#182f2a")
    draw.text((64, 115), "用于微信开发者工具 / wx.scanCode；模拟食品，每 100 克；仅作消费参考", font=font(27), fill="#52655f")
    for index, (food, code) in enumerate(zip(foods, images)):
        x = 40 + index * 630
        draw.rounded_rectangle((x, 190, x + 610, 940), radius=20, fill="white", outline="#dbe4e0", width=2)
        draw.text((x + 30, 216), food["name"], font=font(36), fill="#182f2a")
        draw.text((x + 30, 268), food["id"], font=font(22), fill="#52655f")
        sheet.paste(code, (x + (610 - code.width) // 2, 312))
        line_y = 312 + max(image.height for image in images) + 18
        draw.text((x + 30, line_y), f'糖 {food["sugar"]} g  /  钠 {food["sodium"]} mg', font=font(26), fill="#182f2a")
        draw.text((x + 30, line_y + 44), "过敏原：" + ("、".join(food["allergens"]) or "标签未标示"), font=font(24), fill="#52655f")
    draw.text((64, 968), "扫描单张 PNG 更方便；若模拟器不支持选图，可复制同名 JSON 到扫码结果输入框。", font=font(25), fill="#52655f")
    sheet.save(OUTPUT / "test-labels.png")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node", default=shutil.which("node"), help="Node.js 可执行文件路径")
    args = parser.parse_args()
    if not args.node:
        parser.error("未找到 Node.js，请使用 --node 指定路径。")
    source = ROOT / "miniprogram" / "data" / "foods.js"
    result = subprocess.run(
        [args.node, "-e", "process.stdout.write(JSON.stringify(require(process.argv[1]).FOODS))", str(source)],
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
