(function() {
  const script = document.currentScript;
  const scriptUrl = new URL(script.src);
  const baseUrl = scriptUrl.origin;
  const projectId = script.getAttribute('data-project-id');
  if (!projectId) return console.error('SiteGist: data-project-id is missing');

  const BRAND = 'sitegist'; // pragma: allowlist secret
  const DISMISS_KEY = BRAND + '_proactive_dismissed_' + projectId;

  const container = document.createElement('div');
  container.id = BRAND + '-widget-container';
  document.body.appendChild(container);

  const style = document.createElement('style');
  style.innerHTML = `
    #${BRAND}-widget-bubble {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      background: #155DEE;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999999;
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    #${BRAND}-widget-bubble:hover { transform: scale(1.1); }
    #${BRAND}-widget-bubble svg { color: white; width: 30px; height: 30px; }
    
    #${BRAND}-widget-iframe {
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 400px;
      height: 600px;
      max-height: calc(100vh - 120px);
      max-width: calc(100vw - 40px);
      border: none;
      border-radius: 24px;
      box-shadow: 0 12px 24px rgba(0,0,0,0.1);
      z-index: 999998;
      display: none;
      background: white;
    }
    #${BRAND}-widget-iframe.open { display: block; }

    #${BRAND}-proactive-teaser {
      position: fixed;
      bottom: 92px;
      right: 20px;
      max-width: min(280px, calc(100vw - 100px));
      background: #fff;
      color: #18181b;
      border-radius: 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      padding: 12px 36px 12px 14px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
      z-index: 999999;
      cursor: pointer;
      opacity: 0;
      transform: translateY(8px) scale(0.96);
      pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s ease;
    }
    #${BRAND}-proactive-teaser.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    #${BRAND}-proactive-teaser::after {
      content: '';
      position: absolute;
      bottom: -6px;
      right: 28px;
      width: 12px;
      height: 12px;
      background: #fff;
      transform: rotate(45deg);
      box-shadow: 2px 2px 4px rgba(0,0,0,0.04);
    }
    #${BRAND}-proactive-dismiss {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 22px;
      height: 22px;
      border: none;
      background: transparent;
      color: #a1a1aa;
      border-radius: 999px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      line-height: 1;
      padding: 0;
    }
    #${BRAND}-proactive-dismiss:hover { color: #52525b; background: #f4f4f5; }
  `;
  document.head.appendChild(style);

  const bubble = document.createElement('div');
  bubble.id = BRAND + '-widget-bubble';
  bubble.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>';
  container.appendChild(bubble);

  const iframe = document.createElement('iframe');
  iframe.id = BRAND + '-widget-iframe';
  const embedUrl = new URL(`${baseUrl}/embed/${projectId}`);
  embedUrl.searchParams.set('pageUrl', window.location.href);
  embedUrl.searchParams.set('pageTitle', document.title);
  iframe.src = embedUrl.toString();
  container.appendChild(iframe);

  let teaser = null;
  let proactiveTimer = null;
  let proactiveConfigured = false;

  function isDismissed() {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markDismissed() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch (e) { /* ignore quota / private mode */ }
  }

  function hideTeaser() {
    if (teaser) teaser.classList.remove('visible');
  }

  function removeTeaser() {
    if (proactiveTimer) {
      clearTimeout(proactiveTimer);
      proactiveTimer = null;
    }
    if (teaser && teaser.parentNode) {
      teaser.parentNode.removeChild(teaser);
    }
    teaser = null;
  }

  function openChat() {
    iframe.classList.add('open');
    hideTeaser();
  }

  function showTeaser(message) {
    if (isDismissed() || iframe.classList.contains('open')) return;
    if (!teaser) {
      teaser = document.createElement('div');
      teaser.id = BRAND + '-proactive-teaser';
      teaser.setAttribute('role', 'button');
      teaser.setAttribute('tabindex', '0');

      const text = document.createElement('span');
      text.textContent = message;
      teaser.appendChild(text);

      const dismiss = document.createElement('button');
      dismiss.id = BRAND + '-proactive-dismiss';
      dismiss.type = 'button';
      dismiss.setAttribute('aria-label', 'Dismiss');
      dismiss.innerHTML = '&times;';
      dismiss.addEventListener('click', function(e) {
        e.stopPropagation();
        markDismissed();
        removeTeaser();
      });
      teaser.appendChild(dismiss);

      teaser.addEventListener('click', function() {
        markDismissed();
        openChat();
        removeTeaser();
      });
      teaser.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          markDismissed();
          openChat();
          removeTeaser();
        }
      });

      container.appendChild(teaser);
    } else {
      const textNode = teaser.querySelector('span');
      if (textNode) textNode.textContent = message;
    }

    // next frame so CSS transition runs
    requestAnimationFrame(function() {
      if (teaser) teaser.classList.add('visible');
    });
  }

  function scheduleProactive(config) {
    if (proactiveConfigured) return;
    proactiveConfigured = true;

    if (!config || !config.enabled || isDismissed()) return;

    const delayMs = typeof config.delayMs === 'number' && isFinite(config.delayMs)
      ? Math.max(0, config.delayMs)
      : 5000;
    const message = (config.message && String(config.message).trim()) || 'Need help?';

    proactiveTimer = setTimeout(function() {
      proactiveTimer = null;
      showTeaser(message);
    }, delayMs);
  }

  bubble.onclick = () => {
    iframe.classList.toggle('open');
    if (iframe.classList.contains('open')) {
      hideTeaser();
    }
  };

  const MSG_CLOSE = BRAND + '-close';
  const MSG_THEME = BRAND + '-theme';
  const MSG_PROACTIVE = BRAND + ':proactive';

  window.addEventListener('message', (event) => {
    if (event.data === MSG_CLOSE) {
      iframe.classList.remove('open');
    } else if (event.data && event.data.type === MSG_THEME) {
      bubble.style.background = event.data.color;
    } else if (event.data && event.data.type === MSG_PROACTIVE) {
      scheduleProactive(event.data);
    }
  });
})();
