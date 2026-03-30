//
// Copyright 2024-2025 Picovoice Inc.
//
// You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
// file accompanying this source.
//
// Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
// an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//
'use strict';

import { EagleProfiler, Eagle, EagleErrors } from '../src';

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

const DEVICE = process.argv
  .filter(x => x.startsWith('--device='))[0]
  .split('--device=')[1] ?? 'best';

const getProfile = (
  profiler: EagleProfiler,
  audioChunks: Int16Array[]
): Uint8Array => {
  let percentage = 0;
  for (let i = 0; i < audioChunks.length; i++) {
    for (
      let j = 0;
      j < audioChunks[i].length - profiler.frameLength;
      j += profiler.frameLength
    ) {
      percentage = profiler.enroll(audioChunks[i].slice(j, j + profiler.frameLength));
      expect(percentage).toBeGreaterThanOrEqual(0);
    }

    percentage = profiler.flush();
    expect(percentage).toBeGreaterThan(0);
  }
  expect(percentage).toEqual(100);
  return profiler.export();
};

let testProfile: Uint8Array;

beforeAll(() => {
  let profiler = new EagleProfiler(ACCESS_KEY, {
    device: DEVICE
  });
  const inputPcm1 = loadPcm(WAV_PATH_SPEAKER_1_UTT_1);
  const inputPcm2 = loadPcm(WAV_PATH_SPEAKER_1_UTT_2);
  testProfile = getProfile(
    profiler,
    [inputPcm1, inputPcm2]);
  profiler.release();
});

describe('successful processes', () => {
  it('enroll with reset', () => {
    let profiler = new EagleProfiler(ACCESS_KEY, {
      device: DEVICE
    });
    expect(profiler.sampleRate).toBeGreaterThan(0);
    expect(profiler.frameLength).toBeGreaterThan(0);
    expect(typeof profiler.version).toEqual('string');
    expect(profiler.version.length).toBeGreaterThan(0);

    const inputPcm1 = loadPcm(WAV_PATH_SPEAKER_1_UTT_1);
    const inputPcm2 = loadPcm(WAV_PATH_SPEAKER_1_UTT_2);
    const profile = getProfile(
      profiler,
      [inputPcm1, inputPcm2]);
    expect(profile.byteLength).toBeGreaterThan(0);
    profiler.reset();

    const profile2 = getProfile(
      profiler,
      [inputPcm1, inputPcm2]);
    expect(profile2.byteLength).toEqual(profile.byteLength);
    profiler.release();
  });
});

describe('Eagle', () => {
  test('eagle process', () => {
    const eagle = new Eagle(ACCESS_KEY, {
      device: DEVICE
    });
    expect(eagle.sampleRate).toBeGreaterThan(0);
    expect(eagle.minProcessSamples).toBeGreaterThan(0);
    expect(typeof eagle.version).toEqual('string');
    expect(eagle.version.length).toBeGreaterThan(0);

    const testPcm = loadPcm(WAV_PATH_SPEAKER_1_TEST_UTT);

    const scores = eagle.process(testPcm, testProfile);
    expect(scores[0]).toBeGreaterThan(0.5);

    const scores2 = eagle.process(testPcm, [testProfile]);
    expect(scores).toEqual(scores2);
    eagle.release();
  });

  test('eagle process imposter', () => {
    const eagle = new Eagle(ACCESS_KEY, {
      device: DEVICE
    });
    const imposterPcm = loadPcm(WAV_PATH_SPEAKER_2_TEST_UTT);
    const imposterScores = eagle.process(imposterPcm, testProfile);
    expect(Math.max(...imposterScores)).toBeLessThan(0.5);
    eagle.release();
  });
  test('list hardware devices', () => {
    const hardwareDevices: string[] = Eagle.listAvailableDevices();
    expect(Array.isArray(hardwareDevices)).toBeTruthy();
    expect(hardwareDevices.length).toBeGreaterThan(0);
  });
});

describe('Defaults', () => {
  test('Empty AccessKey', () => {
    expect(() => {
      new EagleProfiler('');
    }).toThrow(EagleErrors.EagleInvalidArgumentError);
    expect(() => {
      new Eagle('');
    }).toThrow(EagleErrors.EagleInvalidArgumentError);
  });
  test('Invalid device', () => {
    expect(() => {
      new EagleProfiler(ACCESS_KEY, { device: "cloud:9" });
    }).toThrow(EagleErrors.EagleInvalidArgumentError);
    expect(() => {
      new Eagle(ACCESS_KEY, { device: "cloud:9" });
    }).toThrow(EagleErrors.EagleInvalidArgumentError);
  });
});

describe('manual paths', () => {
  test('manual library path', () => {
    let profiler = new EagleProfiler(
      ACCESS_KEY,
      {
        modelPath: MODEL_PATH,
        device: DEVICE,
        libraryPath: libraryPath,
      }
    );

    const inputPcm1 = loadPcm(WAV_PATH_SPEAKER_1_UTT_1);
    const inputPcm2 = loadPcm(WAV_PATH_SPEAKER_1_UTT_2);
    const profile = getProfile(
      profiler,
      [inputPcm1, inputPcm2]
    );

    const eagle = new Eagle(
      ACCESS_KEY,
      {
        modelPath: MODEL_PATH,
        device: DEVICE,
        libraryPath: libraryPath,
      }
    );

    const testPcm = loadPcm(WAV_PATH_SPEAKER_1_TEST_UTT);
    const scores = eagle.process(testPcm, testProfile);
    expect(scores[0]).toBeGreaterThan(0.5);
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
      new Eagle('invalid');
    } catch (e: any) {
      error = e.messageStack;
    }

    expect(error.length).toBeGreaterThan(0);
    expect(error.length).toBeLessThanOrEqual(8);

    try {
      new Eagle('invalid');
    } catch (e: any) {
      for (let i = 0; i < error.length; i++) {
        expect(error[i]).toEqual(e.messageStack[i]);
      }
    }
  });

  test('enroll/export error message', () => {
    let error: string[] = [];

    let profiler = new EagleProfiler(ACCESS_KEY, {
      device: DEVICE
    });
    const testPcm = new Int16Array(profiler.frameLength);
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

    let eagle = new Eagle(ACCESS_KEY, {
      device: DEVICE
    });
    const testPcm = new Int16Array(eagle.minProcessSamples);
    const eagleBytes = eagle;
    // @ts-ignore
    eagle._handle = 0;

    try {
      eagle!.process(testPcm, testProfile);
    } catch (e: any) {
      error = e.message;
    }

    expect(error).toBeTruthy();

    eagle = eagleBytes;
    eagle.release();
  });
});
