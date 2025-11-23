// Copyright (c) 2025.
// FINAL CLEAN VERSION (Pure Preview + Enhanced OCR Only)

let recognition;
let stage = "idle";
let isBusy = false;
let stopReading = false;

function log(m) {
  const logDiv = document.getElementById('log');
  logDiv.innerHTML += m + "<br>";
  logDiv.scrollTop = logDiv.scrollHeight;
}

// Start Microphone
function startMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { log("NO RECOGNITION SUPPORT."); return; }

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

  recognition.onerror = (e) => log("Mic Error: " + e.error);
  recognition.onend = () => setTimeout(() => recognition.start(), 500);
  recognition.start();
  log("Mic started");
}

// Text-to-speech
function speak(msg) {
  const u = new SpeechSynthesisUtterance(msg);
  speechSynthesis.speak(u);
  return new Promise(r => u.onend = r);
}

// Handle voice commands
async function handleVoice(t) {
  if (t.includes("stop") && !stopReading) {
    stopReading = true;
    await speak("Stopping.");
    speechSynthesis.cancel();
    stage = "idle";
    return;
  }

  if (stage === "idle" && t.includes("hello i")) {
    stage = "wait_open";
    await speak("Say open camera.");
    return;
  }

  if (stage === "wait_open" && (t.includes("open camera") || t.includes("open the camera"))) {
    await openCam();
    stage = "wait_read";
    await speak("Camera is ready. Say read it when you're ready.");
    return;
  }

  if (stage === "wait_read" && (t.includes("read it") || t.includes("read"))) {
    await readNow();
    return;
  }
}

// Open back camera in HD
async function openCam() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    let backCam = devices.find(d =>
      d.kind === "videoinput" &&
      (d.label.toLowerCase().includes("back") ||
       d.label.toLowerCase().includes("environment"))
    );

    const constraints = backCam
      ? { video: { deviceId: backCam.deviceId, width: { ideal: 1920 }, height: { ideal: 1080 } } }
      : { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    const video = document.getElementById('video');
    video.srcObject = stream;
    await video.play();

    await speak("Camera is perfectly ready.");
  } catch (err) {
    log("CAM ERROR: " + err);
    await speak("Camera failed to start.");
  }
}

// ⭐ Mild OCR enhancement (REALISTIC, NOT destructive)
function enhanceForOCR(ctx, w, h) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  for (let i = 0; i < d.length; i += 4) {
    // LIGHT sharpening
    d[i] = Math.min(255, d[i] * 1.1);
    d[i+1] = Math.min(255, d[i+1] * 1.1);
    d[i+2] = Math.min(255, d[i+2] * 1.1);
  }

  ctx.putImageData(imageData, 0, 0);
}

// Read text using OCR
async function readNow() {
  isBusy = true;
  stopReading = false;

  await speak("Hold still. Reading now.");

  const v = document.getElementById('video');

  if (v.videoWidth === 0) {
    await speak("Camera not ready yet.");
    isBusy = false;
    return;
  }

  // Let autofocus settle
  await new Promise(r => setTimeout(r, 1200));

  v.pause();  // freeze frame

  const c = document.getElementById('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;

  const ctx = c.getContext('2d');
  ctx.drawImage(v, 0, 0, c.width, c.height);

  // ⭐ Apply SAFE enhancement ONLY on the capture (not the preview)
  enhanceForOCR(ctx, c.width, c.height);

  const img = c.toDataURL("image/png");

  try {
    const result = await Tesseract.recognize(img, 'eng', {
      logger: m => m.status && log("[OCR] " + m.status)
    });

    const txt = result.data.text.trim();
    log("OCR: " + txt);

    if (txt.length > 2) {
      await speak(txt);
    } else {
      await speak("No readable text found.");
    }
  } catch (err) {
    log("OCR Error: " + err);
    await speak("Reading failed.");
  }

  v.play(); // resume live preview
  isBusy = false;
}

startMic();
