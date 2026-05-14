(function() {
  const script = document.currentScript;
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
      background: #6C5CE7;
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
  `;
  document.head.appendChild(style);

  const bubble = document.createElement('div');
  bubble.id = 'sitegist-widget-bubble';
  bubble.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>';
  container.appendChild(bubble);

  const iframe = document.createElement('iframe');
  iframe.id = 'sitegist-widget-iframe';
  iframe.src = `https://ais-pre-qbay4p7eaak6juns2gztaa-767982023487.asia-southeast1.run.app/embed/${projectId}`;
  container.appendChild(iframe);

  bubble.onclick = () => {
    iframe.classList.toggle('open');
  };

  window.addEventListener('message', (event) => {
    if (event.data === 'sitegist-close') {
      iframe.classList.remove('open');
    }
  });
})();
