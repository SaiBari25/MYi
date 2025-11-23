// Copyright (c) 2025 SaiBari25. All rights reserved.

// GLOBALS
let recognition;
let stage = "idle";
let isBusy = false;
let stopReading = false;

function log(m) {
  const logDiv = document.getElementById('log');
  logDiv.innerHTML += m + "<br>";
  logDiv.scrollTop = logDiv.scrollHeight;
}

// Start Microphone for Voice Commands
function startMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { log("NO RECOGNITION SUPPORT IN BROWSER."); return; }

  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = (e) => {
    if (isBusy) return;
    const t = e.results[e.resultIndex][0].transcript.toLowerCase().trim();
    log("User: " + t);
    handleVoice(t);
  };

  recognition.onerror = (e) => {
    log("Mic Error: " + e.error);
    recognition.stop();
    setTimeout(() => recognition.start(), 800); // restart after error
  };

  recognition.onend = () => setTimeout(() => recognition.start(), 500);
  recognition.start();
  log("Mic started");
}

// Text to Speech
function speak(msg) {
  const u = new SpeechSynthesisUtterance(msg);
  // accessibility: visual feedback in log
  log("Speak: " + msg);
  speechSynthesis.speak(u);
  return new Promise(r => { u.onend = r; });
}

// Handle voice commands
async function handleVoice(t) {
  if (t.includes("stop") && !stopReading) {
    stopReading = true;
    await speak("Stopping reading.");
    speechSynthesis.cancel();
    stage = "idle";
    return;
  }
  if (stage === "idle" && t.includes("hello i")) {
    stage = "wait_open";
    await speak("Say open camera");
    return;
  }
  if (stage === "wait_open" && (t.includes("open camera") || t.includes("open the camera"))) {
    await openCam();
    stage = "wait_read";
    await speak("Camera is ready. Say read it when you want me to read.");
    return;
  }
  if (stage === "wait_read" && (t.includes("read it") || t.includes("read"))) {
    await readNow();
    return;
  }
}

// Open the back camera in HD
async function openCam() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    let backCam = null;
    // Prefer "back" camera or "environment"
    for (const d of devices) {
      if (d.kind === "videoinput" &&
         (d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("environment"))) {
        backCam = d;
        break;
      }
    }
    const constraints = backCam
      ? { video: { deviceId: { exact: backCam.deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } }
      : { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const video = document.getElementById('video');
    video.srcObject = stream;

    await video.play();
    await speak("Camera is perfectly ready");
  } catch (e) {
    log("Camera error: " + e.message);
    await speak("Sorry, cannot open the camera. Please check permissions and device.");
  }
}

// Improve image contrast for OCR
function enhanceContrast(ctx, width, height) {
  // Simple grayscale and contrast: improves OCR
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    let d = imageData.data;
    for(let i=0;i<d.length;i+=4) {
      let avg = (d[i]+d[i+1]+d[i+2])/3;
      // Increase contrast: basic version
      avg = avg > 128 ? 255 : 0;
      d[i] = d[i+1] = d[i+2] = avg;
    }
    ctx.putImageData(imageData,0,0);
  } catch(e){
    // Fail silently if image data cannot be processed
    log("Image enhancement error: " + e.message);
  }
}

// Read (OCR) sequence
async function readNow() {
  isBusy = true;
  stopReading = false;

  await speak("Hold still. Reading now.");

  const v = document.getElementById('video');
  // Wait until video is ready
  if (v.videoWidth === 0 || v.videoHeight === 0) {
    await speak("Camera not ready yet. Please try again.");
    isBusy = false;
    return;
  }

  // Wait longer for autofocus and stable image
  await new Promise(r => setTimeout(r, 1500));

  // Freeze frame for clarity
  v.pause();

  const c = document.getElementById('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;

  const ctx = c.getContext('2d');
  ctx.drawImage(v, 0, 0, c.width, c.height);

  // Optional: Contrast enhancement for better text recognition
  enhanceContrast(ctx, c.width, c.height);

  // Preview for debugging
  const img = c.toDataURL("image/png");
  const debugImg = document.getElementById('debug_img');
  debugImg.src = img;
  debugImg.style.display = "block";

  try {
    const result = await Tesseract.recognize(img, 'eng', {
      logger: (m) => m.status && log("[OCR] " + m.status)
    });

    const txt = result.data.text.trim();
    log("OCR: " + txt);

    if (txt.length > 2) {
      await speak(txt);
    } else {
      await speak("No readable text found. Please try again in better light.");
    }

  } catch (e) {
    log("OCR error: " + e.message);
    await speak("An error occurred during text reading. Please retry.");
  }

  // Resume camera for next read
  v.play();

  isBusy = false;
}

startMic();
