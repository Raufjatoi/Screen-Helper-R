(function() {
  let container, timeDisplay, dot, screenGlow;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'start-timer') {
      if (document.getElementById('shr-timer-container')) return;

      const glowColor = request.glowColor || 'blue';
      
      let glowBoxShadow = '';
      let timerBoxShadow = '';
      let timerBorder = '';
      let pulseGlowFrames = '';

      if (glowColor === 'blue') {
        glowBoxShadow = 'inset 0 0 40px 10px rgba(59, 130, 246, 0.6)';
        timerBoxShadow = '0 0 15px rgba(59, 130, 246, 0.8)';
        timerBorder = '1px solid rgba(59, 130, 246, 0.4)';
        pulseGlowFrames = `
          0%, 100% { box-shadow: inset 0 0 30px 10px rgba(59, 130, 246, 0.4); border: 2px solid transparent; }
          50% { box-shadow: inset 0 0 60px 15px rgba(59, 130, 246, 0.8); border: 2px solid rgba(59, 130, 246, 0.5); }
        `;
      } else if (glowColor === 'green') {
        glowBoxShadow = 'inset 0 0 40px 10px rgba(134, 239, 172, 0.6)';
        timerBoxShadow = '0 0 15px rgba(134, 239, 172, 0.8)';
        timerBorder = '1px solid rgba(255, 255, 255, 0.4)';
        pulseGlowFrames = `
          0%, 100% { box-shadow: inset 0 0 30px 10px rgba(134, 239, 172, 0.4); border: 2px solid transparent; }
          50% { box-shadow: inset 0 0 60px 15px rgba(134, 239, 172, 0.8); border: 2px solid rgba(255, 255, 255, 0.6); }
        `;
      } else if (glowColor === 'pink') {
        glowBoxShadow = 'inset 0 0 40px 10px rgba(244, 114, 182, 0.6)';
        timerBoxShadow = '0 0 15px rgba(244, 114, 182, 0.8)';
        timerBorder = '1px solid rgba(255, 255, 255, 0.4)';
        pulseGlowFrames = `
          0%, 100% { box-shadow: inset 0 0 30px 10px rgba(244, 114, 182, 0.4); border: 2px solid transparent; }
          50% { box-shadow: inset 0 0 60px 15px rgba(244, 114, 182, 0.8); border: 2px solid rgba(255, 255, 255, 0.6); }
        `;
      }

      if (glowColor !== 'none') {
        screenGlow = document.createElement('div');
        screenGlow.id = 'shr-screen-glow';
        screenGlow.style.cssText = `
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
          box-shadow: ${glowBoxShadow};
          z-index: 2147483646;
          animation: shr-pulse-glow 2s infinite;
        `;
        document.body.appendChild(screenGlow);
      }

      container = document.createElement('div');
      container.id = 'shr-timer-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.85);
        color: #fff;
        font-family: monospace;
        font-size: 16px;
        font-weight: bold;
        padding: 8px 16px;
        border-radius: 8px;
        box-shadow: ${glowColor !== 'none' ? timerBoxShadow : 'none'};
        border: ${glowColor !== 'none' ? timerBorder : '1px solid #444'};
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 10px;
        user-select: none;
      `;

      dot = document.createElement('div');
      dot.style.cssText = `
        width: 10px;
        height: 10px;
        background: #ef4444;
        border-radius: 50%;
        animation: shr-pulse 1.5s infinite;
      `;

      timeDisplay = document.createElement('span');
      timeDisplay.innerText = '00:00';
      
      const stopBtn = document.createElement('button');
      stopBtn.innerText = 'Stop';
      stopBtn.style.cssText = `
        background: #ef4444; color: white; border: none; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-weight: bold; margin-left: 5px;
        transition: background 0.2s;
      `;
      stopBtn.onmouseover = () => stopBtn.style.background = '#dc2626';
      stopBtn.onmouseout = () => stopBtn.style.background = '#ef4444';
      stopBtn.onclick = () => {
        chrome.runtime.sendMessage({ action: 'stop-record' });
      };

      container.appendChild(dot);
      container.appendChild(timeDisplay);
      container.appendChild(stopBtn);
      document.body.appendChild(container);

      // Restore position if saved
      chrome.storage.local.get(['timerPosition'], (res) => {
        if (res.timerPosition) {
          container.style.top = res.timerPosition.top + 'px';
          container.style.left = res.timerPosition.left + 'px';
          container.style.right = 'auto';
        }
      });

      // Drag logic
      container.style.cursor = 'grab';
      let isDragging = false;
      let dragStartX, dragStartY, startLeft, startTop;

      container.addEventListener('mousedown', (e) => {
        if (e.target.tagName.toLowerCase() === 'button' || e.button !== 0) return;
        e.preventDefault();
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = container.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        container.style.cursor = 'grabbing';
      });

      const onMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        container.style.left = `${startLeft + dx}px`;
        container.style.top = `${startTop + dy}px`;
        container.style.right = 'auto';
      };

      const onMouseUp = () => {
        if (isDragging) {
          isDragging = false;
          container.style.cursor = 'grab';
          chrome.storage.local.set({ 
            timerPosition: { 
               left: parseInt(container.style.left, 10), 
               top: parseInt(container.style.top, 10) 
            } 
          });
        }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      // Attach cleanup vars to global so stop-timer can destroy them
      window.shrDragCleanup = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      if (!document.getElementById('shr-timer-styles')) {
        const style = document.createElement('style');
        style.id = 'shr-timer-styles';
        style.textContent = `
          @keyframes shr-pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.8); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes shr-pulse-glow {
            ${pulseGlowFrames || ''}
          }
        `;
        document.head.appendChild(style);
      }

      const startTime = request.startTime || Date.now();
      window.shrTimerInterval = setInterval(() => {
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        const m = String(Math.floor(seconds / 60)).padStart(2, '0');
        const s = String(seconds % 60).padStart(2, '0');
        if(timeDisplay) timeDisplay.innerText = `${m}:${s}`;
      }, 1000);

    } else if (request.action === 'stop-timer') {
      clearInterval(window.shrTimerInterval);
      if (window.shrDragCleanup) window.shrDragCleanup();
      if (document.getElementById('shr-screen-glow')) document.getElementById('shr-screen-glow').remove();
      if (document.getElementById('shr-timer-container')) document.getElementById('shr-timer-container').remove();
      if (document.getElementById('shr-timer-styles')) document.getElementById('shr-timer-styles').remove();
    }
  });

  // Automatically check if we are recording this tab when the page navigates/loads
  chrome.runtime.sendMessage({ action: 'check-timer' });
})();
