// Demo traffic-light thresholds. They do not establish a regulated nutrition claim.
const NUTRIENTS = [
  { key: 'sodium', label: '钠', unit: 'mg', low: 120, high: 600, reverse: false },
  { key: 'sugar', label: '糖', unit: 'g', low: 5, high: 15, reverse: false },
  { key: 'fat', label: '脂肪', unit: 'g', low: 3, high: 20, reverse: false },
  { key: 'protein', label: '蛋白质', unit: 'g', low: 6, high: 12, reverse: true }
];

function classifyNutrient(key, value) {
  const nutrient = NUTRIENTS.find(function (item) { return item.key === key; });
  if (!nutrient) throw new Error('未知营养成分：' + key);
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('营养数值必须是非负有限数字。');
  }
  if (nutrient.reverse) {
    if (value >= nutrient.high) return { level: 'green', levelText: '较高' };
    if (value >= nutrient.low) return { level: 'orange', levelText: '中等' };
    return { level: 'red', levelText: '较低' };
  }
  if (value <= nutrient.low) return { level: 'green', levelText: '较低' };
  if (value >= nutrient.high) return { level: 'red', levelText: '较高' };
  return { level: 'orange', levelText: '中等' };
}

function describeFood(food) {
  const nutrients = NUTRIENTS.map(function (item) {
    const grade = classifyNutrient(item.key, food[item.key]);
    return {
      key: item.key,
      label: item.label,
      value: food[item.key],
      unit: item.unit,
      level: grade.level,
      levelText: grade.levelText
    };
  });
  return Object.assign({}, food, { nutrients: nutrients });
}

module.exports = { NUTRIENTS: NUTRIENTS, classifyNutrient: classifyNutrient, describeFood: describeFood };
