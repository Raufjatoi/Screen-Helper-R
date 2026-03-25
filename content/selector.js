(function() {
  if (window.shrSelectorInitialized) return;
  window.shrSelectorInitialized = true;

  let currentMode = null; // 'snip' or 'blur'
  let overlay, highlighter;
  let hoveredElement = null;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'activate-mode') {
      currentMode = request.mode;
      activateUI();
    }
  });

  function activateUI() {
    document.body.classList.add('shr-mode-active');
    
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'shr-overlay';
      document.body.appendChild(overlay);
    }
    
    if (!highlighter) {
      highlighter = document.createElement('div');
      highlighter.id = 'shr-highlighter';
      document.body.appendChild(highlighter);
    }

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
  }

  function deactivateUI() {
    document.body.classList.remove('shr-mode-active');
    if (overlay) overlay.remove();
    if (highlighter) highlighter.remove();
    overlay = null;
    highlighter = null;
    currentMode = null;

    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);
  }

  function handleMouseMove(e) {
    if (!currentMode) return;

    // Temporarily hide highlighter and overlay to find the element underneath
    if (highlighter) highlighter.style.display = 'none';
    if (overlay) overlay.style.display = 'none';

    const target = document.elementFromPoint(e.clientX, e.clientY);

    if (highlighter) highlighter.style.display = 'block';
    if (overlay) overlay.style.display = 'block';

    if (target && target !== hoveredElement) {
      hoveredElement = target;
      updateHighlighter();
    }
  }

  function updateHighlighter() {
    if (!hoveredElement || !highlighter) return;
    
    const rect = hoveredElement.getBoundingClientRect();
    highlighter.style.top = `${rect.top}px`;
    highlighter.style.left = `${rect.left}px`;
    highlighter.style.width = `${rect.width}px`;
    highlighter.style.height = `${rect.height}px`;
  }

  function handleClick(e) {
    if (!currentMode || !hoveredElement) return;
    
    e.preventDefault();
    e.stopPropagation();

    if (currentMode === 'snip') {
      const rect = hoveredElement.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      
      const captureRect = {
        x: rect.left * pixelRatio,
        y: rect.top * pixelRatio,
        width: rect.width * pixelRatio,
        height: rect.height * pixelRatio
      };

      deactivateUI();
      // Wait a bit for the UI to clear before capturing
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: 'capture-snip', rect: captureRect });
      }, 150);

    } else if (currentMode === 'blur') {
      hoveredElement.classList.toggle('shr-blurred');
      saveBlurredElement(hoveredElement);
      
      // Deactivate the selector after clicking so the user can use the website normally again
      deactivateUI();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      deactivateUI();
    }
  }

  function saveBlurredElement(el) {
    const path = getCssPath(el);
    if (!path) return;
    
    const urlKey = `blur_${location.origin}${location.pathname}`;

    chrome.storage.local.get([urlKey], (result) => {
      let blurredElements = result[urlKey] || [];
      const index = blurredElements.indexOf(path);
      
      if (el.classList.contains('shr-blurred')) {
        if (index === -1) blurredElements.push(path);
      } else {
        if (index > -1) blurredElements.splice(index, 1);
      }
      
      chrome.storage.local.set({ [urlKey]: blurredElements });
    });
  }

  function getCssPath(el) {
    if (!(el instanceof Element)) return;
    const path = [];
    while (el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.id) {
        selector += '#' + el.id;
        path.unshift(selector);
        break;
      } else {
        let sib = el, nth = 1;
        while (sib = sib.previousElementSibling) {
          if (sib.nodeName.toLowerCase() == selector) nth++;
        }
        if (nth != 1) selector += `:nth-of-type(${nth})`;
      }
      path.unshift(selector);
      el = el.parentNode;
    }
    return path.join(' > ');
  }
})();
