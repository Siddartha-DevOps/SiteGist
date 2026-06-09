(function() {
  const script = document.currentScript;
  const scriptUrl = new URL(script.src);
  const baseUrl = scriptUrl.origin;
  const projectId = script.getAttribute('data-project-id');
  if (!projectId) return console.error('SiteGist: data-project-id is missing');

  const container = document.createElement('div');
  container.id = 'sitegist-widget-container';
  document.body.appendChild(container);

  const style = document.createElement('style');
  style.innerHTML = `
    #sitegist-widget-bubble {
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
    #sitegist-widget-bubble:hover { transform: scale(1.1); }
    #sitegist-widget-bubble svg { color: white; width: 30px; height: 30px; }

    #sitegist-widget-iframe {
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
    #sitegist-widget-iframe.open { display: block; }

    #sitegist-proactive-tooltip {
      position: fixed;
      bottom: 92px;
      right: 20px;
      max-width: 260px;
      background: #fff;
      border-radius: 16px;
      padding: 12px 40px 12px 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.13);
      z-index: 999999;
      font-family: system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #18181b;
      cursor: pointer;
      display: none;
    }
    #sitegist-proactive-tooltip.sg-visible {
      display: block;
      animation: sg-pop 0.35s cubic-bezier(0.175,0.885,0.32,1.275);
    }
    #sitegist-proactive-tooltip::after {
      content: '';
      position: absolute;
      bottom: -7px;
      right: 28px;
      width: 14px;
      height: 14px;
      background: #fff;
      transform: rotate(45deg);
      border-radius: 2px;
    }
    #sitegist-proactive-close {
      position: absolute;
      top: 8px;
      right: 12px;
      font-size: 18px;
      line-height: 1;
      color: #a1a1aa;
      cursor: pointer;
      user-select: none;
    }
    #sitegist-proactive-close:hover { color: #52525b; }
    @keyframes sg-pop {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0);   }
    }
  `;
  document.head.appendChild(style);

  const bubble = document.createElement('div');
  bubble.id = 'sitegist-widget-bubble';
  bubble.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>';
  container.appendChild(bubble);

  const iframe = document.createElement('iframe');
  iframe.id = 'sitegist-widget-iframe';
  iframe.src = `${baseUrl}/embed/${projectId}`;
  container.appendChild(iframe);

  // Proactive tooltip
  const tooltip = document.createElement('div');
  tooltip.id = 'sitegist-proactive-tooltip';

  const tooltipClose = document.createElement('span');
  tooltipClose.id = 'sitegist-proactive-close';
  tooltipClose.textContent = '×';
  tooltip.appendChild(tooltipClose);

  const tooltipText = document.createTextNode('');
  tooltip.appendChild(tooltipText);

  container.appendChild(tooltip);

  tooltipClose.addEventListener('click', function(e) {
    e.stopPropagation();
    tooltip.classList.remove('sg-visible');
  });

  tooltip.addEventListener('click', function() {
    tooltip.classList.remove('sg-visible');
    iframe.classList.add('open');
  });

  bubble.addEventListener('click', function() {
    tooltip.classList.remove('sg-visible');
    iframe.classList.toggle('open');
  });

  window.addEventListener('message', function(event) {
    if (event.data === 'sitegist-close') {
      iframe.classList.remove('open');
    } else if (event.data && event.data.type === 'sitegist-theme') {
      bubble.style.background = event.data.color;
    } else if (event.data && event.data.type === 'sitegist-proactive') {
      tooltipText.textContent = event.data.message;
      tooltip.classList.add('sg-visible');
    }
  });
})();
