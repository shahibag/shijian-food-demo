function biscuitConclusion(foods) {
  if (!foods || !foods.length) throw new Error('没有可对比的食品。');
  const lowest = foods.reduce(function (best, item) {
    return item.nutrition.sodium_mg < best.nutrition.sodium_mg ? item : best;
  }, foods[0]);
  const highestSodium = foods.reduce(function (best, item) {
    return item.nutrition.sodium_mg > best.nutrition.sodium_mg ? item : best;
  }, foods[0]);
  const highestSugar = foods.reduce(function (best, item) {
    return item.nutrition.sugar_g > best.nutrition.sugar_g ? item : best;
  }, foods[0]);
  const unit = lowest.basis === '100mL' ? '100mL' : '100g';
  const head = '这 ' + foods.length + ' 款饼干中，' + lowest.name + '的钠含量最低（' + lowest.nutrition.sodium_mg + 'mg/' + unit + '），';
  if (highestSodium.id === highestSugar.id) {
    return head + highestSodium.name + '的钠与糖均最高。';
  }
  return head + highestSodium.name + '的钠最高，' + highestSugar.name + '的糖最高。';
}

module.exports = { biscuitConclusion: biscuitConclusion };
