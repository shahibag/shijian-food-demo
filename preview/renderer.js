/* A deliberately small local QA adapter, not a replacement for WeChat compilation.
 * It renders the native WXML/WXSS and executes the native Page handlers directly.
 * wx.scanCode is explicitly simulated by JSON entry in this browser preview.
 */
(async function () {
  'use strict';
  const { files } = await fetch('/api/source').then(response => response.json());
  const config = JSON.parse(files['app.json'] || '{}');
  const app = { globalData: {} };
  const cache = {};
  const pages = {};
  let activePath;
  let activePage;
  let pendingPage;
  let rendering = false;
  const root = document.getElementById('mini-page');
  const shell = document.getElementById('preview-shell');
  const toast = document.getElementById('preview-toast');
  const templateDefinitions = {};
  const treeCache = {};

  function normalize(file) {
    const result = [];
    for (const piece of file.split('/')) {
      if (piece === '..') result.pop();
      else if (piece && piece !== '.') result.push(piece);
    }
    return result.join('/');
  }
  function resolve(file, from) {
    return normalize(file.startsWith('/') ? file : from.split('/').slice(0, -1).concat(file).join('/'));
  }
  function loadModule(file, from = '') {
    let target = resolve(file, from);
    if (!/\.(js|json)$/.test(target)) target += (target + '.json') in files ? '.json' : '.js';
    if (cache[target]) return cache[target].exports;
    if (!(target in files)) throw new Error(`Missing source module: ${target}`);
    if (target.endsWith('.json')) {
      const value = JSON.parse(files[target]);
      cache[target] = { exports: value };
      return value;
    }
    const module = { exports: {} };
    cache[target] = module;
    new Function('require', 'module', 'exports', 'Page', 'App', 'getApp', 'wx', `${files[target]}\n//# sourceURL=native/${target}`)(
      child => loadModule(child, target), module, module.exports,
      definition => { pendingPage = definition; },
      definition => { Object.assign(app, definition); if (definition.onLaunch) definition.onLaunch.call(app); },
      () => app, wx
    );
    return module.exports;
  }
  function showToast(options) {
    toast.textContent = options.title || '';
    toast.classList.add('visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('visible'), options.duration || 2000);
  }
  function dialog(title, content, buttons, textarea) {
    const overlay = document.createElement('div');
    overlay.className = 'preview-dialog-backdrop';
    const box = document.createElement('section');
    box.className = 'preview-dialog';
    box.setAttribute('role', 'dialog');
    const heading = document.createElement('h2'); heading.textContent = title; box.append(heading);
    if (content) { const paragraph = document.createElement('p'); paragraph.textContent = content; box.append(paragraph); }
    let input;
    if (textarea) { input = document.createElement('textarea'); input.value = textarea.value || ''; input.setAttribute('aria-label', '模拟扫码 JSON'); box.append(input); }
    for (const button of buttons) {
      const element = document.createElement('button'); element.textContent = button.text;
      if (button.full) element.className = 'action-option';
      element.addEventListener('click', () => { overlay.remove(); button.click(input ? input.value : undefined); });
      box.append(element);
    }
    overlay.append(box); document.body.append(overlay);
    if (input) input.focus();
  }
  const wx = {
    getStorageSync(key) { try { return JSON.parse(localStorage.getItem(`mini:${key}`) || 'null') || ''; } catch (_) { return ''; } },
    setStorageSync(key, value) { localStorage.setItem(`mini:${key}`, JSON.stringify(value)); },
    removeStorageSync(key) { localStorage.removeItem(`mini:${key}`); },
    showToast,
    showLoading(options) { showToast({ title: options.title || '加载中…', duration: 10000 }); },
    hideLoading() { toast.classList.remove('visible'); },
    vibrateShort() {},
    setNavigationBarTitle(options) { document.getElementById('native-title').textContent = options.title; },
    switchTab(options) { switchPage(options.url.replace(/^\//, '')); if (options.success) options.success(); },
    navigateTo(options) { this.switchTab(options); },
    setClipboardData(options) { if (navigator.clipboard) navigator.clipboard.writeText(options.data); showToast({ title: '已复制' }); if (options.success) options.success(); },
    showModal(options) {
      const buttons = [];
      if (options.showCancel !== false) buttons.push({ text: options.cancelText || '取消', click: () => options.success && options.success({ confirm: false, cancel: true }) });
      buttons.push({ text: options.confirmText || '确定', click: () => options.success && options.success({ confirm: true, cancel: false }) });
      dialog(options.title || '提示', options.content, buttons);
    },
    showActionSheet(options) {
      dialog('选择食品示例', '', options.itemList.map((text, tapIndex) => ({ text, full: true, click: () => options.success && options.success({ tapIndex }) })).concat({ text: '取消', full: true, click: () => options.fail && options.fail({ errMsg: 'showActionSheet:fail cancel' }) }));
    },
    scanCode(options) {
      dialog('浏览器模拟扫码', '本地预览不调用相机。粘贴测试二维码中的 JSON，走原生页面同一解析与判别逻辑。微信端使用 wx.scanCode。', [
        { text: '取消', click: () => { if (options.fail) options.fail({ errMsg: 'scanCode:fail cancel' }); if (options.complete) options.complete(); } },
        { text: '模拟扫码结果', click: result => { if (options.success) options.success({ result, scanType: 'QR_CODE' }); if (options.complete) options.complete(); } }
      ], { value: '' });
    },
    getSystemInfoSync() { return { platform: 'devtools', windowWidth: shell.clientWidth, windowHeight: window.innerHeight }; },
    nextTick(callback) { setTimeout(callback, 0); }
  };

  function evaluate(expression, scope, objectMode = false) {
    try {
      const source = objectMode ? `({${expression}})` : `(${expression})`;
      return new Function('scope', `with(scope) { return ${source}; }`)(scope);
    } catch (error) {
      console.error('WXML expression failed', expression, error.message);
      return '';
    }
  }
  function interpolate(value, scope) {
    const parts = String(value).match(/{{[\s\S]*?}}/g) || [];
    // A lone mustache keeps its raw value so wx:if can see false/0. Mixed text
    // must not swallow every pair up to the last closing braces.
    if (parts.length === 1 && String(value).trim() === parts[0]) return evaluate(parts[0].slice(2, -2), scope);
    return String(value).replace(/{{([\s\S]*?)}}/g, (_, expression) => {
      const result = evaluate(expression, scope);
      return result === undefined || result === null ? '' : String(result);
    });
  }
  function tree(file) {
    if (treeCache[file]) return treeCache[file];
    const source = (files[file] || '').replace(/<([a-zA-Z][\w:-]*)(\s[^<>]*?)?\s*\/>/g, '<$1$2></$1>');
    // HTML places a leading <template> in <head>; the shared WXML consists only
    // of templates, so an explicit body wrapper keeps those definitions visible.
    const documentTree = new DOMParser().parseFromString(`<body><div data-wxml-root>${source}</div></body>`, 'text/html');
    const sourceRoot = documentTree.body.querySelector('[data-wxml-root]');
    treeCache[file] = sourceRoot;
    collectDefinitions(sourceRoot, file);
    return sourceRoot;
  }
  function children(node) { return node.tagName && node.tagName.toLowerCase() === 'template' ? node.content.childNodes : node.childNodes; }
  function collectDefinitions(node, file) {
    for (const child of children(node)) {
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (tag === 'import' || tag === 'include') tree(resolve(child.getAttribute('src'), file));
      if (tag === 'template' && child.hasAttribute('name')) templateDefinitions[child.getAttribute('name')] = { node: child, file };
      else collectDefinitions(child, file);
    }
  }
  function renderChildren(nodes, parent, scope, file) {
    let branchMatched = false;
    let inBranch = false;
    for (const node of nodes) {
      if (node.nodeType === 3 && !node.textContent.trim()) continue;
      if (node.nodeType !== 1) { renderNode(node, parent, scope, file); continue; }
      const attrs = node.attributes;
      if (node.hasAttribute('wx:if')) {
        inBranch = true;
        branchMatched = Boolean(interpolate(node.getAttribute('wx:if'), scope));
        if (!branchMatched) continue;
      } else if (node.hasAttribute('wx:elif')) {
        const shouldRender = inBranch && !branchMatched && Boolean(interpolate(node.getAttribute('wx:elif'), scope));
        if (!shouldRender) continue;
        branchMatched = true;
      } else if (node.hasAttribute('wx:else')) {
        if (!inBranch || branchMatched) continue;
        branchMatched = true;
      } else { inBranch = false; branchMatched = false; }
      renderNode(node, parent, scope, file);
    }
  }
  function renderNode(node, parent, scope, file, skipLoop = false) {
    if (node.nodeType === 3) { parent.append(document.createTextNode(interpolate(node.textContent, scope))); return; }
    if (node.nodeType !== 1) return;
    if (!skipLoop && node.hasAttribute('wx:for')) {
      const values = interpolate(node.getAttribute('wx:for'), scope) || [];
      Array.from(values).forEach((item, index) => renderNode(node, parent, Object.assign({}, scope, {
        [node.getAttribute('wx:for-item') || 'item']: item,
        [node.getAttribute('wx:for-index') || 'index']: index
      }), file, true));
      return;
    }
    const tag = node.tagName.toLowerCase();
    if (tag === 'import' || tag === 'wxs' || (tag === 'template' && node.hasAttribute('name'))) return;
    if (tag === 'include') { const target = resolve(node.getAttribute('src'), file); renderChildren(children(tree(target)), parent, scope, target); return; }
    if (tag === 'template') {
      const definition = templateDefinitions[interpolate(node.getAttribute('is') || '', scope)];
      if (!definition) return;
      const data = node.getAttribute('data');
      let templateScope = scope;
      if (data) {
        const expression = data.replace(/^\s*{{|}}\s*$/g, '');
        templateScope = evaluate(expression, scope, true);
      }
      renderChildren(children(definition.node), parent, templateScope, definition.file);
      return;
    }
    if (tag === 'block') { renderChildren(children(node), parent, scope, file); return; }
    const tagMap = { view: 'div', text: 'span', 'scroll-view': 'div', image: 'img', navigator: 'a', 'checkbox-group': 'div', 'radio-group': 'div', checkbox: 'input', radio: 'input' };
    const element = document.createElement(tagMap[tag] || tag);
    if (tag === 'checkbox' || tag === 'radio') element.type = tag;
    for (const attribute of node.attributes) {
      const name = attribute.name;
      if (name.startsWith('wx:') || /^(bind|catch)/.test(name)) continue;
      let value = interpolate(attribute.value, scope);
      if (name === 'hidden') { element.hidden = Boolean(value); continue; }
      if (name === 'disabled' || name === 'checked') { element[name] = Boolean(value); continue; }
      if (name === 'style') value = rpx(String(value));
      if (name === 'value' && (tag === 'textarea' || tag === 'input' || tag === 'checkbox' || tag === 'radio')) element.value = value == null ? '' : value;
      else if (name !== 'space' && name !== 'decode') element.setAttribute(name, value == null ? '' : String(value));
    }
    for (const attribute of node.attributes) {
      const eventMatch = attribute.name.match(/^(bind|catch):?(tap|input|change|blur|focus|confirm|longpress)$/);
      if (!eventMatch) continue;
      const events = { tap: 'click', input: 'input', change: 'change', confirm: 'keydown', longpress: 'contextmenu', blur: 'blur', focus: 'focus' };
      element.addEventListener(events[eventMatch[2]], event => {
        if (eventMatch[1] === 'catch') event.stopPropagation();
        if (eventMatch[2] === 'confirm' && event.key !== 'Enter') return;
        const handler = activePage[attribute.value];
        if (typeof handler !== 'function') { console.error(`Missing page handler: ${attribute.value}`); return; }
        const target = { dataset: Object.assign({}, element.dataset), id: element.id };
        let value = event.target.value;
        if (tag === 'checkbox-group') value = Array.from(element.querySelectorAll('input:checked')).map(input => input.value);
        handler.call(activePage, { currentTarget: target, target: { dataset: Object.assign({}, event.target.dataset) }, detail: { value }, type: eventMatch[2] });
      });
    }
    renderChildren(children(node), element, scope, file);
    parent.append(element);
  }
  function rpx(css) { return css.replace(/(-?\d*\.?\d+)rpx\b/g, 'calc(var(--rpx) * $1)'); }
  function render() {
    if (rendering || !activePage) return;
    rendering = true;
    const focus = document.activeElement;
    const focusedName = focus && focus.getAttribute('data-preview-key');
    const selection = focus && typeof focus.selectionStart === 'number' ? [focus.selectionStart, focus.selectionEnd] : null;
    root.replaceChildren();
    renderChildren(children(tree(`${activePath}.wxml`)), root, activePage.data, `${activePath}.wxml`);
    root.querySelectorAll('textarea,input').forEach((element, index) => element.setAttribute('data-preview-key', String(index)));
    if (focusedName !== null && focusedName !== undefined) {
      const replacement = root.querySelector(`[data-preview-key="${focusedName}"]`);
      if (replacement) { replacement.focus({ preventScroll: true }); if (selection && replacement.setSelectionRange) replacement.setSelectionRange(...selection); }
    }
    rendering = false;
  }
  function applySetData(page, changes) {
    for (const [key, value] of Object.entries(changes)) {
      const route = key.replace(/\[(\d+)\]/g, '.$1').split('.');
      let target = page.data;
      route.slice(0, -1).forEach((part, index) => { if (!target[part]) target[part] = /^\d+$/.test(route[index + 1]) ? [] : {}; target = target[part]; });
      target[route[route.length - 1]] = value;
    }
  }
  function switchPage(path) {
    if (activePage && activePage.onHide) activePage.onHide();
    activePath = path;
    if (!pages[path]) {
      pendingPage = null;
      loadModule(path + '.js');
      if (!pendingPage) throw new Error(`Page was not registered: ${path}`);
      const page = pendingPage;
      page.data = JSON.parse(JSON.stringify(page.data || {}));
      page.setData = (changes, callback) => { applySetData(page, changes); if (page === activePage) render(); if (callback) callback.call(page); };
      pages[path] = page;
      activePage = page;
      if (page.onLoad) page.onLoad({});
    } else activePage = pages[path];
    const pageConfig = JSON.parse(files[`${path}.json`] || '{}');
    document.getElementById('native-title').textContent = pageConfig.navigationBarTitleText || (config.window || {}).navigationBarTitleText || '食见 · 食品标签助手';
    document.getElementById('native-styles').textContent = rpx(((files['app.wxss'] || '') + '\n' + (files[`${path}.wxss`] || '')).replace(/(^|[}\s,])page(?=\s*[{,:])/g, '$1.mini-page'));
    if (activePage.onShow) activePage.onShow();
    render();
    if (activePage.onReady && !activePage.__ready) { activePage.__ready = true; activePage.onReady(); }
    const tabs = document.getElementById('native-tabs'); tabs.replaceChildren();
    ((config.tabBar || {}).list || []).forEach(tab => {
      const button = document.createElement('button');
      if (tab.pagePath === path) button.className = 'active';
      button.setAttribute('aria-label', tab.text);
      button.append(document.createTextNode(tab.text));
      button.addEventListener('click', () => switchPage(tab.pagePath)); tabs.append(button);
    });
    const onTab = ((config.tabBar || {}).list || []).some(tab => tab.pagePath === path);
    tabs.hidden = !onTab;
    tabs.style.display = onTab ? 'flex' : 'none';
    document.getElementById('mini-page').style.paddingBottom = onTab ? '78px' : '12px';
    history.replaceState(null, '', `/#${path}`);
    window.scrollTo(0, 0);
    document.title = `${pageConfig.navigationBarTitleText || '食见'} · 小程序源码本地预览`;
  }
  function resize() { shell.style.setProperty('--rpx', `${shell.clientWidth / 750}px`); }
  window.addEventListener('resize', resize); resize();
  if (files['app.js']) loadModule('app.js');
  const initial = location.hash.slice(1);
  switchPage(config.pages && config.pages.includes(initial) ? initial : (config.pages || [])[0]);
  window.__miniPreview = { get page() { return activePage; }, get app() { return app; }, wx, switchPage, render, files };
})().catch(error => {
  console.error(error);
  document.getElementById('mini-page').textContent = `预览加载失败：${error.message}`;
});
