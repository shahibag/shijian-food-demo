const { parseFood } = require('./food');

const LABEL_PAGE = '/pages/label/label';

function scanFood(onSuccess) {
  wx.scanCode({
    onlyFromCamera: false,
    scanType: ['qrCode'],
    success(res) {
      try { onSuccess(parseFood(res.result)); }
      catch (error) { wx.showModal({ title: '标签无法解析', content: error.message, showCancel: false }); }
    },
    fail(error) {
      if (/cancel/i.test((error && error.errMsg) || '')) {
        wx.showToast({ title: '已取消扫码', icon: 'none' });
      } else {
        wx.showModal({ title: '暂时无法扫码', content: '可选择测试二维码图片；若当前工具不支持扫码，请使用“粘贴 JSON”或下方预置样例继续演示。', showCancel: false });
      }
    }
  });
}

function rememberFood(food, source) {
  const app = getApp();
  app.globalData.currentFood = food;
  app.globalData.source = source;
  app.globalData.pendingWarning = true;
}

function openFoodLabel() {
  wx.navigateTo({ url: LABEL_PAGE });
}

module.exports = { scanFood: scanFood, rememberFood: rememberFood, openFoodLabel: openFoodLabel, LABEL_PAGE: LABEL_PAGE };
