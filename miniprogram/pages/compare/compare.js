const { biscuitFoods } = require('../../data/foods');
const { describeFood } = require('../../utils/nutrition');
const { biscuitConclusion } = require('../../utils/conclusion');

const SHORT = {
  'DEMO-0001': '酥脆原味',
  'DEMO-0002': '全麦高纤',
  'DEMO-0003': '海盐芝士',
  'DEMO-0004': '麦香'
};

Page({
  data: { foods: [], rows: [], conclusion: '' },
  onLoad() {
    const foods = biscuitFoods();
    const described = foods.map(describeFood);
    const rows = described[0].nutrients.map(function (nutrient, index) {
      return {
        key: nutrient.key,
        label: nutrient.label,
        unit: nutrient.unit,
        cells: described.map(function (food) {
          const cell = food.nutrients[index];
          return { id: food.id, value: cell.value, graded: cell.graded, depthClass: cell.depthClass, depthText: cell.depthText, level: cell.level };
        })
      };
    });
    this.setData({
      conclusion: biscuitConclusion(foods),
      foods: described.map(function (food) {
        return {
          id: food.id,
          name: food.name,
          shortName: SHORT[food.id] || food.name,
          allergenText: food.allergens.length ? food.allergens.join('、') : '标签未列出'
        };
      }),
      rows: rows
    });
  }
});
