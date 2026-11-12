const { describeFood } = require('./nutrition');
const { assertCalendarDate } = require('./food');
const { MISSING_ALLERGEN_NOTICE, inferFromIngredients, inferenceText } = require('./allergens');

function addDays(iso, days) {
  assertCalendarDate(iso, '生产日期');
  if (!Number.isInteger(days)) throw new Error('无法计算有效期。');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return date.getUTCFullYear() + '-' + month + '-' + day;
}

function presentLabel(food, source) {
  const described = describeFood(food);
  const hints = food.allergenFieldMissing ? inferFromIngredients(food.ingredients) : [];
  return {
    source: source || '',
    id: food.id,
    name: food.name,
    brand: food.brand,
    category: food.category,
    barcode: food.barcode,
    ingredients: food.ingredients,
    netContent: food.spec,
    productionDate: food.productionDate,
    shelfLifeText: food.shelfLife.days + ' 天',
    expiryDate: addDays(food.productionDate, food.shelfLife.days),
    storage: food.shelfLife.storage,
    basisText: food.basis === '100mL' ? '每 100 毫升' : '每 100 克',
    basisNote: food.basis === '100mL' ? '营养成分按每 100 毫升标注，不做份量换算。' : '营养成分按每 100 克标注，不做份量换算。',
    nutrients: described.nutrients,
    allergenText: food.allergenFieldMissing
      ? '字段未录入'
      : (food.allergens.length ? food.allergens.join('、') : '标签未列出'),
    inferredText: inferenceText(hints),
    missingNotice: food.allergenFieldMissing ? MISSING_ALLERGEN_NOTICE : ''
  };
}

module.exports = { addDays: addDays, presentLabel: presentLabel };
