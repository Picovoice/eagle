#! /usr/bin/env node
//
// Copyright 2024 Picovoice Inc.
//
// You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
// file accompanying this source.
//
// Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
// an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//
"use strict";

const { program } = require("commander");
const readline = require("readline");
const fs = require("fs");

const { PvRecorder } = require("@picovoice/pvrecorder-node");

const { Eagle, EagleProfiler, EagleProfilerEnrollFeedback, EagleActivationLimitReachedError } = require("../../binding/nodejs");

const PV_RECORDER_FRAME_LENGTH = 512;
const FEEDBACK_TO_DESCRIPTIVE_MSG = {
  [EagleProfilerEnrollFeedback.NONE]: 'Good audio',
  [EagleProfilerEnrollFeedback.AUDIO_TOO_SHORT]: 'Insufficient audio length',
  [EagleProfilerEnrollFeedback.UNKNOWN_SPEAKER]: 'Different speaker in audio',
  [EagleProfilerEnrollFeedback.NO_VOICE_FOUND]: 'No voice found in audio',
  [EagleProfilerEnrollFeedback.QUALITY_ISSUE]: 'Low audio quality due to bad microphone or environment'
};

program
  .requiredOption(
    "--step <string>",
    "The step: enroll or test"
  )
  .option(
    "--output_profile_path <string>",
    "The absolute output profile path"
  )
  .option(
    "--input_profile_paths <strings...>",
    "The speaker profile paths"
  )
  .option(
    "-a, --access_key <string>",
    "AccessKey obtain from the Picovoice Console (https://console.picovoice.ai/)"
  )
  .option(
    "-l, --library_file_path <string>",
    "absolute path to eagle dynamic library"
  )
  .option("-m, --model_file_path <string>", "absolute path to eagle model")
  .option(
    "-i, --audio_device_index <number>",
    "index of audio device to use to record audio",
    Number,
    -1
  )
  .option("-s, --show_audio_devices", "show the list of available devices")

if (process.argv.length < 1) {
  program.help();
}

program.parse(process.argv);

function printResults(scores, labels) {
  let result = '\rscores -> ';

  let formattedResults = [];
  for (let i = 0; i < labels.length; i++) {
    formattedResults.push(`\`${labels[i]}\`: ${scores[i].toFixed(2)}`);
  }
  result += formattedResults.join(', ');

  process.stdout.write(result);
}

let isInterrupted = false;

async function micDemo() {
  const isEnroll = program["step"] === "enroll"
  const isTest = program["step"] === "test"
  const outputProfilePath = program["output_profile_path"];
  const inputProfilePaths = program["input_profile_paths"];

  const accessKey = program["access_key"];
  const libraryFilePath = program["library_file_path"];
  const modelFilePath = program["model_file_path"];
  const audioDeviceIndex = program["audio_device_index"];
  const showAudioDevices = program["show_audio_devices"];

  const showAudioDevicesDefined = showAudioDevices !== undefined;

  if (showAudioDevicesDefined) {
    const devices = PvRecorder.getAvailableDevices();
    for (let i = 0; i < devices.length; i++) {
      console.log(`index: ${i}, device name: ${devices[i]}`);
    }
    process.exit();
  }

  if (accessKey === undefined) {
    console.log("No AccessKey provided");
    process.exit();
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  process.stdin.on("keypress", (key, str) => {
    if (
      str.sequence === "\r" ||
      str.sequence === "\n" ||
      (str.ctrl && str.name === "c")
    ) {
      isInterrupted = true;
    }
  });

  if (isEnroll) {
    try {
      if (!outputProfilePath) {
        console.log("Please prove an output profile path")
        process.exit();
      }

      const eagleProfiler = new EagleProfiler(accessKey);

      console.log(`Eagle version: ${eagleProfiler.version}`);
      const recorder = new PvRecorder(PV_RECORDER_FRAME_LENGTH, audioDeviceIndex);
      console.log(`Recording audio from '${recorder.getSelectedDevice()}'`);
      // const sample_rate = eagleProfiler.sampleRate;
      // const enrollmentAnimationObj = enrollmentAnimation();
      console.log('Please keep speaking until the enrollment percentage reaches 100%');

      try {
        let enrollPercentage = 0;
        let loadingDots = [" .  ", " .. ", " ...", "  ..", "   .", "    "];
        // enrollmentAnimationObj.run();
        recorder.start();
        let audioData = [];
        let numIterations = 0
        while (enrollPercentage < 100 && !isInterrupted) {
          const inputFrame = await recorder.read();
          audioData.push(inputFrame);

          if (audioData.length * PV_RECORDER_FRAME_LENGTH >= eagleProfiler.minEnrollSamples) {
            try {
              const frames = new Int16Array(audioData.length * PV_RECORDER_FRAME_LENGTH);
              for (let i = 0; i < audioData.length; i++) {
                frames.set(audioData[i], i * PV_RECORDER_FRAME_LENGTH);
              }
              audioData = [];
              const { percentage, feedback } = eagleProfiler.enroll(frames);
              enrollPercentage = Math.floor(percentage);
              const dots = loadingDots[numIterations % loadingDots.length]
              const fb = FEEDBACK_TO_DESCRIPTIVE_MSG[feedback];
              const spacer = ` `.repeat(3 - percentage.toFixed(0).length);
              readline.clearLine(process.stdout, 0)
              readline.cursorTo(process.stdout, 0, null)
              process.stdout.write(`\r[${spacer}${enrollPercentage}%] - ${fb}${dots}`);
              numIterations++
            } catch (e) {
              process.exit();
              console.log(`Failed to enroll. Error: ${e}`);
            }
          }
        }
        process.stdout.write(`\n`);
        recorder.stop();

        const speakerProfile = eagleProfiler.export();
        fs.writeFileSync(outputProfilePath, Buffer.from(speakerProfile));
        console.log(`Speaker profile is saved to ${outputProfilePath}`);
      } catch (e) {
        isInterrupted = true;
        console.error('Failed to enroll speaker:', e);
      } finally {
        recorder.stop();
        eagleProfiler.release();
        process.exit();
      }
    } catch (e) {
      isInterrupted = true;
      process.exit();
      console.error('Failed to initialize Eagle:', e);
    }
  } else if (isTest) {
    if (!inputProfilePaths) {
      console.log("Please provide speaker profile")
      return;
    }
    const profiles = [];
    const speakerLabels = [];
    for (let profilePath of inputProfilePaths) {
      console.log(profilePath)
      speakerLabels.push(profilePath);
      const buffer = fs.readFileSync(profilePath);
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );
      profiles.push(arrayBuffer);
    }

    let eagle;
    let recorder;
    try {
      eagle = new Eagle(accessKey, profiles);

      recorder = new PvRecorder(PV_RECORDER_FRAME_LENGTH, audioDeviceIndex);
      recorder.start();

      console.log('Listening for audio... (press Ctrl+C to stop)');
      while (!isInterrupted) {
        const pcm = await recorder.read();
        const scores = eagle.process(pcm);
        printResults(scores, speakerLabels);
      }
      process.stdout.write("\nStopping...");
    } catch (e) {
      isInterrupted = true;
      console.error('Error during testing:', e);
    } finally {
      if (eagle) {
        eagle.release();
      }
      if (recorder) {
        recorder.stop();
        recorder.release();
      }
    }
  } else {
    console.error('Please specify a mode: enroll or test');
  }
  process.exit();
}

void micDemo();
