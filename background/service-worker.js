chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start-snip') {
    injectSelector('snip');
  } else if (request.action === 'start-blur') {
    injectSelector('blur');
  } else if (request.action === 'capture-snip') {
    handleCaptureSnip(request.rect, sender.tab.id);
  } else if (request.action === 'start-record-prompt') {
    promptRecording(request.options, sendResponse);
    return true; // Keep message channel open for async
  } else if (request.action === 'stop-record') {
    stopRecording();
  } else if (request.action === 'check-timer') {
    chrome.storage.local.get(['recordingState', 'recordingTabId', 'recordingStartTime', 'glowColor'], (result) => {
      if (result.recordingState === 'active' && result.recordingTabId === sender.tab.id) {
        chrome.tabs.sendMessage(sender.tab.id, { action: 'start-timer', startTime: result.recordingStartTime, glowColor: result.glowColor }).catch(() => {});
      }
    });
  } else if (request.action === 'download-file') {
    chrome.downloads.download({
      url: request.url,
      filename: request.filename,
      saveAs: true
    });
  }
});

async function injectSelector(mode) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  // Insert CSS
  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ['content/selector.css']
  });

  // Execute Script
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content/selector.js']
  });

  // Tell the script which mode to activate
  chrome.tabs.sendMessage(tab.id, { action: 'activate-mode', mode: mode });
}

async function handleCaptureSnip(rect, tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    
    // We send the dataUrl to crop using an offscreen canvas
    cropImage(dataUrl, rect);

  } catch (err) {
    console.error('Failed to capture:', err);
  }
}

async function cropImage(dataUrl, rect) {
  // Use offscreen document to crop
  await setupOffscreenDocument('lib/offscreen.html');
  chrome.runtime.sendMessage({
    action: 'crop-image',
    dataUrl: dataUrl,
    rect: rect
  });
}

// Offscreen Document Management for Recording and Canvas
let creating; // A global promise to avoid concurrency issues
async function setupOffscreenDocument(path) {
  // Check all windows controlled by the service worker to see if one 
  // of them is the offscreen document with the given path
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  // create offscreen document
  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['USER_MEDIA', 'DISPLAY_MEDIA', 'DOM_PARSER'],
      justification: 'Recording screen and processing images'
    });
    await creating;
    creating = null;
  }
}

async function promptRecording(options, sendResponse) {
  chrome.tabCapture.getMediaStreamId({ targetTabId: options.tabId }, (streamId) => {
    if (!streamId) {
       console.log('Failed to capture tab. Make sure you are on a valid webpage.');
       if (sendResponse) sendResponse({success: false});
       return;
    }
    options.streamId = streamId;
    startRecording(options).then(() => {
       if (sendResponse) sendResponse({success: true});
    });
  });
}

async function startRecording(options) {
  await setupOffscreenDocument('lib/offscreen.html');
  const startTime = Date.now();
  await chrome.storage.local.set({ 
    recordingState: 'active', 
    recordingTabId: options.tabId, 
    recordingStartTime: startTime,
    glowColor: options.glowColor
  });
  
  if (options.tabId) {
    chrome.tabs.sendMessage(options.tabId, { action: 'start-timer', startTime: startTime, glowColor: options.glowColor }).catch(async (err) => {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: options.tabId },
          files: ['content/timer.js']
        });
        chrome.tabs.sendMessage(options.tabId, { action: 'start-timer', startTime: startTime, glowColor: options.glowColor }).catch(() => {});
      } catch (e) {
        console.log('Timer not shown: Could not inject into this type of page.', e);
      }
    });
  }
  
  chrome.runtime.sendMessage({
    action: 'begin-recording',
    options: options
  });
}

function stopRecording() {
  chrome.storage.local.set({ recordingState: 'inactive' });
  chrome.runtime.sendMessage({
    action: 'end-recording'
  });
  
  chrome.storage.local.get(['recordingTabId'], (result) => {
    if (result.recordingTabId) {
      chrome.tabs.sendMessage(result.recordingTabId, { action: 'stop-timer' }).catch(() => {});
    }
  });
}
