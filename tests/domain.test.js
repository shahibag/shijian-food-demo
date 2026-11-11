const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFood, validateFood, MAX_QR_LENGTH } = require('../miniprogram/utils/food');
const { classifyNutrient, describeFood } = require('../miniprogram/utils/nutrition');
const { evaluateFood } = require('../miniprogram/utils/rules');
const { FOODS, getFoodById } = require('../miniprogram/data/foods');

function foodWith(overrides) { return Object.assign({}, FOODS[0], overrides); }

test('all sample JSON payloads parse into canonical foods', () => {
  for (const food of FOODS) assert.deepEqual(parseFood(JSON.stringify(food)), food);
});

test('invalid JSON, URLs, arrays, null, empty and excessive input fail visibly', () => {
  for (const raw of ['', '  ', '{', 'https://example.com', 'null', '[]', '42', undefined, ' '.repeat(MAX_QR_LENGTH + 1) + '{}']) {
    assert.throws(() => parseFood(raw), Error);
  }
});

test('required name, nutrition basis and allergen declaration cannot silently disappear', () => {
  for (const key of ['name', 'basis', 'allergens', 'sodium', 'sugar', 'fat', 'protein']) {
    const food = foodWith();
    delete food[key];
    assert.throws(() => parseFood(JSON.stringify(food)), Error, key);
  }
  for (const overrides of [{ name: ' ' }, { basis: '100ml' }, { allergens: '花生' }, { allergens: [''] }, { allergens: [null] }, { id: 123 }]) {
    assert.throws(() => validateFood(foodWith(overrides)), Error);
  }
});

test('nutrients require actual nonnegative finite numbers', () => {
  for (const key of ['sodium', 'sugar', 'fat', 'protein']) {
    for (const value of [-1, NaN, Infinity, -Infinity, '12', null, true]) {
      assert.throws(() => validateFood(foodWith({ [key]: value })), Error);
    }
  }
  assert.equal(parseFood(JSON.stringify(foodWith({ sugar: 0 }))).sugar, 0);
});

test('normalization trims names and deduplicates allergens without mutating input', () => {
  const input = foodWith({ name: '  花生酥  ', allergens: [' 花生 ', '花生', '牛奶'] });
  const normalized = validateFood(input);
  assert.equal(normalized.name, '花生酥');
  assert.deepEqual(normalized.allergens, ['花生', '牛奶']);
  assert.equal(input.allergens[0], ' 花生 ');
});

test('lower-is-better thresholds are inclusive green and inclusive red', () => {
  for (const [key, low, high] of [['sodium', 120, 600], ['sugar', 5, 15], ['fat', 3, 20]]) {
    assert.equal(classifyNutrient(key, 0).level, 'green');
    assert.equal(classifyNutrient(key, low).level, 'green');
    assert.equal(classifyNutrient(key, low + 0.01).level, 'orange');
    assert.equal(classifyNutrient(key, high - 0.01).level, 'orange');
    assert.equal(classifyNutrient(key, high).level, 'red');
    assert.equal(classifyNutrient(key, high + 1).level, 'red');
  }
});

test('protein coloring is reversed with exact 6 and 12 boundaries', () => {
  for (const [value, level] of [[0, 'red'], [5.99, 'red'], [6, 'orange'], [11.99, 'orange'], [12, 'green'], [23, 'green']]) {
    assert.equal(classifyNutrient('protein', value).level, level);
  }
});

test('description includes readable units, labels and colors', () => {
  const described = describeFood(FOODS[0]);
  assert.equal(described.name, FOODS[0].name);
  assert.equal(described.nutrients.length, 4);
  assert.deepEqual(described.nutrients[0], { key: 'sodium', label: '钠', value: 320, unit: 'mg', level: 'orange', levelText: '中等' });
});

test('allergen matches cause red warning and all concurrent rules remain visible', () => {
  const result = evaluateFood(foodWith({ sodium: 600 }), { allergens: ['花生', '牛奶'], conditions: ['糖尿病', '高血压'] });
  assert.equal(result.level, 'red');
  assert.equal(result.alerts.length, 3);
  assert.match(result.alerts[0].detail, /花生、牛奶/);
  assert.equal(result.disclaimer, '仅作消费参考');
});

test('diabetes rule uses strict >15, independent of red nutrition at 15', () => {
  const profile = { allergens: [], conditions: ['糖尿病'] };
  assert.equal(classifyNutrient('sugar', 15).level, 'red');
  assert.equal(evaluateFood(foodWith({ sugar: 15 }), profile).alerts.length, 0);
  assert.equal(evaluateFood(foodWith({ sugar: 15.01 }), profile).level, 'orange');
});

test('hypertension demo rule starts at sodium 600', () => {
  const profile = { allergens: [], conditions: ['高血压'] };
  assert.equal(evaluateFood(foodWith({ sodium: 599.99 }), profile).alerts.length, 0);
  assert.equal(evaluateFood(foodWith({ sodium: 600 }), profile).level, 'orange');
});

test('unselected rules do not trigger; no-match never claims food is safe', () => {
  const empty = evaluateFood(FOODS[0], {});
  assert.equal(empty.level, 'neutral');
  assert.equal(empty.alerts.length, 0);
  const noMatch = evaluateFood(FOODS[2], { allergens: ['花生'], conditions: ['糖尿病'] });
  assert.equal(noMatch.alerts.length, 0);
  assert.equal(noMatch.title, '未触发已选规则');
  assert.match(noMatch.summary, /不代表/);
});

test('sample lookup returns an isolated copy and missing IDs return null', () => {
  const copy = getFoodById('peanut-crisp');
  copy.allergens.push('鸡蛋');
  assert.equal(FOODS[0].allergens.includes('鸡蛋'), false);
  assert.equal(getFoodById('missing'), null);
});
