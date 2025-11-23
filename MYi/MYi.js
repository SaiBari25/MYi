// Copyright (c) 2025 SaiBari25. All rights reserved.

const log = (m) => { document.getElementById('log').innerHTML += m + "<br>" }

let recognition;
let stage = "idle"; // idle → wait_open → wait_read
let isBusy = false;
let stopReading = false;  // Flag to stop reading when "stop" is said

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

// Handle User Voice Commands
async function handleVoice(t) {
  // If "stop" command is detected, stop the OCR and reading
  if (t.includes("stop") && !stopReading) {
    stopReading = true;
    await speak("Stopping reading.");
    speechSynthesis.cancel();  // Cancel current speech
    return;
  }

  if (stage === "idle" && t.includes("hello i")) {
    stage = "wait_open";
    await speak("Say open camera");
    return;
  }

  if (stage === "wait_open" && t.includes("open camera") || t.includes("open the camera")) {
    await openCam();
    stage = "wait_read";
    await speak("Camera is perfectly ready. Say read it when you want me to read.");
    return;
  }

  if (stage === "wait_read" && (t.includes("read it") || t.includes("read"))) {
    await readNow();
    return;
  }
}

// Open Camera
async function openCam() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const backCam = devices.find(d => 
      d.kind === "videoinput" && d.label.toLowerCase().includes("back")
    );

    const constraints = backCam
      ? { video: { deviceId: backCam.deviceId }, audio: false }
      : { video: { facingMode: { ideal: "environment" } }, audio: false };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    document.getElementById("video").srcObject = stream;

    await speak("Camera is perfectly ready");
  } catch (err) {
    log("CAM ERROR " + err);
  }
}


// OCR Text Recognition
async function readNow() {
  isBusy = true;
  stopReading = false;  // Reset the flag when reading starts
  await speak("Hold still, reading now.");

  const v = document.getElementById('video');
  const c = document.getElementById('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);

  // Convert the image to a data URL for OCR
  const img = c.toDataURL();

  try {
    const result = await Tesseract.recognize(img, 'eng', {
      logger: (m) => { log(m.status); }
    });

    const txt = result.data.text.trim();
    log('OCR: ' + txt);

    if (txt && txt.length > 0) {
      await speak(txt);
    } else {
      await speak('Nothing readable. Try again.');
    }
  } catch (e) {
    log('OCR Error: ' + e.message);
    await speak('An error occurred during OCR.');
  }

  isBusy = false;
}

startMic();


