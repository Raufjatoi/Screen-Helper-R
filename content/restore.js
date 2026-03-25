(function() {
  const urlKey = `blur_${location.origin}${location.pathname}`;
  
  chrome.storage.local.get([urlKey], (result) => {
    const blurredPaths = result[urlKey] || [];
    blurredPaths.forEach(path => {
      try {
        const el = document.querySelector(path);
        if (el) el.classList.add('shr-blurred');
      } catch (e) {
        // Ignore invalid selectors
      }
    });
  });

  // Listen for 'clear-blurs' from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'clear-blurs') {
      const elements = document.querySelectorAll('.shr-blurred');
      elements.forEach(el => el.classList.remove('shr-blurred'));
      chrome.storage.local.remove([urlKey]);
    }
  });
})();
