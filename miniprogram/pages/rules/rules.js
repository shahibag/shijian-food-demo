const { FOODS, getFoodById } = require('../../data/foods');
const { parseFood } = require('../../utils/food');
const { ALLERGEN_OPTIONS, CONDITION_OPTIONS, evaluateFood } = require('../../utils/rules');
const { scanFood, rememberFood } = require('../../utils/scan');

function options(values, selected) { return values.map(value => ({ value, selected: selected.indexOf(value) >= 0 })); }

Page({
  data: {
    allergens: [], conditions: [], allergenOptions: [], conditionOptions: [], samples: FOODS,
    food: null, result: null, source: '', showWarning: false,
    showInput: false, jsonText: '', inputError: ''
  },
  onLoad() {
    let profile = {};
    try { profile = wx.getStorageSync('food-demo-profile') || {}; } catch (_) {}
    const allergens = Array.isArray(profile.allergens) ? profile.allergens.filter(v => ALLERGEN_OPTIONS.indexOf(v) >= 0) : [];
    const conditions = Array.isArray(profile.conditions) ? profile.conditions.filter(v => CONDITION_OPTIONS.indexOf(v) >= 0) : [];
    this.setData({ allergens, conditions });
    this.refreshOptions();
  },
  onShow() {
    const state = getApp().globalData;
    if (state.currentFood) this.displayResult(state.currentFood, state.source, false);
  },
  refreshOptions() {
    this.setData({ allergenOptions: options(ALLERGEN_OPTIONS, this.data.allergens), conditionOptions: options(CONDITION_OPTIONS, this.data.conditions) });
  },
  toggleChoice(event) {
    const { group, value } = event.currentTarget.dataset;
    if (group !== 'allergens' && group !== 'conditions') return;
    const choices = this.data[group].slice();
    const index = choices.indexOf(value);
    if (index >= 0) choices.splice(index, 1); else choices.push(value);
    this.setData({ [group]: choices, showWarning: false });
    this.refreshOptions();
    try { wx.setStorageSync('food-demo-profile', { allergens: this.data.allergens, conditions: this.data.conditions }); } catch (_) {}
    if (this.data.food) this.displayResult(this.data.food, this.data.source, false);
  },
  displayResult(food, source, popup) {
    const result = evaluateFood(food, { allergens: this.data.allergens, conditions: this.data.conditions });
    this.setData({ food, source, result, showWarning: Boolean(popup && result.alerts.length) });
  },
  acceptFood(food, source) {
    rememberFood(food, source);
    this.displayResult(food, source, true);
    this.setData({ showInput: false, inputError: '' });
  },
  scan() { scanFood(food => this.acceptFood(food, '扫码结果')); },
  chooseSample(event) {
    const food = getFoodById(event.currentTarget.dataset.id);
    if (food) this.acceptFood(parseFood(JSON.stringify(food)), '预置样例');
  },
  closeWarning() { this.setData({ showWarning: false }); },
  toggleInput() { this.setData({ showInput: !this.data.showInput, inputError: '' }); },
  onJsonInput(event) { this.setData({ jsonText: event.detail.value }); },
  submitJson() {
    try { this.acceptFood(parseFood(this.data.jsonText), 'JSON 测试'); }
    catch (error) { this.setData({ inputError: error.message }); }
  }
});
