const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { getFoodById } = require('../miniprogram/data/foods');
const ROOT = path.join(__dirname, '../miniprogram');
const NOTICE = '致敏原信息可能存在缺漏，请以实体包装标示为准';
const CONCLUSION = '这 4 款饼干中，全麦高纤苏打饼干的钠含量最低（320mg/100g），海盐芝士苏打饼干的钠与糖均最高。';

function loadPage(name, storageValue) {
  let page;
  const app = { globalData: { currentFood: null, source: '', pendingWarning: false } };
  const calls = { scans: [], modals: [], toasts: [], storage: [], navigations: [], tabs: [] };
  const wx = {
    getStorageSync() { return storageValue; },
    setStorageSync(key, value) { calls.storage.push({ key: key, value: value }); },
    scanCode(options) { calls.scans.push(options); },
    showModal(options) { calls.modals.push(options); },
    showToast(options) { calls.toasts.push(options); },
    navigateTo(options) { calls.navigations.push(options); },
    switchTab(options) { calls.tabs.push(options); }
  };
  const modules = new Map();
  const context = vm.createContext({
    wx: wx,
    getApp: function () { return app; },
    Page(config) {
      page = config;
      page.setData = function (update) { Object.assign(this.data, update); };
    }
  });
  function evaluate(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    if (filename.endsWith('.json')) {
      const value = JSON.parse(fs.readFileSync(filename, 'utf8'));
      modules.set(filename, { exports: value });
      return value;
    }
    const module = { exports: {} };
    modules.set(filename, module);
    const localRequire = createRequire(filename);
    const loader = vm.runInContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})', context, { filename: filename });
    loader(function (request) { return evaluate(localRequire.resolve(request)); }, module, module.exports);
    return module.exports;
  }
  evaluate(path.join(ROOT, 'pages', name, name + '.js'));
  if (page.onLoad) page.onLoad();
  return { page: page, calls: calls, app: app };
}

function choose(page, id) {
  page.chooseSample({ currentTarget: { dataset: { id: id } } });
}

test('scan opens the complete label and keeps the previous food if the next code is invalid', () => {
  const { page, calls, app } = loadPage('scan');
  assert.equal(page.data.currentName, '');
  page.scan();
  assert.equal(calls.scans[0].onlyFromCamera, false);
  assert.equal(calls.scans[0].scanType[0], 'qrCode');
  calls.scans[0].success({ result: JSON.stringify(getFoodById('DEMO-0008')) });
  assert.equal(page.data.currentName, '纯牛奶');
  assert.equal(page.data.source, '扫码结果');
  assert.equal(app.globalData.currentFood.id, 'DEMO-0008');
  assert.equal(app.globalData.pendingWarning, true);
  assert.equal(calls.navigations[0].url, '/pages/label/label');
  calls.scans[0].success({ result: '{bad' });
  assert.equal(calls.modals[0].title, '标签无法解析');
  assert.equal(page.data.currentName, '纯牛奶');
  assert.equal(calls.navigations.length, 1);
});

test('scan cancellation and device failure do not invent a food', () => {
  const { page, calls } = loadPage('scan');
  page.scan();
  calls.scans[0].fail({ errMsg: 'scanCode:fail cancel' });
  assert.equal(calls.toasts[0].title, '已取消扫码');
  calls.scans[0].fail({ errMsg: 'scanCode:fail unavailable' });
  assert.equal(calls.modals[0].title, '暂时无法扫码');
  assert.equal(page.data.currentName, '');
  assert.equal(calls.navigations.length, 0);
});

test('rules scan shows the label first, then the allergen warning on return', () => {
  const { page, calls, app } = loadPage('rules');
  const toggle = function (group, value) { page.toggleChoice({ currentTarget: { dataset: { group: group, value: value } } }); };
  toggle('allergens', '花生');
  toggle('conditions', '糖尿病');
  page.scan();
  calls.scans[0].success({ result: JSON.stringify(getFoodById('DEMO-0007')) });
  assert.equal(page.data.showWarning, false);
  assert.equal(calls.navigations[0].url, '/pages/label/label');
  page.onShow();
  assert.equal(page.data.showWarning, true);
  assert.equal(page.data.result.title, '过敏原预警');
  assert.equal(page.data.result.level, 'red');
  assert.match(page.data.result.alerts[0].detail, /花生/);
  page.closeWarning();
  assert.equal(page.data.showWarning, false);
  toggle('allergens', '花生');
  assert.equal(page.data.result.title, '无警示');
  assert.equal(app.globalData.pendingWarning, false);
  assert.equal(calls.storage.length, 3);
  assert.equal(calls.storage[0].key, 'food-demo-profile');
});

test('sample, pasted JSON and cross-page sync keep the chronic outcomes local', () => {
  const { page, calls, app } = loadPage('rules', { allergens: [], conditions: ['高血压'] });
  choose(page, 'DEMO-0015');
  assert.equal(calls.navigations[0].url, '/pages/label/label');
  page.onShow();
  assert.equal(page.data.result.title, '谨慎少量');
  assert.equal(page.data.showWarning, true);
  page.onJsonInput({ detail: { value: JSON.stringify(getFoodById('DEMO-0011')) } });
  page.submitJson();
  page.onShow();
  assert.equal(page.data.result.title, '不建议食用');
  assert.match(page.data.result.alerts[0].detail, /按每份食用量计/);
  assert.equal(page.data.source, 'JSON 测试');
  page.onJsonInput({ detail: { value: 'https://example.invalid' } });
  page.submitJson();
  assert.ok(page.data.inputError);
  assert.equal(page.data.food.id, 'DEMO-0011');
  app.globalData.currentFood = getFoodById('DEMO-0010');
  app.globalData.source = '扫码结果';
  app.globalData.pendingWarning = false;
  page.onShow();
  assert.equal(page.data.result.title, '无警示');
  assert.equal(page.data.showWarning, false);
});

test('label page shows the complete label, including the oats gap sentence', () => {
  const { page, app } = loadPage('label');
  app.globalData.currentFood = getFoodById('DEMO-0002');
  app.globalData.source = '扫码结果';
  page.onShow();
  assert.equal(page.data.label.name, '全麦高纤苏打饼干');
  assert.equal(page.data.label.productionDate, '2026-07-18');
  assert.match(page.data.label.shelfLifeText, /270/);
  assert.equal(page.data.label.nutrients.length, 6);
  assert.equal(page.data.label.missingNotice, '');
  app.globalData.currentFood = getFoodById('DEMO-0014');
  page.onShow();
  assert.equal(page.data.label.missingNotice, NOTICE);
  assert.match(page.data.label.inferredText, /燕麦/);
  page.openRules();
});

test('saved profile is filtered and the biscuit table uses the orange bands', () => {
  const { page: rules } = loadPage('rules', { allergens: ['花生', 'invalid'], conditions: '糖尿病' });
  assert.deepEqual(rules.data.allergens, ['花生']);
  assert.equal(rules.data.conditions.length, 0);
  const { page } = loadPage('compare');
  assert.equal(page.data.foods.length, 4);
  assert.equal(page.data.conclusion, CONCLUSION);
  const sodium = page.data.rows.find(function (row) { return row.key === 'sodium_mg'; });
  const sugar = page.data.rows.find(function (row) { return row.key === 'sugar_g'; });
  assert.equal(sodium.unit, 'mg');
  assert.equal(sodium.cells.find(function (cell) { return cell.id === 'DEMO-0003'; }).level, 'deep');
  assert.equal(sodium.cells.find(function (cell) { return cell.id === 'DEMO-0002'; }).level, 'mid');
  assert.equal(sugar.cells.find(function (cell) { return cell.id === 'DEMO-0002'; }).level, 'light');
  assert.equal(page.data.rows.find(function (row) { return row.key === 'energy_kj'; }).cells[0].graded, false);
});

test('pages, disclaimer and local-only preference wording are present', () => {
  const project = JSON.parse(fs.readFileSync(path.join(__dirname, '../project.config.json')));
  assert.equal(project.miniprogramRoot, 'miniprogram/');
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json')));
  assert.deepEqual(app.pages, ['pages/scan/scan', 'pages/label/label', 'pages/rules/rules', 'pages/compare/compare']);
  for (const page of app.pages) {
    for (const ext of ['js', 'json', 'wxss', 'wxml']) assert.ok(fs.existsSync(path.join(ROOT, page + '.' + ext)));
  }
  const label = fs.readFileSync(path.join(ROOT, 'pages/label/label.wxml'), 'utf8');
  for (const word of ['名称', '配料表', '净含量', '生产日期', '保质期', '有效期', '贮存条件', '营养成分表', '致敏原', '完整标签信息']) {
    assert.equal(label.includes(word), true, word);
  }
  const shared = fs.readFileSync(path.join(ROOT, 'templates/shared.wxml'), 'utf8');
  assert.equal(shared.split('仅供参考，不构成食品优劣评价').length - 1 >= 2, true);
  assert.match(shared, /GB 28050-2025 含量声称条件/);
  const rules = fs.readFileSync(path.join(ROOT, 'pages/rules/rules.js'), 'utf8');
  assert.match(rules, /wx\.setStorageSync\('food-demo-profile'/);
  assert.match(rules, /wx\.getStorageSync\('food-demo-profile'\)/);
  assert.doesNotMatch(rules, /wx\.request|wx\.cloud|uploadFile/);
  const rulesView = fs.readFileSync(path.join(ROOT, 'pages/rules/rules.wxml'), 'utf8');
  assert.match(rulesView, /不会上传/);
  const bundled = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|wxml|wxss|json)$/.test(entry.name)) bundled.push(fs.readFileSync(full, 'utf8'));
    }
  }
  walk(ROOT);
  const source = bundled.join('\n');
  assert.doesNotMatch(source, /红灯|绿灯|黄灯|较优|颜色越绿|仅作消费参考/);
  assert.doesNotMatch(source, /wx\.request|wx\.cloud\.|uploadFile/);
  assert.match(fs.readFileSync(path.join(ROOT, 'pages/compare/compare.wxml'), 'utf8'), /不做份量换算/);
});
