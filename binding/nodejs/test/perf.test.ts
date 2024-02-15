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

import { Eagle, EagleProfiler } from '../src';

import { loadPcm } from './test_utils';

const WAV_PATH_SPEAKER_1_TEST_UTT = 'speaker_1_test_utt.wav';
const WAV_PATH_SPEAKER_1_UTT_1 = 'speaker_1_utt_1.wav';
const WAV_PATH_SPEAKER_1_UTT_2 = 'speaker_1_utt_2.wav';

const ACCESS_KEY =
  process.argv
    .filter(x => x.startsWith('--access_key='))[0]
    ?.split('--access_key=')[1] ?? '';
const NUM_TEST_ITERATIONS = Number(
  process.argv
    .filter(x => x.startsWith('--num_test_iterations='))[0]
    ?.split('--num_test_iterations=')[1] ?? 0
);
const ENROLL_PERFORMANCE_THRESHOLD_SEC = Number(
  process.argv
    .filter(x => x.startsWith('--enroll_performance_threshold_sec='))[0]
    ?.split('--enroll_performance_threshold_sec=')[1] ?? 0
);
const PROC_PERFORMANCE_THRESHOLD_SEC = Number(
  process.argv
    .filter(x => x.startsWith('--proc_performance_threshold_sec='))[0]
    ?.split('--proc_performance_threshold_sec=')[1] ?? 0
);

describe('Performance', () => {
  test('enroll performance', () => {
    const enrollPerfResults: number[] = [];
    const profiler = new EagleProfiler(ACCESS_KEY);
    const enrollPcm = loadPcm(WAV_PATH_SPEAKER_1_TEST_UTT);

    for (let i = 0; i < NUM_TEST_ITERATIONS + 1; i++) {
      let start = Date.now();
      profiler.enroll(enrollPcm);
      if (i > 0) {
        enrollPerfResults.push((Date.now() - start) / 1000);
      }
    }

    profiler.release();

    const enrollAvgPerf =
      enrollPerfResults.reduce((a, b) => a + b) / NUM_TEST_ITERATIONS;

    // eslint-disable-next-line no-console
    console.log(`Average enroll performance: ${enrollAvgPerf} seconds`);

    expect(enrollAvgPerf).toBeLessThan(ENROLL_PERFORMANCE_THRESHOLD_SEC);
  });

  test('proc performance', () => {
    const profiler = new EagleProfiler(ACCESS_KEY);
    const enrollPcm1 = loadPcm(WAV_PATH_SPEAKER_1_UTT_1);
    const enrollPcm2 = loadPcm(WAV_PATH_SPEAKER_1_UTT_2);
    for (const pcm of [enrollPcm1, enrollPcm2]) {
      profiler.enroll(pcm);
    }

    const profile = profiler.export();
    profiler.release();

    const eagle = new Eagle(ACCESS_KEY, profile);

    const testPcm = loadPcm(WAV_PATH_SPEAKER_1_TEST_UTT);
    const processPerfResults: number[] = [];
    for (let i = 0; i < NUM_TEST_ITERATIONS + 1; i++) {
      for (
        let j = 0;
        j < testPcm.length - eagle.frameLength + 1;
        j += eagle.frameLength
      ) {
        let start = Date.now();
        eagle.process(testPcm.slice(j, j + eagle.frameLength));
        if (i > 0) {
          processPerfResults.push((Date.now() - start) / 1000);
        }
      }
    }

    eagle.release();

    const procAvgPerf =
      processPerfResults.reduce((a, b) => a + b) / NUM_TEST_ITERATIONS;

    // eslint-disable-next-line no-console
    console.log(`Average process performance: ${procAvgPerf} seconds`);

    expect(procAvgPerf).toBeLessThan(PROC_PERFORMANCE_THRESHOLD_SEC);
  });
});
