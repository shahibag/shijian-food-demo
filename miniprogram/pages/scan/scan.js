const { sampleButtons, getFoodById } = require('../../data/foods');
const { parseFood } = require('../../utils/food');
const { scanFood, rememberFood, openFoodLabel } = require('../../utils/scan');

Page({
  data: { samples: sampleButtons(), currentName: '', source: '', showInput: false, jsonText: '', inputError: '' },
  onShow() {
    const state = getApp().globalData;
    if (state.currentFood) this.setData({ currentName: state.currentFood.name, source: state.source || '' });
  },
  acceptFood(food, source) {
    rememberFood(food, source);
    this.setData({ currentName: food.name, source: source, showInput: false, inputError: '' });
    openFoodLabel();
  },
  scan() { scanFood(food => this.acceptFood(food, '扫码结果')); },
  chooseSample(event) {
    const food = getFoodById(event.currentTarget.dataset.id);
    if (food) this.acceptFood(parseFood(JSON.stringify(food)), '预置样例');
  },
  reopenLabel() { if (getApp().globalData.currentFood) openFoodLabel(); },
  toggleInput() { this.setData({ showInput: !this.data.showInput, inputError: '' }); },
  onJsonInput(event) { this.setData({ jsonText: event.detail.value }); },
  submitJson() {
    try { this.acceptFood(parseFood(this.data.jsonText), 'JSON 测试'); }
    catch (error) { this.setData({ inputError: error.message }); }
  }
});
