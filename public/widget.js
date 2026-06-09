(function() {
  'use strict';

  var script = document.currentScript;
  var scriptUrl = new URL(script.src);
  var baseUrl = scriptUrl.origin;
  var projectId = script.getAttribute('data-project-id');
  if (!projectId) {
    console.error('[SiteGist] data-project-id attribute is required');
    return;
  }

  // ─── Event Emitter ──────────────────────────────────────────────────────────
  var handlers = {};

  function emit(event, data) {
    (handlers[event] || []).slice().forEach(function(fn) {
      try { fn(data); } catch(e) { console.warn('[SiteGist] Event handler error:', e); }
    });
  }

  // ─── Styles ─────────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.id = 'sitegist-styles';
  style.innerHTML = [
    '#sitegist-widget-bubble {',
    '  position:fixed; bottom:20px; right:20px;',
    '  width:60px; height:60px;',
    '  background:#155DEE;',
    '  border-radius:50%;',
    '  display:flex; align-items:center; justify-content:center;',
    '  cursor:pointer;',
    '  box-shadow:0 4px 12px rgba(0,0,0,0.15);',
    '  z-index:999999;',
    '  transition:transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275);',
    '}',
    '#sitegist-widget-bubble:hover { transform:scale(1.1); }',
    '#sitegist-widget-bubble svg { color:white; width:30px; height:30px; }',
    '#sitegist-widget-iframe {',
    '  position:fixed; bottom:90px; right:20px;',
    '  width:400px; height:600px;',
    '  max-height:calc(100vh - 120px);',
    '  max-width:calc(100vw - 40px);',
    '  border:none; border-radius:24px;',
    '  box-shadow:0 12px 24px rgba(0,0,0,0.1);',
    '  z-index:999998; display:none; background:white;',
    '  opacity:0; transform:translateY(8px);',
    '  transition:opacity 0.2s ease, transform 0.2s ease;',
    '}',
    '#sitegist-widget-iframe.open {',
    '  display:block; opacity:1; transform:translateY(0);',
    '}',
  ].join('\n');
  document.head.appendChild(style);

  // ─── DOM ────────────────────────────────────────────────────────────────────
  var container = document.createElement('div');
  container.id = 'sitegist-widget-container';
  document.body.appendChild(container);

  var bubble = document.createElement('div');
  bubble.id = 'sitegist-widget-bubble';
  container.appendChild(bubble);

  var iframe = document.createElement('iframe');
  iframe.id = 'sitegist-widget-iframe';
  iframe.src = baseUrl + '/embed/' + encodeURIComponent(projectId);
  iframe.setAttribute('allow', 'clipboard-write');
  iframe.setAttribute('title', 'SiteGist Chat');
  container.appendChild(iframe);

  // ─── Icons ──────────────────────────────────────────────────────────────────
  var ICON_CHAT = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>';
  var ICON_CLOSE = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';

  // ─── State ──────────────────────────────────────────────────────────────────
  var isOpen = false;
  var iframeReady = false;
  var pendingMessages = [];

  function postToIframe(msg) {
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage(msg, baseUrl);
    }
  }

  function flushPending() {
    pendingMessages.forEach(function(msg) { postToIframe(msg); });
    pendingMessages = [];
  }

  iframe.addEventListener('load', function() {
    iframeReady = true;
    flushPending();
  });

  // ─── Open / Close ───────────────────────────────────────────────────────────
  function openWidget() {
    if (isOpen) return;
    isOpen = true;
    iframe.classList.add('open');
    bubble.innerHTML = ICON_CLOSE;
    postToIframe({ type: 'sitegist-open' });
    emit('open');
  }

  function closeWidget() {
    if (!isOpen) return;
    isOpen = false;
    iframe.classList.remove('open');
    bubble.innerHTML = ICON_CHAT;
    postToIframe({ type: 'sitegist-close' });
    emit('close');
  }

  bubble.innerHTML = ICON_CHAT;
  bubble.onclick = function() { isOpen ? closeWidget() : openWidget(); };

  // ─── Incoming postMessages from iframe ──────────────────────────────────────
  function onMessage(event) {
    if (event.source !== iframe.contentWindow) return;
    var data = event.data;

    if (data === 'sitegist-close') {
      if (isOpen) { isOpen = false; iframe.classList.remove('open'); bubble.innerHTML = ICON_CHAT; emit('close'); }
      return;
    }

    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'sitegist-theme':
        if (data.color) bubble.style.background = data.color;
        break;
      case 'sitegist-lead':
        emit('lead', data.lead || data);
        break;
      case 'sitegist-message':
        emit('message', { text: data.text, response: data.response });
        break;
    }
  }

  window.addEventListener('message', onMessage);

  // ─── Public SDK ─────────────────────────────────────────────────────────────
  window.SiteGist = {
    open: openWidget,

    close: closeWidget,

    toggle: function() { isOpen ? closeWidget() : openWidget(); },

    identify: function(userId, traits) {
      var msg = { type: 'sitegist-identify', userId: String(userId || ''), traits: traits || {} };
      if (iframeReady) { postToIframe(msg); } else { pendingMessages.push(msg); }
      return window.SiteGist;
    },

    sendMessage: function(text) {
      if (!text || !text.trim()) return window.SiteGist;
      var msg = { type: 'sitegist-send-message', text: String(text) };
      if (!isOpen) openWidget();
      if (iframeReady) { postToIframe(msg); } else { pendingMessages.push(msg); }
      return window.SiteGist;
    },

    on: function(event, handler) {
      if (typeof handler !== 'function') return window.SiteGist;
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
      return window.SiteGist;
    },

    off: function(event, handler) {
      if (!handlers[event]) return window.SiteGist;
      handlers[event] = handler
        ? handlers[event].filter(function(fn) { return fn !== handler; })
        : [];
      return window.SiteGist;
    },

    destroy: function() {
      window.removeEventListener('message', onMessage);
      container.remove();
      style.remove();
      delete window.SiteGist;
    },

    _projectId: projectId,
    _version: '1.0.0',
  };

  // Auto-open if data attribute set
  if (script.getAttribute('data-open') === 'true') {
    openWidget();
  }

})();
