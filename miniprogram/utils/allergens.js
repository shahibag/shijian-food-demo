// Ingredient fallback used only when the allergen field was not filled in.
const MISSING_ALLERGEN_NOTICE = '致敏原信息可能存在缺漏，请以实体包装标示为准';

const INGREDIENT_HINTS = [
  { keyword: '燕麦', allergen: '麸质' },
  { keyword: '小麦', allergen: '麸质' },
  { keyword: '麸质', allergen: '麸质' },
  { keyword: '花生', allergen: '花生' },
  { keyword: '牛奶', allergen: '牛奶' },
  { keyword: '牛乳', allergen: '牛奶' },
  { keyword: '乳粉', allergen: '牛奶' },
  { keyword: '大豆', allergen: '大豆' },
  { keyword: '鸡蛋', allergen: '鸡蛋' }
];

function inferFromIngredients(ingredients) {
  const text = typeof ingredients === 'string' ? ingredients : '';
  const found = [];
  INGREDIENT_HINTS.forEach(function (hint) {
    if (text.indexOf(hint.keyword) === -1) return;
    if (found.some(function (item) { return item.allergen === hint.allergen; })) return;
    found.push({ keyword: hint.keyword, allergen: hint.allergen });
  });
  return found;
}

function inferenceText(hints) {
  return hints.map(function (hint) {
    return '配料表含「' + hint.keyword + '」，可能含有' + hint.allergen + '。';
  }).join('');
}

module.exports = {
  MISSING_ALLERGEN_NOTICE: MISSING_ALLERGEN_NOTICE,
  inferFromIngredients: inferFromIngredients,
  inferenceText: inferenceText
};
