const { FOODS, getFoodById } = require('../../data/foods');
const { describeFood } = require('../../utils/nutrition');
const { parseFood } = require('../../utils/food');
const { scanFood, rememberFood } = require('../../utils/scan');

Page({
  data: { food: null, samples: FOODS, source: '预置样例', allergenText: '', showInput: false, jsonText: '', inputError: '' },
  onLoad() { this.displayFood(FOODS[0], '预置样例'); },
  onShow() {
    const state = getApp().globalData;
    if (state.currentFood) this.displayFood(state.currentFood, state.source);
  },
  displayFood(food, source) {
    this.setData({ food: describeFood(food), source, allergenText: food.allergens.length ? food.allergens.join('、') : '标签未列出' });
  },
  acceptFood(food, source) {
    rememberFood(food, source);
    this.displayFood(food, source);
    this.setData({ showInput: false, inputError: '' });
  },
  scan() { scanFood(food => this.acceptFood(food, '扫码结果')); },
  chooseSample(event) {
    const food = getFoodById(event.currentTarget.dataset.id);
    if (food) this.acceptFood(parseFood(JSON.stringify(food)), '预置样例');
  },
  toggleInput() { this.setData({ showInput: !this.data.showInput, inputError: '' }); },
  onJsonInput(event) { this.setData({ jsonText: event.detail.value }); },
  submitJson() {
    try { this.acceptFood(parseFood(this.data.jsonText), 'JSON 测试'); }
    catch (error) { this.setData({ inputError: error.message }); }
  }
});
