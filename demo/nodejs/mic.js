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

const {
  Eagle,
  EagleProfiler,
  EagleProfilerEnrollFeedback,
  EagleErrors
} = require("@picovoice/eagle-node");

const FEEDBACK_TO_DESCRIPTIVE_MSG = {
  [EagleProfilerEnrollFeedback.NONE]: 'Good audio',
  [EagleProfilerEnrollFeedback.AUDIO_TOO_SHORT]: 'Insufficient audio length',
  [EagleProfilerEnrollFeedback.UNKNOWN_SPEAKER]: 'Different speaker in audio',
  [EagleProfilerEnrollFeedback.NO_VOICE_FOUND]: 'No voice found in audio',
  [EagleProfilerEnrollFeedback.QUALITY_ISSUE]: 'Low audio quality due to bad microphone or environment'
};

program
  .option('-s, --show_audio_devices', 'List available audio input devices and exit')
  .option('-i, --audio_device_index <number>', 'index of audio device to use to record audio', Number, -1)
  .option('-a, --access_key <string>', 'AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)')
  .option('-l, --library_path [value]', 'Absolute path to dynamic library. Default: using the library provided by `pveagle`')
  .option('-m, --model_path [value]', 'Absolute path to Eagle model. Default: using the model provided by `pveagle`')
  .option('--enroll', 'Enroll a new speaker profile')
  .option('--test', "Evaluate Eagle's performance using the provided speaker profiles.")
  .option('--output_profile_path <string>', 'Absolute path to output file for the created profile')
  .option('--input_profile_paths <strings...>', 'Absolute path(s) to speaker profile(s)')

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
  const accessKey = program["access_key"];
  const libraryFilePath = program["library_file_path"];
  const modelFilePath = program["model_file_path"];
  const audioDeviceIndex = program["audio_device_index"];
  const showAudioDevices = program["show_audio_devices"];
  const enroll = program["enroll"];
  const test = program["test"];
  const outputProfilePath = program["output_profile_path"];
  const inputProfilePaths = program["input_profile_paths"];

  let showAudioDevicesDefined = showAudioDevices !== undefined;

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
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  process.stdin.on("keypress", (key, str) => {
    if (
      str.sequence === "\r" ||
      str.sequence === "\n" ||
      (str.ctrl && str.name === "c")
    ) {
      isInterrupted = true;
    }
  });

  if (enroll) {
    if (!outputProfilePath) {
      console.log("Please provide a speaker output profile path --output_profile_path")
      process.exit();
    }

    let eagleProfiler;
    let recorder;
    try {
      eagleProfiler = new EagleProfiler(accessKey, {
        modelPath: modelFilePath,
        libraryPath: libraryFilePath
      });
      console.log(`Eagle version: ${eagleProfiler.version}`);

      recorder = new PvRecorder(eagleProfiler.frameLength, audioDeviceIndex);
      console.log(`Using device: ${recorder.getSelectedDevice()}`);
    } catch (e) {
      console.error('Failed to initialize Eagle:', e);
      process.exit();
    }

    try {
      let enrollPercentage = 0;
      let audioData = [];
      let numIterations = 0
      const loadingDotsArr = [" .  ", " .. ", " ...", "  ..", "   .", "    "];
      console.log('Please keep speaking until the enrollment percentage reaches 100%... Press `CTRL C` to stop');
      recorder.start();
      while (enrollPercentage < 100 && !isInterrupted) {
        const inputFrame = await recorder.read();
        audioData.push(inputFrame);

        if (audioData.length * eagleProfiler.frameLength >= eagleProfiler.minEnrollSamples) {
          const frames = new Int16Array(audioData.length * eagleProfiler.frameLength);
          for (let i = 0; i < audioData.length; i++) {
            frames.set(audioData[i], i * eagleProfiler.frameLength);
          }
          audioData = [];
          const { percentage, feedback } = eagleProfiler.enroll(frames);
          const displayPercentage = percentage.toFixed(0);
          const spacer = ` `.repeat(3 - displayPercentage.length);
          const feedbackMessage = FEEDBACK_TO_DESCRIPTIVE_MSG[feedback];
          const loadingDots = loadingDotsArr[numIterations % loadingDotsArr.length];

          readline.clearLine(process.stdout, 0)
          readline.cursorTo(process.stdout, 0, null)
          process.stdout.write(`\r[${spacer}${displayPercentage}%] - ${feedbackMessage}${loadingDots}`);
          enrollPercentage = percentage;
          numIterations++
        }
      }
      recorder.stop();
      process.stdout.write(`\n`);

      if (isInterrupted) {
        recorder.stop();
        console.log("Stopping enrollment. No speaker profile is saved.")
        process.exit();
      } else {
        const speakerProfile = eagleProfiler.export();
        fs.writeFileSync(outputProfilePath, Buffer.from(speakerProfile));
        console.log(`Speaker profile is saved to ${outputProfilePath}`);
      }
    } catch (e) {
      if (e instanceof EagleErrors.EagleActivationLimitReachedError) {
        console.error(`AccessKey '${accessKey}' has reached it's processing limit.`);
      } else {
        console.error('Failed to enroll speaker:', e);
      }
    }

    recorder?.stop();
    recorder?.release();
    eagleProfiler?.release();
    process.exit();
  }

  if (test) {
    if (!inputProfilePaths) {
      console.log("Please provide at least one speaker input profile path --input_profile_paths")
      process.exit();
    }

    const profiles = [];
    const speakerLabels = [];
    for (let profilePath of inputProfilePaths) {
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
      eagle = new Eagle(accessKey, profiles, {
        modelPath: modelFilePath,
        libraryPath: libraryFilePath
      });

      recorder = new PvRecorder(eagle.frameLength, audioDeviceIndex);
      recorder.start();

      console.log('Listening for audio... (press Ctrl+C to stop)');
      while (!isInterrupted) {
        const pcm = await recorder.read();
        const scores = eagle.process(pcm);
        printResults(scores, speakerLabels);
      }

      process.stdout.write("\nStopping...\n");
    } catch (e) {
      if (e instanceof EagleErrors.EagleActivationLimitReachedError) {
        console.error(`AccessKey '${accessKey}' has reached it's processing limit.`);
      } else {
        console.error('Error during testing:', e);
      }
    }

    recorder?.stop();
    recorder?.release();
    eagle?.release();
    process.exit();
  }

  console.error('Please specify a mode: --enroll or --test');
  process.exit();
}

micDemo();
