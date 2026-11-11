const validateFood = require('./food').validateFood;

const ALLERGEN_OPTIONS = ['花生', '牛奶', '麸质', '大豆', '鸡蛋', '坚果', '鱼', '甲壳类'];
const CONDITION_OPTIONS = ['糖尿病', '高血压'];
const DISCLAIMER = '仅作消费参考';

function evaluateFood(input, profile) {
  const food = validateFood(input);
  const selections = profile || {};
  const allergens = Array.isArray(selections.allergens) ? selections.allergens : [];
  const conditions = Array.isArray(selections.conditions) ? selections.conditions : [];
  const matches = food.allergens.filter(function (item) { return allergens.indexOf(item) !== -1; });
  const alerts = [];

  if (matches.length) {
    alerts.push({
      level: 'red',
      title: '过敏原预警',
      detail: '标签含有您勾选的过敏原：' + matches.join('、') + '。请避免食用。'
    });
  }
  if (conditions.indexOf('糖尿病') !== -1 && food.sugar > 15) {
    alerts.push({
      level: 'orange',
      title: '糖尿病关注：谨慎食用',
      detail: '糖 ' + food.sugar + ' g/100g，超过演示规则 15 g/100g。'
    });
  }
  if (conditions.indexOf('高血压') !== -1 && food.sodium >= 600) {
    alerts.push({
      level: 'orange',
      title: '高血压关注：谨慎食用',
      detail: '钠 ' + food.sodium + ' mg/100g，达到演示规则 600 mg/100g。'
    });
  }

  const hasSelections = allergens.length > 0 || conditions.length > 0;
  const level = matches.length ? 'red' : alerts.length ? 'orange' : hasSelections ? 'green' : 'neutral';
  return {
    level: level,
    title: matches.length ? '过敏原预警' : alerts.length ? '谨慎食用' : hasSelections ? '未触发已选规则' : '尚未选择关注项',
    summary: alerts.length
      ? '共触发 ' + alerts.length + ' 条规则，请查看下方原因。'
      : hasSelections
        ? '仅代表当前选择和已提供数据未触发演示规则，不代表适合所有人食用。'
        : '请勾选过敏原或慢性病，再查看对应判断结果。',
    alerts: alerts,
    disclaimer: DISCLAIMER
  };
}

module.exports = {
  ALLERGEN_OPTIONS: ALLERGEN_OPTIONS,
  CONDITION_OPTIONS: CONDITION_OPTIONS,
  DISCLAIMER: DISCLAIMER,
  evaluateFood: evaluateFood
};
