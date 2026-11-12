// Local fictional catalog. products.json is the only sample-data source.
const PRODUCTS = require('./products.json');

const BISCUIT_IDS = ['DEMO-0001', 'DEMO-0002', 'DEMO-0003', 'DEMO-0004'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getFoodById(id) {
  const food = PRODUCTS.find(function (item) { return item.id === id; });
  return food ? clone(food) : null;
}

function getFoodByBarcode(code) {
  const food = PRODUCTS.find(function (item) { return item.barcode === code || item.gtin === code; });
  return food ? clone(food) : null;
}

function biscuitFoods() {
  return BISCUIT_IDS.map(function (id) {
    const food = getFoodById(id);
    if (!food) throw new Error('缺少对比样例：' + id);
    return food;
  });
}

function sampleButtons() {
  return PRODUCTS.map(function (item) {
    return { id: item.id, name: item.name };
  });
}

module.exports = {
  PRODUCTS: PRODUCTS,
  BISCUIT_IDS: BISCUIT_IDS,
  getFoodById: getFoodById,
  getFoodByBarcode: getFoodByBarcode,
  biscuitFoods: biscuitFoods,
  sampleButtons: sampleButtons
};
