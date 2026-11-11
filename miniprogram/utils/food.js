// The QR code contains UTF-8 JSON, never executable code or a remote URL.
const MAX_QR_LENGTH = 4096;
const NUTRIENT_KEYS = ['sodium', 'sugar', 'fat', 'protein'];
const NUTRIENT_NAMES = { sodium: '钠', sugar: '糖', fat: '脂肪', protein: '蛋白质' };

function validateFood(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('食品数据必须是一个 JSON 对象。');
  }
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 60) {
    throw new Error('食品名称不能为空，且不能超过 60 个字符。');
  }
  if (input.basis !== '100g') {
    throw new Error('本原型仅支持每 100 克数据，请将 basis 设置为 "100g"。');
  }
  NUTRIENT_KEYS.forEach(function (key) {
    if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || input[key] < 0) {
      throw new Error(NUTRIENT_NAMES[key] + '必须是大于或等于 0 的有效数字。');
    }
  });
  if (!Array.isArray(input.allergens)) {
    throw new Error('必须提供 allergens 过敏原数组；标签未标示时请填写 []。');
  }
  if (input.allergens.length > 20 || input.allergens.some(function (item) {
    return typeof item !== 'string' || !item.trim() || item.trim().length > 30;
  })) {
    throw new Error('过敏原必须为非空文字，每项不超过 30 个字符，最多 20 项。');
  }
  if (input.id !== undefined && (typeof input.id !== 'string' || !input.id.trim() || input.id.trim().length > 64)) {
    throw new Error('食品 id 必须为 1–64 个字符的文字。');
  }
  const allergens = [];
  input.allergens.forEach(function (item) {
    const name = item.trim();
    if (allergens.indexOf(name) === -1) allergens.push(name);
  });
  return {
    id: input.id === undefined ? 'scanned-food' : input.id.trim(),
    name: input.name.trim(),
    basis: '100g',
    sodium: input.sodium,
    sugar: input.sugar,
    fat: input.fat,
    protein: input.protein,
    allergens: allergens
  };
}

function parseFood(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('二维码内容为空，请扫描附带的 JSON 测试二维码。');
  }
  if (raw.length > MAX_QR_LENGTH) {
    throw new Error('二维码内容过长，最多支持 ' + MAX_QR_LENGTH + ' 个字符。');
  }
  let input;
  try {
    input = JSON.parse(raw.replace(/^\uFEFF/, '').trim());
  } catch (error) {
    throw new Error('二维码不是有效的 JSON 食品数据，请使用附带的测试二维码。');
  }
  return validateFood(input);
}

module.exports = { parseFood: parseFood, validateFood: validateFood, MAX_QR_LENGTH: MAX_QR_LENGTH };
