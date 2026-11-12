const { validateFood } = require('./food');
const { CLAIMS } = require('./nutrition');
const { MISSING_ALLERGEN_NOTICE, inferFromIngredients, inferenceText } = require('./allergens');

const ALLERGEN_OPTIONS = ['花生', '牛奶', '麸质', '小麦', '大豆', '鸡蛋', '坚果', '鱼', '甲壳类'];
const CONDITION_OPTIONS = ['糖尿病', '高血压'];
const DISCLAIMER = '仅供参考，不构成食品优劣评价';
// 13.6 g sample must say 不建议食用, while the claim color for 高糖 stays at 15 g.
const SUGAR_AVOID = 12;
const SODIUM_CAUTION_FROM = CLAIMS.sodiumHigh - 50;

function perUnit(food) {
  return food.basis === '100mL' ? '100mL' : '100g';
}

function evaluateFood(input, profile) {
  const food = validateFood(input);
  const selections = profile || {};
  const allergens = Array.isArray(selections.allergens) ? selections.allergens : [];
  const conditions = Array.isArray(selections.conditions) ? selections.conditions : [];
  const alerts = [];
  let declared = false;
  let avoid = false;
  let caution = false;
  let recommend = false;
  const per = perUnit(food);

  if (food.allergenFieldMissing) {
    const hints = inferFromIngredients(food.ingredients);
    const text = inferenceText(hints);
    if (text) {
      const selectedHits = [];
      hints.forEach(function (hint) {
        if (allergens.indexOf(hint.allergen) !== -1 && selectedHits.indexOf(hint.allergen) === -1) {
          selectedHits.push(hint.allergen);
        }
      });
      let detail = '致敏原字段未录入。' + text;
      if (selectedHits.length) detail += '与您勾选的「' + selectedHits.join('、') + '」相符。';
      alerts.push({ level: 'mid', title: '配料表解析', detail: detail });
    }
    alerts.push({ level: 'mid', title: '录入缺漏', detail: MISSING_ALLERGEN_NOTICE });
  } else {
    const matches = food.allergens.filter(function (item) { return allergens.indexOf(item) !== -1; });
    if (matches.length) {
      declared = true;
      alerts.push({
        level: 'red',
        title: '过敏原预警',
        detail: '标签致敏原含有您勾选的项目：' + matches.join('、') + '。请避免食用。'
      });
    }
  }

  if (conditions.indexOf('糖尿病') !== -1) {
    const sugar = food.nutrition.sugar_g;
    if (sugar <= CLAIMS.sugarLow) {
      recommend = true;
      alerts.push({
        level: 'ok',
        title: '糖尿病关注：推荐食用',
        detail: '糖 ' + sugar + ' g/' + per + '，达到低糖声称条件（≤' + CLAIMS.sugarLow + ' g）。糖尿病关注：推荐食用。'
      });
    } else if (sugar >= SUGAR_AVOID) {
      avoid = true;
      const claim = sugar >= CLAIMS.sugarHigh
        ? '达到高糖声称条件（≥' + CLAIMS.sugarHigh + ' g）。'
        : '已达到本原型糖尿病关注线（≥' + SUGAR_AVOID + ' g），尚未达到高糖声称（≥' + CLAIMS.sugarHigh + ' g）。';
      alerts.push({
        level: 'deep',
        title: '糖尿病关注：不建议食用',
        detail: '糖 ' + sugar + ' g/' + per + '，' + claim + '糖尿病关注：不建议食用。'
      });
    }
  }

  if (conditions.indexOf('高血压') !== -1) {
    const sodium = food.nutrition.sodium_mg;
    if (sodium >= CLAIMS.sodiumHigh) {
      avoid = true;
      let detail = '钠 ' + sodium + ' mg/' + per + '，达到高钠声称条件（≥' + CLAIMS.sodiumHigh + ' mg）。高血压关注：不建议食用。';
      if (food.category === '调味品') detail += '请按每份食用量计，本页不做份量换算。';
      alerts.push({ level: 'deep', title: '高血压关注：不建议食用', detail: detail });
    } else if (sodium >= SODIUM_CAUTION_FROM) {
      caution = true;
      alerts.push({
        level: 'mid',
        title: '高血压关注：谨慎少量',
        detail: '钠 ' + sodium + ' mg/' + per + '，未达到高钠声称（≥' + CLAIMS.sodiumHigh + ' mg），距离该线不足 50 mg。高血压关注：谨慎少量。'
      });
    }
  }

  const missing = food.allergenFieldMissing === true;
  const hasSelections = allergens.length > 0 || conditions.length > 0;
  let level = 'neutral';
  let title = hasSelections ? '无警示' : '尚未选择关注项';
  if (recommend) { level = 'ok'; title = '推荐食用'; }
  if (missing) { level = 'mid'; title = '致敏原字段未录入'; }
  if (caution) { level = 'mid'; title = '谨慎少量'; }
  if (avoid) { level = 'deep'; title = '不建议食用'; }
  if (declared) { level = 'red'; title = '过敏原预警'; }

  let summary = alerts.length
    ? '共 ' + alerts.length + ' 条提示，请查看下方原因。'
    : hasSelections
      ? '未触发已选规则，不代表适合所有人食用。'
      : '请勾选过敏原或慢性病，再查看对应判断结果。';
  if (missing && !declared && !avoid && !caution) {
    summary = '致敏原字段未录入，已按配料表关键词解析。不代表适合所有人食用。';
  }

  return {
    level: level,
    title: title,
    summary: summary,
    alerts: alerts,
    missingNotice: missing ? MISSING_ALLERGEN_NOTICE : '',
    disclaimer: DISCLAIMER
  };
}

module.exports = {
  ALLERGEN_OPTIONS: ALLERGEN_OPTIONS,
  CONDITION_OPTIONS: CONDITION_OPTIONS,
  DISCLAIMER: DISCLAIMER,
  SUGAR_AVOID: SUGAR_AVOID,
  SODIUM_CAUTION_FROM: SODIUM_CAUTION_FROM,
  evaluateFood: evaluateFood
};
