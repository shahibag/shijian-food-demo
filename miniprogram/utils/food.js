// The QR code contains UTF-8 JSON, a sample id, or a barcode. It is never executed.
const { getFoodById, getFoodByBarcode } = require('../data/foods');

const MAX_QR_LENGTH = 4096;
const NUTRITION_FIELDS = [
  ['energy_kj', '能量'],
  ['protein_g', '蛋白质'],
  ['fat_g', '脂肪'],
  ['carbohydrate_g', '碳水化合物'],
  ['sodium_mg', '钠'],
  ['sugar_g', '糖']
];

function requireText(value, label, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new Error(label + '不能为空，且不能超过 ' + max + ' 个字符。');
  }
  return value.trim();
}

function validateFood(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('食品数据必须是一个 JSON 对象。');
  }
  const id = requireText(input.id, '食品 id', 32);
  const gtin = requireText(input.gtin, '商品条码', 13);
  const barcode = requireText(input.barcode, '扫码条码', 13);
  if (!/^\d{13}$/.test(gtin) || gtin !== barcode) {
    throw new Error('gtin 与 barcode 必须是相同的 13 位数字。');
  }
  const name = requireText(input.name, '食品名称', 60);
  const brand = requireText(input.brand, '品牌', 40);
  const category = requireText(input.category, '品类', 40);
  const spec = requireText(input.spec, '净含量', 40);
  const ingredients = requireText(input.ingredients, '配料表', 500);
  if (!Array.isArray(input.allergens)) {
    throw new Error('必须提供 allergens 致敏原数组；未标示时请填写 []。');
  }
  if (input.allergens.length > 20 || input.allergens.some(function (item) {
    return typeof item !== 'string' || !item.trim() || item.trim().length > 30;
  })) {
    throw new Error('致敏原必须为非空文字，每项不超过 30 个字符，最多 20 项。');
  }
  if (input.allergenFieldMissing !== undefined && typeof input.allergenFieldMissing !== 'boolean') {
    throw new Error('allergenFieldMissing 必须是布尔值。');
  }
  if (!input.nutrition || typeof input.nutrition !== 'object' || Array.isArray(input.nutrition)) {
    throw new Error('必须提供 nutrition 营养成分对象。');
  }
  const nutrition = {};
  NUTRITION_FIELDS.forEach(function (pair) {
    const value = input.nutrition[pair[0]];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error(pair[1] + '必须是大于或等于 0 的有效数字。');
    }
    nutrition[pair[0]] = value;
  });
  if (input.basis !== '100g' && input.basis !== '100mL') {
    throw new Error('basis 只能是 "100g" 或 "100mL"。营养成分不做份量换算。');
  }
  if (!input.shelfLife || typeof input.shelfLife !== 'object' || Array.isArray(input.shelfLife)) {
    throw new Error('必须提供 shelfLife，包含保质天数和贮存条件。');
  }
  if (!Number.isInteger(input.shelfLife.days) || input.shelfLife.days < 1 || input.shelfLife.days > 3650) {
    throw new Error('保质期天数必须是 1–3650 的整数。');
  }
  const storage = requireText(input.shelfLife.storage, '贮存条件', 80);
  const productionDate = requireText(input.productionDate, '生产日期', 10);
  assertCalendarDate(productionDate, '生产日期');
  if (input.note !== undefined && typeof input.note !== 'string') {
    throw new Error('note 必须是文字。');
  }
  const allergens = [];
  input.allergens.forEach(function (item) {
    const allergen = item.trim();
    if (allergens.indexOf(allergen) === -1) allergens.push(allergen);
  });
  return {
    id: id,
    gtin: gtin,
    barcode: barcode,
    name: name,
    brand: brand,
    category: category,
    spec: spec,
    ingredients: ingredients,
    allergens: allergens,
    allergenFieldMissing: input.allergenFieldMissing === true,
    nutrition: nutrition,
    basis: input.basis,
    shelfLife: { days: input.shelfLife.days, storage: storage },
    productionDate: productionDate,
    note: typeof input.note === 'string' ? input.note : ''
  };
}

function assertCalendarDate(iso, label) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(label + '格式应为 YYYY-MM-DD。');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(label + '不是有效的日历日期。');
  }
}

function lookupCatalog(text) {
  return getFoodById(text) || getFoodByBarcode(text);
}

function parseFood(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('二维码内容为空，请扫描附带的 JSON 测试二维码。');
  }
  if (raw.length > MAX_QR_LENGTH) {
    throw new Error('二维码内容过长，最多支持 ' + MAX_QR_LENGTH + ' 个字符。');
  }
  const text = raw.replace(/^\uFEFF/, '').trim();
  if (text[0] !== '{' && text[0] !== '[') {
    const found = lookupCatalog(text);
    if (found) return validateFood(found);
    throw new Error('二维码不是有效的 JSON 食品数据，请使用附带的测试二维码。');
  }
  let input;
  try {
    input = JSON.parse(text);
  } catch (error) {
    throw new Error('二维码不是有效的 JSON 食品数据，请使用附带的测试二维码。');
  }
  return validateFood(input);
}

module.exports = {
  parseFood: parseFood,
  validateFood: validateFood,
  assertCalendarDate: assertCalendarDate,
  MAX_QR_LENGTH: MAX_QR_LENGTH
};
