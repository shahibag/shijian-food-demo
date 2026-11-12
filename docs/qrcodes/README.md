# 测试二维码

`DEMO-0001.png` 至 `DEMO-0015.png` 是真实二维码。内容是同名 JSON 的全文，不是网址。商品、品牌和营养数字都是虚构样例。营养成分按每 100 克或每 100 毫升，不是每份。

扫码时用单张 PNG。开发者工具若弹出输入框，可以粘贴同名 JSON，或只粘贴 `DEMO-0007` 这样的编号。`test-labels.png` 是十五张码的汇总，不适合拿来扫。

本次用 zbarimg 0.23.93 逐张解码，并与同名 JSON 全文比对，十五张都一致。记录在 `verification.json`。这只证明图片里的文字，不等于微信开发者工具已经重新识码。重新运行 `python3 tools/generate_qr.py` 会删掉这份记录，需要再解码一次。

生成命令：

```sh
python3 tools/generate_qr.py
```

运行小程序和拿现成 PNG 演示，都不需要 Python。
