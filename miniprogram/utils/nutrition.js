// Orange-depth bands follow GB 28050-2025 claim conditions where the spec lists them.
// Fat ≤3 g and protein <6 g are extra dividers so each graded nutrient still has three bands.
// The bands describe amount, not whether a food is good or bad.
const CLAIMS = {
  sodiumLow: 120,
  sodiumHigh: 800,
  sugarLow: 5,
  sugarHigh: 15,
  fatLow: 3,
  fatHigh: 20,
  proteinLow: 6,
  proteinHigh: 12
};

const NUTRIENTS = [
  { key: 'energy_kj', label: '能量', unit: 'kJ', graded: false },
  { key: 'protein_g', label: '蛋白质', unit: 'g', graded: true, low: CLAIMS.proteinLow, high: CLAIMS.proteinHigh, reverse: true, lowText: '较低', midText: '中等', highText: '高蛋白' },
  { key: 'fat_g', label: '脂肪', unit: 'g', graded: true, low: CLAIMS.fatLow, high: CLAIMS.fatHigh, reverse: false, lowText: '较低', midText: '中等', highText: '高脂' },
  { key: 'carbohydrate_g', label: '碳水化合物', unit: 'g', graded: false },
  { key: 'sugar_g', label: '糖', unit: 'g', graded: true, low: CLAIMS.sugarLow, high: CLAIMS.sugarHigh, reverse: false, lowText: '低糖', midText: '中等', highText: '高糖' },
  { key: 'sodium_mg', label: '钠', unit: 'mg', graded: true, low: CLAIMS.sodiumLow, high: CLAIMS.sodiumHigh, reverse: false, lowText: '低钠', midText: '中等', highText: '高钠' }
];

const DEPTH = {
  light: { level: 'light', depthText: '浅橙', depthClass: 'depth-light' },
  mid: { level: 'mid', depthText: '中橙', depthClass: 'depth-mid' },
  deep: { level: 'deep', depthText: '深橙', depthClass: 'depth-deep' }
};

function classifyNutrient(key, value) {
  const nutrient = NUTRIENTS.find(function (item) { return item.key === key; });
  if (!nutrient || !nutrient.graded) throw new Error('未知营养成分：' + key);
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('营养数值必须是非负有限数字。');
  }
  let band = DEPTH.mid;
  let levelText = nutrient.midText;
  if (nutrient.reverse) {
    if (value >= nutrient.high) { band = DEPTH.light; levelText = nutrient.highText; }
    else if (value < nutrient.low) { band = DEPTH.deep; levelText = nutrient.lowText; }
  } else if (value <= nutrient.low) {
    band = DEPTH.light;
    levelText = nutrient.lowText;
  } else if (value >= nutrient.high) {
    band = DEPTH.deep;
    levelText = nutrient.highText;
  }
  return { level: band.level, levelText: levelText, depthText: band.depthText, depthClass: band.depthClass };
}

function describeFood(food) {
  const nutrition = food.nutrition || {};
  const nutrients = NUTRIENTS.map(function (item) {
    const value = nutrition[item.key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(item.label + '缺少有效数字。');
    }
    if (!item.graded) {
      return { key: item.key, label: item.label, value: value, unit: item.unit, graded: false, level: '', levelText: '', depthText: '', depthClass: '' };
    }
    const grade = classifyNutrient(item.key, value);
    return {
      key: item.key,
      label: item.label,
      value: value,
      unit: item.unit,
      graded: true,
      level: grade.level,
      levelText: grade.levelText,
      depthText: grade.depthText,
      depthClass: grade.depthClass
    };
  });
  return Object.assign({}, food, { nutrients: nutrients });
}

module.exports = { CLAIMS: CLAIMS, NUTRIENTS: NUTRIENTS, classifyNutrient: classifyNutrient, describeFood: describeFood };
