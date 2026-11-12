const { sampleButtons, getFoodById } = require('../../data/foods');
const { parseFood } = require('../../utils/food');
const { presentLabel } = require('../../utils/label');
const { scanFood, rememberFood } = require('../../utils/scan');

Page({
  data: { label: null, samples: sampleButtons(), showSamples: false, showInput: false, jsonText: '', inputError: '' },
  onShow() {
    const state = getApp().globalData;
    if (state.currentFood) this.setData({ label: presentLabel(state.currentFood, state.source) });
  },
  acceptFood(food, source) {
    rememberFood(food, source);
    this.setData({ label: presentLabel(food, source), showInput: false, inputError: '', showSamples: false });
  },
  scan() { scanFood(food => this.acceptFood(food, '扫码结果')); },
  chooseSample(event) {
    const food = getFoodById(event.currentTarget.dataset.id);
    if (food) this.acceptFood(parseFood(JSON.stringify(food)), '预置样例');
  },
  toggleSamples() { this.setData({ showSamples: !this.data.showSamples }); },
  toggleInput() { this.setData({ showInput: !this.data.showInput, inputError: '' }); },
  onJsonInput(event) { this.setData({ jsonText: event.detail.value }); },
  submitJson() {
    try { this.acceptFood(parseFood(this.data.jsonText), 'JSON 测试'); }
    catch (error) { this.setData({ inputError: error.message }); }
  },
  openRules() { wx.switchTab({ url: '/pages/rules/rules' }); },
  openCompare() { wx.switchTab({ url: '/pages/compare/compare' }); }
});
