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

const WaveFile = require("wavefile").WaveFile;
const {
  Eagle,
  EagleProfiler,
  EagleProfilerEnrollFeedback,
  EagleErrors,
  getInt16Frames,
  checkWaveFile
} = require("@picovoice/eagle-node");

const FEEDBACK_TO_DESCRIPTIVE_MSG = {
  [EagleProfilerEnrollFeedback.NONE]: 'Good audio',
  [EagleProfilerEnrollFeedback.AUDIO_TOO_SHORT]: 'Insufficient audio length',
  [EagleProfilerEnrollFeedback.UNKNOWN_SPEAKER]: 'Different speaker in audio',
  [EagleProfilerEnrollFeedback.NO_VOICE_FOUND]: 'No voice found in audio',
  [EagleProfilerEnrollFeedback.QUALITY_ISSUE]: 'Low audio quality due to bad microphone or environment'
};

program
  .option('-a, --access_key <string>', 'AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)')
  .option('-l, --library_path [value]', 'Absolute path to dynamic library. Default: using the library provided by `pveagle`')
  .option('-m, --model_path [value]', 'Absolute path to Eagle model. Default: using the model provided by `pveagle`')
  .option('--enroll', 'Enroll a new speaker profile')
  .option('--test', "Evaluate Eagle's performance using the provided speaker profiles.")
  .option('--enroll_audio_paths <strings...>', 'Absolute path(s) to enrollment audio files')
  .option('--test_audio_path <string>', 'Absolute path to test audio file')
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

  process.stdout.write(`${result}\n`);
}

let isInterrupted = false;

async function fileDemo() {
  const accessKey = program["access_key"];
  const libraryFilePath = program["library_file_path"];
  const modelFilePath = program["model_file_path"];
  const enroll = program["enroll"];
  const test = program["test"];
  const enrollAudioPaths = program["enroll_audio_paths"];
  const testAudioPath = program["test_audio_path"];
  const outputProfilePath = program["output_profile_path"];
  const inputProfilePaths = program["input_profile_paths"];

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

    if (!enrollAudioPaths) {
      console.log("Please provide speaker enrollment audio path(s) --enroll_audio_paths")
      process.exit();
    }

    let eagleProfiler;
    try {
      eagleProfiler = new EagleProfiler(accessKey, {
        modelPath: modelFilePath,
        libraryPath: libraryFilePath
      });
      console.log(`Eagle version: ${eagleProfiler.version}`);
    } catch (e) {
      console.error('Failed to initialize Eagle:', e);
      process.exit();
    }

    try {
      let enrollPercentage = 0;
      let feedbackMessage = "";

      for (let audioPath of enrollAudioPaths) {
        let waveBuffer = fs.readFileSync(audioPath);
        let inputWaveFile = new WaveFile(waveBuffer);

        if (!checkWaveFile(inputWaveFile, eagleProfiler.sampleRate)) {
          console.error(
            "Audio file did not meet requirements. Wave file must be 16KHz, 16-bit, linear PCM (mono)."
          );
          eagleProfiler?.release();
          process.exit();
        }

        let audioData = [];
        let frames = getInt16Frames(inputWaveFile, eagleProfiler.frameLength);
        for (let frame of frames) {
          audioData.push(frame);
          if (audioData.length * eagleProfiler.frameLength >= eagleProfiler.minEnrollSamples) {
            const enrollFrames = new Int16Array(audioData.length * eagleProfiler.frameLength);
            for (let i = 0; i < audioData.length; i++) {
              enrollFrames.set(audioData[i], i * eagleProfiler.frameLength);
            }
            audioData = [];
            const { percentage, feedback } = eagleProfiler.enroll(enrollFrames);
            feedbackMessage = FEEDBACK_TO_DESCRIPTIVE_MSG[feedback];
            enrollPercentage = percentage;
          }
        }

        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0, null)
        console.log(`Enrolled audio file ${audioPath} [Enrollment percentage: ${enrollPercentage}% - Enrollment feedback: ${feedbackMessage}]`);
      }

      process.stdout.write(`\n`);

      if (enrollPercentage < 100) {
        console.error(`Failed to create speaker profile. Insufficient enrollment percentage: ${enrollPercentage.toFixed(2)}%. Please add more audio files for enrollment.`);
        eagleProfiler?.release();
        process.exit();
      } else if (enrollPercentage === 100) {
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

    eagleProfiler?.release();
    process.exit();
  }

  if (test) {
    if (!inputProfilePaths) {
      console.log("Please provide speaker input profile path(s) --input_profile_paths")
      process.exit();
    }

    if (!testAudioPath) {
      console.log("Please provide test audio path --test_audio_path")
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
    try {
      eagle = new Eagle(accessKey, profiles, {
        modelPath: modelFilePath,
        libraryPath: libraryFilePath
      });

      let waveBuffer = fs.readFileSync(testAudioPath);
      let inputWaveFile;
      try {
        inputWaveFile = new WaveFile(waveBuffer);
      } catch (error) {
        console.error(`Exception trying to read file as wave format: ${testAudioPath}`);
        console.error(error);
        eagle?.release();
        process.exit();
      }

      if (!checkWaveFile(inputWaveFile, eagle.sampleRate)) {
        console.error(
          "Audio file did not meet requirements. Wave file must be 16KHz, 16-bit, linear PCM (mono)."
        );
        eagle?.release();
        process.exit();
      }

      let frames = getInt16Frames(inputWaveFile, eagle.frameLength);
      for (let frame of frames) {
        const scores = eagle.process(frame);
        printResults(scores, speakerLabels);
      }

      process.stdout.write("\nStopping...");
    } catch (e) {
      if (e instanceof EagleErrors.EagleActivationLimitReachedError) {
        console.error(`AccessKey '${accessKey}' has reached it's processing limit.`);
      } else {
        console.error('Error during testing:', e);
      }
    }

    eagle?.release();
    process.exit();
  }

  console.error('Please specify a mode: --enroll or --test');
  process.exit();
}

fileDemo();
