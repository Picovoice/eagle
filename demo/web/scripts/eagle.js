let profiler = null;
let eagle = null;
let speakerProfiles = []

let timer = null;
let currentTimer = 0.0;
let audioData = [];
let audioContext = null;

const ENABLE_AUDIO_DUMP = false;
let dumpAudio = [];

window.onload = function () {
  audioContext = new (window.AudioContext || window.webKitAudioContext)(
          { sampleRate: 16000 }
  );

  document.getElementById("audioFile").addEventListener("change", async (event) => {
    newEnrollmentUI();
    try {
      await profiler.reset();
    } catch (e) {
      writeMessage(`Failed to reset Eagle Profiler. Error: ${e}`);
      return;
    }

    writeMessage("Processing audio files...");
    const fileList = event.target.files;
    let percentage = 0;
    for (const f of fileList) {
      let audioFrame;
      try {
        audioFrame = await getAudioFileData(f, audioContext);
      } catch (e) {
        writeMessage(`Failed to read audio file '${f.name}'. Error: ${e}`);
        return;
      }

      try {
        const result = await profiler.enroll(audioFrame);
        updateSpeakerProgress(speakerProfiles.length + 1, result.feedback, result.percentage)
        percentage = result.percentage;
      } catch (e) {
        writeMessage(`Failed to enroll using '${f.name}'. Error: ${e}`);
        return;
      }
    }

    if (percentage < 100) {
      writeMessage(`Speaker is only ${percentage}% done enrollment. ` +
              `Please choose a larger data set and try again.`);
      enrollFailUI();
      return;
    }

    try {
      const profile = await profiler.export();
      speakerProfiles.push(profile);
      enrollSuccessUI();
      writeMessage(`Enrollment for Speaker ${speakerProfiles.length} complete! ` +
              `You can begin testing or enroll another speaker.`);
    } catch (e) {
      writeMessage(`Failed to enroll speaker. Error: ${e}`);
    }
  });
}

async function getAudioFileData(audioFile, audioContext) {
  const dataBuffer = await audioFile.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(dataBuffer);

  const f32PCM = audioBuffer.getChannelData(0);
  const i16PCM = new Int16Array(f32PCM.length);

  const INT16_MAX = 32767;
  const INT16_MIN = -32768;
  i16PCM.set(
          f32PCM.map((f) => {
            let i = Math.trunc(f * INT16_MAX);
            if (f > INT16_MAX) i = INT16_MAX;
            if (f < INT16_MIN) i = INT16_MIN;
            return i;
          })
  );
  return i16PCM;
}

const micEnrollEngine = {
  onmessage: async (event) => {
    switch (event.data.command) {
      case "process":
        audioData.push(event.data.inputFrame);

        if (ENABLE_AUDIO_DUMP) {
          dumpAudio = dumpAudio.concat(event.data.inputFrame);
        }

        if (audioData.length * 512 >= profiler.minEnrollSamples) {
          let result;

          try {
            const frames = new Int16Array(audioData.length * 512);
            for (let i = 0; i < audioData.length; i++) {
              frames.set(audioData[i], i * 512);
            }
            audioData = [];
            result = await profiler.enroll(frames);
          } catch (e) {
            writeMessage(`Failed to enroll. Error: ${e}`);
            return;
          }

          updateSpeakerProgress(speakerProfiles.length + 1, result.feedback, result.percentage);
          if (result.percentage === 100) {
            await window.WebVoiceProcessor.WebVoiceProcessor.unsubscribe(micEnrollEngine);
            clearInterval(timer);
            micEnrollStopUI();

            try {
              const profile = await profiler.export();
              speakerProfiles.push(profile);
              enrollSuccessUI();
              writeMessage(`Enrollment for Speaker ${speakerProfiles.length} complete! ` +
                      `You can begin testing or enroll another speaker.`);
            } catch (e) {
              writeMessage(`Failed to enroll speaker. Error: ${e}`);
            }

            if (ENABLE_AUDIO_DUMP) {
              downloadDumpAudio("enroll.pcm");
            }
          }
        }
        break;
    }
  }
}

async function micEnrollStart() {
  currentTimer = 0.0;
  audioData = [];
  micEnrollStartUI();
  newEnrollmentUI();
  try {
    await profiler.reset();
  } catch (e) {
    writeMessage(`Failed to reset Eagle Profiler. Error: ${e}`);
    return;
  }

  writeMessage("Keep speaking continuously until enrollment progress reaches 100%.");
  try {
    await window.WebVoiceProcessor.WebVoiceProcessor.subscribe(micEnrollEngine);
    timer = setInterval(() => {
      currentTimer += 0.1;
      document.getElementById("displayTimer").innerText = `${currentTimer.toFixed(1)}`;
    }, 100);
  } catch (e) {
    writeMessage(e);
  }
}

async function micEnrollStop() {
  await window.WebVoiceProcessor.WebVoiceProcessor.unsubscribe(micEnrollEngine);
  clearInterval(timer);
  writeMessage(`Enrollment stopped`);
  updateSpeakerTable();
  enrollFailUI();
  micEnrollStopUI();
}

function writeMessage(message) {
  console.log(message);
  document.getElementById("status").innerHTML = message;
}

function updateSpeakerProgress(speakerId, feedback, progress) {
  const feedbackMsg = getFeedbackMessage(feedback)
  console.log(progress, feedbackMsg);
  document.getElementById(`speaker${speakerId}Feedback`).innerHTML = ` ${feedbackMsg}`;
  document.getElementById(`speaker${speakerId}Progress`).value = progress;
}

function updateSpeakerScore(speakerId, score) {
  document.getElementById(`speaker${speakerId}Progress`).value = score * 100;
}

function getFeedbackMessage(feedback) {
  switch (feedback) {
    case EagleWeb.EagleProfilerEnrollFeedback.AUDIO_TOO_SHORT:
      return "Insufficient audio length";
    case EagleWeb.EagleProfilerEnrollFeedback.UNKNOWN_SPEAKER:
      return "Different speaker detected in audio";
    case EagleWeb.EagleProfilerEnrollFeedback.NO_VOICE_FOUND:
      return "Unable to detect voice in audio";
    case EagleWeb.EagleProfilerEnrollFeedback.QUALITY_ISSUE:
      return "Audio quality too low to use for enrollment";
    default:
      return "Enrolling speaker...";
  }
}

function updateSpeakerTable() {
  const speakerTable = document.getElementById("speakersTable");
  while (speakerTable.lastElementChild) {
    speakerTable.removeChild(speakerTable.lastElementChild);
  }
  for (let i = 0; i < speakerProfiles.length; i++) {
    speakerTable.append(createSpeakerRow(i + 1, 100));
    speakerTable.append(document.createElement("br"))
  }
}

function createSpeakerRow(i, initialProgress) {
  const div = document.createElement("div");
  div.textContent = `Speaker ${i} `
  const speakerProgress = document.createElement("progress");
  speakerProgress.max = 100;
  speakerProgress.value = initialProgress;
  speakerProgress.id = `speaker${i}Progress`
  const speakerFeedback = document.createElement("span");
  speakerFeedback.id = `speaker${i}Feedback`
  div.appendChild(speakerProgress);
  div.appendChild(speakerFeedback);
  return div;
}

function newEnrollmentUI() {
  updateSpeakerTable();
  document.getElementById("testContainer").style.display = "block";
  document.getElementById("feedbackText").innerHTML = "";
  document.getElementById("speakersTable").append(createSpeakerRow(speakerProfiles.length + 1, 0));
  document.getElementById("speakersTable").append(document.createElement("br"))
  document.getElementById("testStartBtn").disabled = true;
  document.getElementById("resetBtn").disabled = true;
}

function enrollFailUI() {
  document.getElementById("testStartBtn").disabled = speakerProfiles.length === 0;
  document.getElementById("resetBtn").disabled = speakerProfiles.length === 0;
}

function enrollSuccessUI() {
  updateSpeakerTable();
  document.getElementById("testStartBtn").disabled = false;
  document.getElementById("resetBtn").disabled = false;
}

function micEnrollStartUI() {
  document.getElementById("displayTimer").style.display = "inline";
  document.getElementById("micEnrollStartBtn").style.display = "none";
  document.getElementById("audioFile").disabled = true;
  document.getElementById("micEnrollStopBtn").style.display = "inline";
}

function micEnrollStopUI() {
  document.getElementById("displayTimer").style.display = "none";
  document.getElementById("micEnrollStartBtn").style.display = "inline";
  document.getElementById("audioFile").disabled = false;
  document.getElementById("micEnrollStopBtn").style.display = "none";
  document.getElementById("displayTimer").innerText = `0.0`;
}

function micTestStartUI() {
  document.getElementById("micEnrollStartBtn").disabled = true;
  document.getElementById("audioFile").disabled = true;
  document.getElementById("resetBtn").disabled = true;
  document.getElementById("testStartBtn").style.display = "none";
  document.getElementById("testStopBtn").style.display = "inline";
  document.getElementById("testStopBtn").disabled = true;
}

function micTestStopUI() {
  document.getElementById("micEnrollStartBtn").disabled = false;
  document.getElementById("audioFile").disabled = false;
  document.getElementById("resetBtn").disabled = false;
  document.getElementById("testStartBtn").style.display = "inline";
  document.getElementById("testStopBtn").style.display = "none";
}

async function startEagleProfiler(accessKey) {
  writeMessage("Eagle is loading. Please wait...");
  try {
    profiler = await EagleWeb.EagleProfilerWorker.create(
            accessKey,
            {
              base64: modelParams,
              forceWrite: true
            });
    writeMessage("");

    document.getElementById('enrollContainer').style.display = "block";
  } catch (e) {
    writeMessage(`Failed to initialize Eagle. Error: ${e}`);
  }
}

const micTestEngine = {
  onmessage: async (event) => {
    switch (event.data.command) {
      case "process":
        if (ENABLE_AUDIO_DUMP) {
          dumpAudio = dumpAudio.concat(event.data.inputFrame);
        }
        let scores
        try {
          scores = await eagle.process(event.data.inputFrame);
        } catch (e) {
          writeMessage(`Failed to enroll. Error: ${e}`);
          return;
        }

        for (let i = 0; i < scores.length; i++) {
          updateSpeakerScore(i + 1, scores[i]);
        }
        break;
    }
  }
}

async function startEagle(accessKey) {
  writeMessage("Eagle is loading. Please wait...");
  micTestStartUI();
  try {
    eagle = await EagleWeb.EagleWorker.create(
            accessKey,
            {
              base64: modelParams,
              forceWrite: true
            },
            speakerProfiles);

  } catch (e) {
    writeMessage(`Failed to initialize Eagle. Error: ${e}`);
    return;
  }
  try {
    await profiler.reset();
  } catch (e) {
    writeMessage(`Failed to reset Eagle Profiler. Error: ${e}`);
    return;
  }

  document.getElementById("testStopBtn").disabled = false;
  for (let i = 0; i < speakerProfiles.length; i++) {
    updateSpeakerScore(i + 1, 0);
  }
  writeMessage("Take turns speaking sentences and see if Eagle can recognize which speaker is talking");
  try {
    await window.WebVoiceProcessor.WebVoiceProcessor.subscribe(micTestEngine);
  } catch (e) {
    writeMessage(e);
  }
}

async function stopEagle() {
  try {
    await window.WebVoiceProcessor.WebVoiceProcessor.unsubscribe(micTestEngine);
  } catch (e) {
    writeMessage(e);
  }

  if (eagle) {
    await eagle.terminate();
    eagle = null;
  }
  for (let i = 0; i < speakerProfiles.length; i++) {
    updateSpeakerScore(i + 1, 100);
  }
  micTestStopUI();
  writeMessage("");

  if (ENABLE_AUDIO_DUMP) {
    downloadDumpAudio('test.pcm');
  }
}

function resetSpeakers() {
  document.getElementById("testContainer").style.display = "none";
  speakerProfiles = [];
  updateSpeakerTable();
  writeMessage("");
}

function downloadDumpAudio(fileName) {
  let blob = new Blob(dumpAudio);
  dumpAudio = [];
  let a = document.createElement('a');
  a.download = fileName;
  a.href = window.URL.createObjectURL(blob);
  a.click();
  document.removeChild(a);
}