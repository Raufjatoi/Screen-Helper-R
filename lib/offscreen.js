let mediaRecorder;
let recordedChunks = [];
let mediaStream;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'crop-image') {
    handleCropImage(request.dataUrl, request.rect);
  } else if (request.action === 'begin-recording') {
    startScreenRecording(request.options);
  } else if (request.action === 'end-recording') {
    stopScreenRecording();
  }
});

async function handleCropImage(dataUrl, rect) {
  const canvas = document.getElementById('crop-canvas');
  const ctx = canvas.getContext('2d');
  
  const img = new Image();
  img.onload = () => {
    // Determine the scaling if the captured screen size doesn't match the reported window/viewport size
    // For simplicity, we assume pixel coordinates provided in `rect` match the unscaled image coordinates
    // Adjustments might be needed depending on devicePixelRatio
    
    // Set canvas size to the requested crop size
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Draw the specific portion of the image into the canvas
    ctx.drawImage(
      img, 
      rect.x, rect.y, rect.width, rect.height, // Source rectangle
      0, 0, rect.width, rect.height           // Destination rectangle (filling the canvas)
    );

    // Get the cropped image data URL
    const croppedDataUrl = canvas.toDataURL('image/png');
    
    // Download the result
    downloadDataUrl(croppedDataUrl, `ScreenHelper_Snip_${Date.now()}.png`);
  };
  img.src = dataUrl;
}

async function startScreenRecording(options) {
  try {
    // 1. Get Stream using the streamId from tabCapture
    // If audio format is selected, disable video track
    const videoConstraints = options.format === 'audio' ? false : {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: options.streamId
      }
    };
    
    // For audio format, ensure tab audio is grabbed
    const audioConstraints = (options.systemAudio || options.format === 'audio') ? {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: options.streamId
      }
    } : false;

    const screenStream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: audioConstraints
    });

    let combinedStream = screenStream;

    // 2. Get Camera Stream if requested
    if (options.camera) {
      const userMediaConstraints = {
        video: { width: 320, height: 240 },
        audio: false
      };

      try {
        const camStream = await navigator.mediaDevices.getUserMedia(userMediaConstraints);
        if (camStream.getVideoTracks().length > 0) {
          combinedStream.addTrack(camStream.getVideoTracks()[0]);
        }
      } catch (err) {
        console.warn('Could not get user camera', err);
      }
    }
          
    mediaStream = combinedStream;
    recordedChunks = [];
    
    const mimeType = options.format === 'audio' ? 'audio/webm' : 'video/webm';
    mediaRecorder = new MediaRecorder(mediaStream, { mimeType: mimeType });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const ext = options.format === 'audio' ? 'mp3' : 'webm';
      const blob = new Blob(recordedChunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      downloadDataUrl(url, `ScreenHelper_Recording_${Date.now()}.${ext}`);
      
      // Stop all tracks to free resources
      mediaStream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.start();

  } catch (err) {
    console.error('Failed to start recording:', err);
    chrome.storage.local.set({ recordingState: 'inactive' });
  }
}

function stopScreenRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

function downloadDataUrl(url, filename) {
  chrome.runtime.sendMessage({
    action: 'download-file',
    url: url,
    filename: filename
  });
}
