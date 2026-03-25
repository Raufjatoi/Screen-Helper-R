# Implementation Steps

## 1. manifest.json
- Manifest V3 with permissions: activeTab, scripting, tabCapture, offscreen, storage, downloads.
- Service worker: background/service-worker.js.
- Default popup: popup/popup.html.
- Web Accessible Resources: Include any overlay CSS/JS to be injected.

## 2. Placeholder icons
- Create minimal, high-contrast icons (16px, 48px, 128px).
- Use a modern "R" logo or a camera/box frame icon to represent the "Screen Helper" brand.

## 3. background/service-worker.js – The Controller
- Message Listener: Listens for "start-snip", "start-blur", or "start-record".
- Script Injector: Uses chrome.scripting.executeScript to push the selection logic into the active tab.
- Screenshot Handler: Uses chrome.tabs.captureVisibleTab to grab the viewport after the user selects a container.
- Recorder Manager: Opens an Offscreen Document to handle the MediaRecorder API (since service workers can't access cameras/mics directly).

## 4. content/selector.css – The Interaction UI
- Highlighter: A fixed div with a dashed border and semi-transparent blue background to show which element (container/div) is currently hovered.
- Overlay: A full-screen backdrop to dim the page while selecting.
- Blur Class: A specific CSS class `.shr-blurred { filter: blur(10px) !important; pointer-events: none; }`.

## 5. content/selector.js – The "Antigravity" Engine
- Hover Logic: Uses document.elementFromPoint or mouseover listeners to identify the hovered div. It gets the element's getBoundingClientRect().
- Selection Box: Moves the highlighter div to match the hovered element's coordinates exactly.

### Mode "Snip":
- On click, sends the coordinates $(x, y, width, height)$ back to the Service Worker.
- The SW crops the full screenshot to these dimensions.

### Mode "Blur":
- On click, toggles the `.shr-blurred` class on the selected element.
- Saves the element's unique ID to chrome.storage.local to keep it blurred until a refresh.

## 6. lib/recorder.js – Video & Audio (Offscreen)
- Stream Capture: Uses navigator.mediaDevices.getDisplayMedia for the screen and getUserMedia for the camera/mic.
- Picture-in-Picture: Creates a small `<video>` element in the corner for the "Face Camera" feature.
- Encoding: Uses MediaRecorder to combine streams into a `.webm` or `.mp4` file.
- Download: Triggers chrome.downloads once the user clicks "Stop".

## 7. popup/popup.html + popup/popup.css – Clean UI
- Three Main Buttons: "Snip Element", "Blur Element", and "Record Screen".
- Toggle Switches: Simple toggles for "Include Camera" and "Include Audio".
- Style: Dark theme, 300px width, using the "R" branding colors.

## 8. popup/popup.js – User Interface Logic
- Button Listeners: Sends the specific command ("snip", "blur", or "record") to the Service Worker.
- State Management: Checks if recording is currently active to change the "Record" button to a "Stop" button.

---

## Communication Flow

### Snip/Blur:
Popup → SW → Inject Selector Script → User clicks element → Script sends element bounds → SW captures/processes → Cleanup.

### Recording:
Popup → SW → Open Offscreen Doc → Offscreen Doc requests Screen/Cam access → User records → Save file.

---

## Verification
- Element Snip: Hover over a container; ensure the highlight box snaps to its edges perfectly before clicking.
- Blur Tool: Verify the selected div stays blurred even if you scroll, until the page is refreshed.
- Recording: Check that the video file includes both your screen and the camera overlay with clear audio.