// Fictional foods for a local competition prototype; all quantities are per 100 g.
const FOODS = [
  {
    id: 'peanut-crisp', name: '花生牛奶酥', basis: '100g',
    sodium: 320, sugar: 22, fat: 28, protein: 9,
    allergens: ['花生', '牛奶', '麸质']
  },
  {
    id: 'plain-yogurt', name: '原味酸奶', basis: '100g',
    sodium: 55, sugar: 4.5, fat: 3.2, protein: 3.8,
    allergens: ['牛奶']
  },
  {
    id: 'chicken-breast', name: '即食鸡胸肉', basis: '100g',
    sodium: 680, sugar: 0, fat: 2, protein: 23,
    allergens: []
  }
];

function getFoodById(id) {
  const food = FOODS.find(function (item) { return item.id === id; });
  return food ? Object.assign({}, food, { allergens: food.allergens.slice() }) : null;
}

module.exports = { FOODS: FOODS, getFoodById: getFoodById };
