const { FOODS } = require('../../data/foods');
const { describeFood } = require('../../utils/nutrition');

Page({
  data: { foods: [], rows: [] },
  onLoad() {
    const foods = FOODS.map(describeFood);
    const rows = foods[0].nutrients.map((nutrient, index) => ({
      key: nutrient.key, label: nutrient.label, unit: nutrient.unit,
      cells: foods.map(food => ({ id: food.id, ...food.nutrients[index] }))
    }));
    this.setData({ foods: foods.map(food => ({ ...food, allergenText: food.allergens.length ? food.allergens.join('、') : '标签未列出' })), rows });
  }
});
