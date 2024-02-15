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
'use strict';

import { EagleProfiler, Eagle, EagleProfile, EagleErrors } from '../src';

import { getSystemLibraryPath } from '../src/platforms';

import { loadPcm, getModelPath } from './test_utils';

const MODEL_PATH = getModelPath();
const libraryPath = getSystemLibraryPath();

const WAV_PATH_SPEAKER_1_TEST_UTT = 'speaker_1_test_utt.wav';
const WAV_PATH_SPEAKER_1_UTT_1 = 'speaker_1_utt_1.wav';
const WAV_PATH_SPEAKER_1_UTT_2 = 'speaker_1_utt_2.wav';
const WAV_PATH_SPEAKER_2_TEST_UTT = 'speaker_2_test_utt.wav';

const ACCESS_KEY = process.argv
  .filter(x => x.startsWith('--access_key='))[0]
  .split('--access_key=')[1];

const getProfile = (
  profiler: EagleProfiler,
  audioChunks: Int16Array[],
  expectedFeedback: string[]
): EagleProfile => {
  let percentage = 0;
  for (let i = 0; i < audioChunks.length; i++) {
    const result = profiler.enroll(audioChunks[i]);
    expect(result.feedback).toEqual(expectedFeedback[i]);
    expect(result.percentage).toBeGreaterThan(0);
    percentage = result.percentage;
  }
  expect(percentage).toEqual(100);
  return profiler.export();
};

const eagleProcessWaveFile = (
  engineInstance: Eagle,
  pcm: Int16Array
): any[] => {
  const scores = [];
  for (
    let i = 0;
    i < pcm.length - engineInstance.frameLength;
    i += engineInstance.frameLength
  ) {
    const score = engineInstance.process(
      pcm.slice(i, i + engineInstance.frameLength)
    );
    scores.push(score[0]);
  }
  return scores;
};

let testProfile: EagleProfile;

beforeAll(() => {
  let profiler = new EagleProfiler(ACCESS_KEY);
  const inputPcm1 = loadPcm(WAV_PATH_SPEAKER_1_UTT_1);
  const inputPcm2 = loadPcm(WAV_PATH_SPEAKER_1_UTT_2);
  testProfile = getProfile(
    profiler,
    [inputPcm1, inputPcm2],
    ["NONE", "NONE"]);
  profiler.release();
});

describe('successful processes', () => {
  it('enroll with reset', () => {
    let profiler = new EagleProfiler(ACCESS_KEY);
    expect(profiler.minEnrollSamples).toBeGreaterThan(0);

    const inputPcm1 = loadPcm(WAV_PATH_SPEAKER_1_UTT_1);
    const inputPcm2 = loadPcm(WAV_PATH_SPEAKER_1_UTT_2);
    const profile = getProfile(
      profiler,
      [inputPcm1, inputPcm2],
      ["NONE", "NONE"]);
    expect(profile.byteLength).toBeGreaterThan(0);
    profiler.reset();

    const profile2 = getProfile(
      profiler,
      [inputPcm1, inputPcm2],
      ["NONE", "NONE"]);
    expect(profile2.byteLength).toEqual(profile.byteLength);
    profiler.release();
  });
});

describe('Eagle', () => {
  test('eagle init', () => {
    const eagle = new Eagle(ACCESS_KEY, testProfile);
    expect(eagle.sampleRate).toBeGreaterThan(0);
    expect(typeof eagle.version).toEqual('string');
    expect(eagle.version.length).toBeGreaterThan(0);
    eagle.release();
  });

  test('eagle process with reset', () => {
    const eagle = new Eagle(ACCESS_KEY, testProfile);
    const testPcm = loadPcm(WAV_PATH_SPEAKER_1_TEST_UTT);

    const scores = eagleProcessWaveFile(eagle, testPcm);
    expect(Math.max(...scores)).toBeGreaterThan(0.5);
    eagle.reset();

    const scores2 = eagleProcessWaveFile(eagle, testPcm);
    expect(scores).toEqual(scores2);
    eagle.release();
  });

  test('eagle process imposter', () => {
    const eagle = new Eagle(ACCESS_KEY, testProfile);
    const imposterPcm = loadPcm(WAV_PATH_SPEAKER_2_TEST_UTT);
    const imposterScores = eagleProcessWaveFile(eagle, imposterPcm);
    expect(Math.max(...imposterScores)).toBeLessThan(0.5);
    eagle.release();
  });
});

describe('Defaults', () => {
  test('Empty AccessKey', () => {
    expect(() => {
      new EagleProfiler('');
    }).toThrow(EagleErrors.EagleInvalidArgumentError);
  });
});

describe('manual paths', () => {
  test('manual library path', () => {
    let profiler = new EagleProfiler(
      ACCESS_KEY,
      {
        modelPath: MODEL_PATH,
        libraryPath: libraryPath,
      }
    );

    const inputPcm1 = loadPcm(WAV_PATH_SPEAKER_1_UTT_1);
    const inputPcm2 = loadPcm(WAV_PATH_SPEAKER_1_UTT_2);
    const profile = getProfile(
      profiler,
      [inputPcm1, inputPcm2],
      ["NONE", "NONE"]
    );

    const eagle = new Eagle(
      ACCESS_KEY,
      profile,
      {
        modelPath: MODEL_PATH,
        libraryPath: libraryPath,
      }
    );

    const testPcm = loadPcm(WAV_PATH_SPEAKER_1_TEST_UTT);
    const scores = eagleProcessWaveFile(eagle, testPcm);
    expect(Math.max(...scores)).toBeGreaterThan(0.5);
    profiler.release();
    eagle.release();
  });
});

describe('error message stack', () => {
  test('message stack cleared after read (profiler)', () => {
    let error: string[] = [];
    try {
      new EagleProfiler('invalid');
    } catch (e: any) {
      error = e.messageStack;
    }

    expect(error.length).toBeGreaterThan(0);
    expect(error.length).toBeLessThanOrEqual(8);

    try {
      new EagleProfiler('invalid');
    } catch (e: any) {
      for (let i = 0; i < error.length; i++) {
        expect(error[i]).toEqual(e.messageStack[i]);
      }
    }
  });

  test('message stack cleared after read', () => {
    let error: string[] = [];
    try {
      new Eagle('invalid', testProfile);
    } catch (e: any) {
      error = e.messageStack;
    }

    expect(error.length).toBeGreaterThan(0);
    expect(error.length).toBeLessThanOrEqual(8);

    try {
      new Eagle('invalid', testProfile);
    } catch (e: any) {
      for (let i = 0; i < error.length; i++) {
        expect(error[i]).toEqual(e.messageStack[i]);
      }
    }
  });

  test('enroll/export error message', () => {
    let error: string[] = [];

    let profiler = new EagleProfiler(ACCESS_KEY);
    const testPcm = new Int16Array(profiler.minEnrollSamples);
    const profilerBytes = profiler;
    // @ts-ignore
    profiler._profiler = 0;

    try {
      profiler!.enroll(testPcm);
    } catch (e: any) {
      error = e.message;
    }

    expect(error).toBeTruthy();

    try {
      profiler!.export();
    } catch (e: any) {
      error = e.message;
    }

    expect(error).toBeTruthy();

    profiler = profilerBytes;
    profiler.release();
  });

  test('process error message', () => {
    let error: string[] = [];

    let eagle = new Eagle(ACCESS_KEY, testProfile);
    const testPcm = new Int16Array(eagle.frameLength);
    const eagleBytes = eagle;
    // @ts-ignore
    eagle._handle = 0;

    try {
      eagle!.process(testPcm);
    } catch (e: any) {
      error = e.message;
    }

    expect(error).toBeTruthy();

    eagle = eagleBytes;
    eagle.release();
  });
});
