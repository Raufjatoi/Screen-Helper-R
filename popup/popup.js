document.addEventListener('DOMContentLoaded', async () => {
  const btnSnip = document.getElementById('btn-snip');
  const btnBlur = document.getElementById('btn-blur');
  const btnUnblur = document.getElementById('btn-unblur');
  const btnRecord = document.getElementById('btn-record');
  const toggleCamera = document.getElementById('toggle-camera');
  const toggleAudio = document.getElementById('toggle-audio');

  // Check recording state
  let isRecording = false;
  try {
    const { recordingState } = await chrome.storage.local.get('recordingState');
    if (recordingState === 'active') {
      isRecording = true;
      updateRecordButtonState(true);
    }
  } catch (e) {
    console.error('Error getting state:', e);
  }

  btnSnip.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'start-snip' });
    window.close(); // Close popup
  });

  btnBlur.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'start-blur' });
    window.close();
  });

  btnUnblur.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: 'clear-blurs' });
    }
    window.close();
  });

  // Handle Glow Color Balls
  let selectedGlowColor = 'blue';
  const colorBalls = document.querySelectorAll('.color-ball');
  colorBalls.forEach(ball => {
    ball.addEventListener('click', () => {
      // Remove selected border from all
      colorBalls.forEach(b => {
        b.classList.remove('selected');
        if (b.dataset.color !== 'none') {
          b.style.border = '2px solid transparent';
          b.style.boxShadow = 'none';
        } else {
          b.style.border = '2px dashed #666';
        }
      });
      // Set to current
      ball.classList.add('selected');
      selectedGlowColor = ball.dataset.color;
      if (selectedGlowColor !== 'none') {
        ball.style.border = '2px solid white';
        ball.style.boxShadow = `0 0 8px ${ball.style.background}`;
      } else {
        ball.style.border = '2px solid white';
      }
    });
  });

  btnRecord.addEventListener('click', async () => {
    if (isRecording) {
      chrome.runtime.sendMessage({ action: 'stop-record' });
      isRecording = false;
      updateRecordButtonState(false);
      window.close();
    } else {
      const includeCamera = toggleCamera.checked;
      const includeAudio = toggleAudio.checked;
      const format = document.getElementById('select-format').value;
      const glowColor = selectedGlowColor;
      
      const [targetTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!targetTab) return;
      
      if (targetTab.url && (targetTab.url.startsWith('chrome://') || targetTab.url.startsWith('edge://') || targetTab.url.startsWith('about:'))) {
        alert("Chrome security prevents recording or drawing timers on internal browser screens like this one!\n\nPlease go to a normal website (like google.com) and try again.");
        return;
      }
      
      chrome.runtime.sendMessage({ 
        action: 'start-record-prompt',
        options: { 
          camera: includeCamera, 
          audio: includeAudio, 
          format: format,
          glowColor: glowColor,
          tabId: targetTab.id,
          systemAudio: includeAudio
        }
      }, () => {
        isRecording = true;
        updateRecordButtonState(true);
        window.close();
      });
    }
  });

  function updateRecordButtonState(recording) {
    if (recording) {
      btnRecord.classList.add('recording');
      btnRecord.innerHTML = '<div class="record-indicator"></div> Stop Recording';
    } else {
      btnRecord.classList.remove('recording');
      btnRecord.innerHTML = '<div class="record-indicator"></div> Record Screen';
    }
  }
});
