// Copyright (c) 2025 SaiBari25. All rights reserved.

const log = (m) => { 
  document.getElementById('log').innerHTML += m + "<br>"; 
};

let recognition;
let stage = "idle";
let isBusy = false;
let stopReading = false;

// Start Microphone
function startMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { log("NO RECOGNITION"); return; }

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

  recognition.onerror = (e) => log("REC ERROR: " + e.error);
  recognition.onend = () => recognition.start();
  recognition.start();
  log("MIC STARTED");
}

// Text to Speech
function speak(msg) {
  const u = new SpeechSynthesisUtterance(msg);
  speechSynthesis.speak(u);
  return new Promise(r => { u.onend = r });
}

// Handle voice commands
async function handleVoice(t) {
  if (t.includes("stop") && !stopReading) {
    stopReading = true;
    await speak("Stopping reading.");
    speechSynthesis.cancel();
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
    const backCam = devices.find(d =>
      d.kind === "videoinput" && d.label.toLowerCase().includes("back")
    );

    const constraints = backCam
      ? { video: { deviceId: backCam.deviceId, width: { ideal: 1920 }, height: { ideal: 1080 } } }
      : { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    const video = document.getElementById('video');
    video.srcObject = stream;

    await video.play();

    await speak("Camera is perfectly ready");
  } catch (e) {
    log("CAM ERROR " + e);
  }
}

// Read (OCR)
async function readNow() {
  isBusy = true;
  stopReading = false;

  await speak("Hold still. Reading now.");

  const v = document.getElementById('video');

  // Wait for video to have dimensions
  if (v.videoWidth === 0 || v.videoHeight === 0) {
    await speak("Camera not ready yet. Try again.");
    isBusy = false;
    return;
  }

  // Give autofocus time (critical)
  await new Promise(r => setTimeout(r, 800));

  // Freeze frame for clarity
  v.pause();

  const c = document.getElementById('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;

  const ctx = c.getContext('2d');
  ctx.drawImage(v, 0, 0);

  const img = c.toDataURL();

  try {
    const result = await Tesseract.recognize(img, 'eng', {
      logger: (m) => log(m.status)
    });

    const txt = result.data.text.trim();
    log("OCR: " + txt);

    if (txt.length > 2) {
      await speak(txt);
    } else {
      await speak("Nothing readable. Try again.");
    }

  } catch (e) {
    log("OCR Error: " + e.message);
    await speak("An error occurred during OCR.");
  }

  // Resume camera
  v.play();

  isBusy = false;
}

startMic();
