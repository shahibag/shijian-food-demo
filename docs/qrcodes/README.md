# 测试二维码

以下 PNG 都是真实二维码，内容是同名 JSON 文件的完整文本，不是网站链接。全部数据均为虚构演示数据，以每 100 克为单位。

| 图片 / JSON | 建议勾选 | 预期结果 |
| --- | --- | --- |
| `peanut-crisp.png` / `peanut-crisp.json` | 花生、糖尿病 | 红色过敏原预警，同时显示糖 22 g 大于 15 g 的提醒 |
| `plain-yogurt.png` / `plain-yogurt.json` | 牛奶 | 红色牛奶过敏原预警 |
| `chicken-breast.png` / `chicken-breast.json` | 高血压 | 钠 680 mg 达到 600 mg 的“谨慎食用”提醒 |

`test-labels.png` 是便于展示或打印的三张标签汇总。扫码时优先使用单张 PNG；如开发者工具弹出模拟扫码结果输入框，可复制同名 `.json` 的全部内容。

二维码规格：456 × 456 像素，49 × 49 模块，每模块 8 像素，四周各 4 模块空白区，纠错等级 M，UTF-8 编码并声明 ECI 26。请保留白边，避免非整数缩放或有损压缩。

已使用独立的 Apple Core Image 二维码解码器逐张读取并与 JSON 全文进行相等校验，三张均通过。机器可读记录见 `verification.json`。这项检查验证图片内容；微信开发者工具内的扫码交互仍以实际运行情况为准。

修改预置食品后，可在安装了 Node.js、Pillow 和 reportlab 的开发环境中重新生成：

```sh
python3 tools/generate_qr.py
```

也可用 `--node /absolute/path/to/node` 指定 Node.js 路径。原型运行及使用现成 PNG 均不需要 Python 或 Node.js。
