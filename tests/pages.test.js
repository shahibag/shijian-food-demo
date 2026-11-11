const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { FOODS } = require('../miniprogram/data/foods');
const ROOT = path.join(__dirname, '../miniprogram');

function loadPage(name, storageValue) {
  let page;
  const app = { globalData: { currentFood: null, source: '' } };
  const calls = { scans: [], modals: [], toasts: [], storage: [] };
  const wx = {
    getStorageSync() { return storageValue; },
    setStorageSync(key, value) { calls.storage.push({ key, value }); },
    scanCode(options) { calls.scans.push(options); },
    showModal(options) { calls.modals.push(options); },
    showToast(options) { calls.toasts.push(options); }
  };
  const modules = new Map();
  const context = vm.createContext({
    wx, getApp: () => app,
    Page(config) {
      page = config;
      page.setData = function (update) { Object.assign(this.data, update); };
    }
  });
  function evaluate(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} };
    modules.set(filename, module);
    const localRequire = createRequire(filename);
    const loader = vm.runInContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})', context, { filename });
    loader(request => evaluate(localRequire.resolve(request)), module, module.exports);
    return module.exports;
  }
  evaluate(path.join(ROOT, 'pages', name, name + '.js'));
  if (page.onLoad) page.onLoad();
  return { page, calls, app };
}

test('scan page invokes wx.scanCode and displays parsed payload, keeping previous state after invalid QR', () => {
  const { page, calls, app } = loadPage('scan');
  page.scan();
  assert.equal(calls.scans[0].onlyFromCamera, false);
  assert.equal(calls.scans[0].scanType[0], 'qrCode');
  calls.scans[0].success({ result: JSON.stringify(FOODS[1]) });
  assert.equal(page.data.food.name, '原味酸奶');
  assert.equal(page.data.source, '扫码结果');
  assert.equal(app.globalData.currentFood.id, FOODS[1].id);
  calls.scans[0].success({ result: '{bad' });
  assert.equal(calls.modals[0].title, '标签无法解析');
  assert.equal(page.data.food.id, FOODS[1].id);
});

test('scan cancellation and device failure are visible without false successful scans', () => {
  const { page, calls } = loadPage('scan');
  page.scan();
  calls.scans[0].fail({ errMsg: 'scanCode:fail cancel' });
  assert.equal(calls.toasts[0].title, '已取消扫码');
  calls.scans[0].fail({ errMsg: 'scanCode:fail unavailable' });
  assert.equal(calls.modals[0].title, '暂时无法扫码');
  assert.equal(page.data.source, '预置样例');
});

test('selected peanut and diabetes produce red popup through scan callback, and changes recalculate', () => {
  const { page, calls } = loadPage('rules');
  const toggle = (group, value) => page.toggleChoice({ currentTarget: { dataset: { group, value } } });
  toggle('allergens', '花生');
  toggle('conditions', '糖尿病');
  page.scan();
  calls.scans[0].success({ result: JSON.stringify(FOODS[0]) });
  assert.equal(page.data.showWarning, true);
  assert.equal(page.data.result.level, 'red');
  assert.equal(page.data.result.alerts.length, 2);
  page.closeWarning();
  assert.equal(page.data.showWarning, false);
  toggle('allergens', '花生');
  assert.equal(page.data.result.level, 'orange');
  toggle('conditions', '糖尿病');
  assert.equal(page.data.result.level, 'neutral');
  assert.equal(calls.storage.length, 4);
});

test('hypertension sample, pasted JSON and cross-page food synchronization share rule behavior', () => {
  const { page, app } = loadPage('rules', { allergens: [], conditions: ['高血压'] });
  page.chooseSample({ currentTarget: { dataset: { id: FOODS[2].id } } });
  assert.equal(page.data.result.level, 'orange');
  assert.equal(page.data.showWarning, true);
  page.onJsonInput({ detail: { value: JSON.stringify(FOODS[1]) } });
  page.submitJson();
  assert.equal(page.data.result.level, 'green');
  assert.equal(page.data.showWarning, false);
  assert.equal(page.data.source, 'JSON 测试');
  page.onJsonInput({ detail: { value: 'https://example.invalid' } });
  page.submitJson();
  assert.ok(page.data.inputError);
  assert.equal(page.data.food.id, FOODS[1].id);
  app.globalData.currentFood = FOODS[2];
  app.globalData.source = '扫码结果';
  page.onShow();
  assert.equal(page.data.result.level, 'orange');
  assert.equal(page.data.showWarning, false);
});

test('invalid saved profile is filtered and comparison rows retain correct units and reversed protein colors', () => {
  const { page: rules } = loadPage('rules', { allergens: ['花生', 'invalid'], conditions: '糖尿病' });
  assert.equal(rules.data.allergens.join(','), '花生');
  assert.equal(rules.data.conditions.length, 0);
  const { page } = loadPage('compare');
  assert.equal(page.data.foods.length, 3);
  assert.equal(page.data.rows.length, 4);
  assert.equal(page.data.rows[0].unit, 'mg');
  assert.equal(page.data.rows[3].cells[2].level, 'green');
  assert.equal(page.data.rows[3].cells[1].level, 'red');
});

test('WeChat project entry, pages and sitemap are present with valid JSON', () => {
  const project = JSON.parse(fs.readFileSync(path.join(__dirname, '../project.config.json')));
  assert.equal(project.miniprogramRoot, 'miniprogram/');
  assert.equal(project.compileType, 'miniprogram');
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json')));
  assert.equal(app.pages.length, 3);
  for (const page of app.pages) {
    for (const ext of ['js', 'json', 'wxss', 'wxml']) assert.ok(fs.existsSync(path.join(ROOT, page + '.' + ext)));
    JSON.parse(fs.readFileSync(path.join(ROOT, page + '.json')));
  }
  JSON.parse(fs.readFileSync(path.join(ROOT, app.sitemapLocation)));
});
