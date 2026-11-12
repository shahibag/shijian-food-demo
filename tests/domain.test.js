const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseFood, validateFood, MAX_QR_LENGTH } = require('../miniprogram/utils/food');
const { CLAIMS, classifyNutrient, describeFood } = require('../miniprogram/utils/nutrition');
const { evaluateFood, DISCLAIMER, SUGAR_AVOID, SODIUM_CAUTION_FROM } = require('../miniprogram/utils/rules');
const { MISSING_ALLERGEN_NOTICE } = require('../miniprogram/utils/allergens');
const { addDays, presentLabel } = require('../miniprogram/utils/label');
const { biscuitConclusion } = require('../miniprogram/utils/conclusion');
const { PRODUCTS, getFoodById, biscuitFoods, BISCUIT_IDS } = require('../miniprogram/data/foods');

const NOTICE = '致敏原信息可能存在缺漏，请以实体包装标示为准';
const CONCLUSION = '这 4 款饼干中，全麦高纤苏打饼干的钠含量最低（320mg/100g），海盐芝士苏打饼干的钠与糖均最高。';

function byId(id) { return getFoodById(id); }
function withNutrition(id, nutrition) {
  const food = byId(id);
  food.nutrition = Object.assign({}, food.nutrition, nutrition);
  return food;
}

test('catalog keeps the 15 demo ids, fictional brands and required label text', () => {
  assert.equal(PRODUCTS.length, 15);
  const brands = [];
  PRODUCTS.forEach(function (food, index) {
    assert.equal(food.id, 'DEMO-' + String(index + 1).padStart(4, '0'));
    assert.equal(food.brand, '示例品牌' + 'ABCDEFGHIJKLMNO'[index]);
    assert.equal(food.gtin, food.barcode);
    assert.match(food.gtin, /^\d{13}$/);
    assert.equal(food.gtin.startsWith('69'), true);
    brands.push(food.brand);
    for (const value of [food.name, food.ingredients, food.spec, food.shelfLife.storage, food.productionDate]) {
      assert.equal(typeof value, 'string');
      assert.ok(value.trim());
    }
    assert.equal(Number.isInteger(food.shelfLife.days), true);
    assert.equal(presentLabel(food).note, undefined);
  });
  assert.equal(new Set(brands).size, 15);
  assert.equal(byId('DEMO-0001').gtin, '6941234500017');
});

test('comparison biscuits keep the spec numbers and the exact conclusion', () => {
  const expected = {
    'DEMO-0001': [1985, 8.2, 19.6, 66.3, 680, 6.5],
    'DEMO-0002': [1830, 9.8, 15.2, 62.1, 320, 3.1],
    'DEMO-0003': [2150, 7.5, 24.8, 64.2, 890, 11.4],
    'DEMO-0004': [1905, 8.6, 18.1, 65.8, 510, 8.9]
  };
  const foods = biscuitFoods();
  assert.deepEqual(foods.map(function (food) { return food.id; }), BISCUIT_IDS);
  foods.forEach(function (food) {
    assert.equal(food.category, '饼干');
    assert.equal(food.basis, '100g');
    assert.deepEqual([
      food.nutrition.energy_kj, food.nutrition.protein_g, food.nutrition.fat_g,
      food.nutrition.carbohydrate_g, food.nutrition.sodium_mg, food.nutrition.sugar_g
    ], expected[food.id]);
  });
  assert.equal(biscuitConclusion(foods), CONCLUSION);
  assert.equal(PRODUCTS.filter(function (food) { return food.category === '饼干'; }).some(function (food) { return food.id === 'DEMO-0005'; }), true);
});

test('chronic and allergen samples keep the spec nutrition and DEMO-0014', () => {
  assert.equal(byId('DEMO-0009').nutrition.sugar_g, 4.2);
  assert.equal(byId('DEMO-0013').nutrition.sugar_g, 13.6);
  assert.equal(byId('DEMO-0013').basis, '100mL');
  assert.equal(byId('DEMO-0011').nutrition.sodium_mg, 4800);
  assert.equal(byId('DEMO-0011').basis, '100mL');
  assert.equal(byId('DEMO-0011').category, '调味品');
  assert.equal(byId('DEMO-0015').nutrition.sodium_mg, 780);
  const oats = byId('DEMO-0014');
  assert.equal(oats.allergenFieldMissing, true);
  assert.deepEqual(oats.allergens, []);
  assert.equal(oats.ingredients.includes('燕麦片'), true);
  assert.equal(byId('DEMO-0010').allergens.length, 0);
  assert.equal(byId('DEMO-0010').allergenFieldMissing, false);
});

test('full JSON, sample ids and barcodes parse into the same catalog record', () => {
  for (const food of PRODUCTS) {
    assert.deepEqual(parseFood(JSON.stringify(food)), food);
    assert.deepEqual(parseFood(food.id), food);
    assert.deepEqual(parseFood(food.barcode), food);
  }
});

test('invalid payloads and incomplete labels fail visibly', () => {
  for (const raw of ['', '  ', '{', 'https://example.com', 'null', '[]', '42', undefined, ' '.repeat(MAX_QR_LENGTH + 1) + '{}', 'DEMO-9999']) {
    assert.throws(function () { parseFood(raw); }, Error);
  }
  const food = byId('DEMO-0001');
  for (const key of ['name', 'ingredients', 'spec', 'nutrition', 'shelfLife', 'productionDate', 'basis']) {
    const broken = JSON.parse(JSON.stringify(food));
    delete broken[key];
    assert.throws(function () { validateFood(broken); }, Error);
  }
  assert.throws(function () { validateFood(Object.assign({}, food, { basis: 'serving' })); }, Error);
  assert.throws(function () { validateFood(Object.assign({}, food, { allergens: '花生' })); }, Error);
  const badSugar = JSON.parse(JSON.stringify(food));
  badSugar.nutrition.sugar_g = '13.6';
  assert.throws(function () { validateFood(badSugar); }, Error);
});

test('DEMO-0014 is valid even though the allergen field is missing', () => {
  const oats = parseFood(JSON.stringify(byId('DEMO-0014')));
  assert.equal(oats.allergenFieldMissing, true);
  assert.deepEqual(oats.allergens, []);
});

test('orange bands use the GB 28050-2025 claim lines and stay three levels', () => {
  assert.equal(CLAIMS.sodiumHigh, 800);
  assert.equal(CLAIMS.sodiumLow, 120);
  assert.equal(CLAIMS.sugarHigh, 15);
  assert.equal(CLAIMS.sugarLow, 5);
  assert.equal(CLAIMS.fatHigh, 20);
  assert.equal(CLAIMS.proteinHigh, 12);
  for (const [key, low, high] of [['sodium_mg', 120, 800], ['sugar_g', 5, 15], ['fat_g', 3, 20]]) {
    assert.equal(classifyNutrient(key, 0).level, 'light');
    assert.equal(classifyNutrient(key, low).level, 'light');
    assert.equal(classifyNutrient(key, low + 0.01).level, 'mid');
    assert.equal(classifyNutrient(key, high - 0.01).level, 'mid');
    assert.equal(classifyNutrient(key, high).level, 'deep');
  }
  for (const [value, level] of [[0, 'deep'], [5.99, 'deep'], [6, 'mid'], [11.99, 'mid'], [12, 'light'], [23, 'light']]) {
    assert.equal(classifyNutrient('protein_g', value).level, level);
  }
  assert.equal(classifyNutrient('sugar_g', 13.6).level, 'mid');
  assert.equal(classifyNutrient('sodium_mg', 780).level, 'mid');
  assert.deepEqual(
    ['light', 'mid', 'deep'].map(function (level) { return classifyNutrient('sodium_mg', level === 'light' ? 120 : level === 'mid' ? 320 : 890).depthText; }),
    ['浅橙', '中橙', '深橙']
  );
});

test('description keeps every nutrition row and does not grade energy or carbohydrate', () => {
  const described = describeFood(byId('DEMO-0002'));
  assert.equal(described.nutrients.length, 6);
  const sugar = described.nutrients.find(function (item) { return item.key === 'sugar_g'; });
  assert.equal(sugar.level, 'light');
  assert.equal(sugar.levelText, '低糖');
  assert.equal(sugar.depthText, '浅橙');
  assert.equal(described.nutrients.find(function (item) { return item.key === 'energy_kj'; }).graded, false);
});

test('peanut samples warn only for the four foods that declare peanut', () => {
  const profile = { allergens: ['花生'], conditions: [] };
  for (const id of ['DEMO-0005', 'DEMO-0006', 'DEMO-0007', 'DEMO-0012']) {
    const result = evaluateFood(byId(id), profile);
    assert.equal(result.title, '过敏原预警', id);
    assert.match(result.alerts[0].detail, /花生/);
  }
  for (const id of ['DEMO-0008', 'DEMO-0009', 'DEMO-0010', 'DEMO-0013']) {
    const result = evaluateFood(byId(id), profile);
    assert.equal(result.alerts.some(function (alert) { return alert.title === '过敏原预警'; }), false, id);
  }
  const clean = evaluateFood(byId('DEMO-0007'), profile);
  assert.deepEqual(byId('DEMO-0007').allergens, ['花生']);
  assert.equal(clean.alerts.length, 1);
});

test('DEMO-0014 does not alert from the empty allergen field and shows the exact gap sentence', () => {
  const oats = byId('DEMO-0014');
  const result = evaluateFood(oats, { allergens: ['花生', '麸质'], conditions: [] });
  assert.deepEqual(oats.allergens, []);
  assert.equal(result.missingNotice, NOTICE);
  assert.equal(MISSING_ALLERGEN_NOTICE, NOTICE);
  assert.equal(result.alerts.some(function (alert) { return alert.title === '过敏原预警'; }), false);
  assert.equal(result.alerts.some(function (alert) { return alert.detail === NOTICE; }), true);
  const hint = result.alerts.find(function (alert) { return alert.title === '配料表解析'; });
  assert.match(hint.detail, /燕麦/);
  assert.match(hint.detail, /麸质/);
  assert.equal(result.title, '致敏原字段未录入');
});

test('chronic rules keep the five sample outcomes without converting a serving', () => {
  assert.equal(evaluateFood(byId('DEMO-0013'), { allergens: [], conditions: ['糖尿病'] }).title, '不建议食用');
  assert.match(evaluateFood(byId('DEMO-0013'), { allergens: [], conditions: ['糖尿病'] }).alerts[0].detail, /13\.6 g\/100mL/);
  assert.equal(evaluateFood(byId('DEMO-0009'), { allergens: [], conditions: ['糖尿病'] }).title, '推荐食用');
  assert.match(evaluateFood(byId('DEMO-0009'), { allergens: [], conditions: ['糖尿病'] }).alerts[0].detail, /4\.2/);
  const sauce = evaluateFood(byId('DEMO-0011'), { allergens: [], conditions: ['高血压'] });
  assert.equal(sauce.title, '不建议食用');
  assert.match(sauce.alerts[0].detail, /4800 mg\/100mL/);
  assert.match(sauce.alerts[0].detail, /按每份食用量计/);
  assert.doesNotMatch(sauce.alerts[0].detail, /每份约为/);
  const boundary = evaluateFood(byId('DEMO-0015'), { allergens: [], conditions: ['高血压'] });
  assert.equal(boundary.title, '谨慎少量');
  assert.match(boundary.alerts[0].detail, /780/);
  const quiet = evaluateFood(byId('DEMO-0010'), { allergens: ['花生'], conditions: ['糖尿病', '高血压'] });
  assert.equal(quiet.title, '无警示');
  assert.equal(quiet.alerts.length, 0);
  assert.match(quiet.summary, /不代表/);
});

test('diabetes and hypertension bands stay explicit around the claim thresholds', () => {
  assert.equal(SUGAR_AVOID, 12);
  assert.equal(SODIUM_CAUTION_FROM, 750);
  const diabetes = { allergens: [], conditions: ['糖尿病'] };
  assert.equal(evaluateFood(withNutrition('DEMO-0010', { sugar_g: 5 }), diabetes).title, '推荐食用');
  assert.equal(evaluateFood(withNutrition('DEMO-0010', { sugar_g: 11.9 }), diabetes).title, '无警示');
  assert.match(evaluateFood(withNutrition('DEMO-0010', { sugar_g: 12 }), diabetes).alerts[0].detail, /尚未达到高糖声称/);
  assert.match(evaluateFood(withNutrition('DEMO-0010', { sugar_g: 15 }), diabetes).alerts[0].detail, /达到高糖声称条件/);
  const pressure = { allergens: [], conditions: ['高血压'] };
  assert.equal(evaluateFood(withNutrition('DEMO-0010', { sodium_mg: 749 }), pressure).alerts.length, 0);
  assert.equal(evaluateFood(withNutrition('DEMO-0010', { sodium_mg: 750 }), pressure).title, '谨慎少量');
  assert.equal(evaluateFood(withNutrition('DEMO-0010', { sodium_mg: 800 }), pressure).title, '不建议食用');
  assert.doesNotMatch(evaluateFood(withNutrition('DEMO-0003', {}), pressure).alerts[0].detail, /按每份食用量计/);
  assert.equal(evaluateFood(byId('DEMO-0001'), {}).title, '尚未选择关注项');
  assert.equal(DISCLAIMER, '仅供参考，不构成食品优劣评价');
});

test('label presenter fills every complete-label field and computes the expiry date', () => {
  assert.equal(addDays('2026-11-08', 7), '2026-11-15');
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  for (const food of PRODUCTS) {
    const label = presentLabel(food, '扫码结果');
    for (const value of [label.name, label.ingredients, label.netContent, label.productionDate, label.shelfLifeText, label.expiryDate, label.storage, label.allergenText, label.basisText]) {
      assert.equal(typeof value, 'string');
      assert.ok(value.trim(), food.id);
    }
    assert.equal(label.nutrients.length, 6);
    assert.equal(label.expiryDate, addDays(food.productionDate, food.shelfLife.days));
  }
  const milk = presentLabel(byId('DEMO-0008'), '扫码结果');
  assert.equal(milk.basisText, '每 100 毫升');
  assert.match(milk.basisNote, /不做份量换算/);
  assert.equal(milk.nutrients.find(function (item) { return item.key === 'sodium_mg'; }).value, 45);
  const oats = presentLabel(byId('DEMO-0014'), '扫码结果');
  assert.equal(oats.missingNotice, NOTICE);
  assert.match(oats.inferredText, /燕麦/);
  assert.match(oats.inferredText, /麸质/);
  const sauce = presentLabel(byId('DEMO-0011'), '扫码结果');
  assert.equal(sauce.nutrients.find(function (item) { return item.key === 'sodium_mg'; }).value, 4800);
});

test('shipped QR JSON matches the catalog records', () => {
  for (const food of PRODUCTS) {
    const file = path.join(__dirname, '../docs/qrcodes', food.id + '.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), food);
  }
});

test('sample lookup returns an isolated copy', () => {
  const copy = byId('DEMO-0007');
  copy.allergens.push('鸡蛋');
  copy.nutrition.sodium_mg = 1;
  assert.deepEqual(PRODUCTS.find(function (item) { return item.id === 'DEMO-0007'; }).allergens, ['花生']);
  assert.equal(getFoodById('missing'), null);
});
