import { Eagle, EagleProfiler, EagleProfilerWorker, EagleWorker } from '../';

const ACCESS_KEY = Cypress.env('ACCESS_KEY');
const NUM_TEST_ITERATIONS = Number(Cypress.env('NUM_TEST_ITERATIONS'));
const ENROLL_PERFORMANCE_THRESHOLD_SEC = Number(
  Cypress.env('ENROLL_PERFORMANCE_THRESHOLD_SEC')
);
const PROCESS_PERFORMANCE_THRESHOLD_SEC = Number(
  Cypress.env('PROCESS_PERFORMANCE_THRESHOLD_SEC')
);

async function testEnrollPerformance(
  instance: typeof EagleProfiler | typeof EagleProfilerWorker,
  inputPcm: Int16Array
) {
  const enrollPerfResults: number[] = [];
  const profiler = await instance.create(ACCESS_KEY, {
    publicPath: '/test/eagle_params.pv',
    forceWrite: true,
  });

  for (let i = 0; i < NUM_TEST_ITERATIONS + 1; i++) {
    let start = Date.now();
    await profiler.enroll(inputPcm);
    if (i > 0) {
      enrollPerfResults.push((Date.now() - start) / 1000);
    }
  }

  if (profiler instanceof EagleProfilerWorker) {
    profiler.terminate();
  } else {
    await profiler.release();
  }

  const enrollAvgPerf =
    enrollPerfResults.reduce((a, b) => a + b) / NUM_TEST_ITERATIONS;

  // eslint-disable-next-line no-console
  console.log(`Average enroll performance: ${enrollAvgPerf} seconds`);

  expect(enrollAvgPerf).to.be.lessThan(ENROLL_PERFORMANCE_THRESHOLD_SEC);
}

async function testProcessPerformance(
  instance: typeof Eagle | typeof EagleWorker,
  enrollPcm: Int16Array[],
  testPcm: Int16Array
) {
  const profiler = await EagleProfiler.create(ACCESS_KEY, {
    publicPath: '/test/eagle_params.pv',
    forceWrite: true,
  });
  for (const pcm of enrollPcm) {
    await profiler.enroll(pcm);
  }
  const profile = await profiler.export();
  profiler.release();

  const eagle = await instance.create(
    ACCESS_KEY,
    {
      publicPath: '/test/eagle_params.pv',
      forceWrite: true,
    },
    profile
  );

  const processPerfResults: number[] = [];
  for (let i = 0; i < NUM_TEST_ITERATIONS + 1; i++) {
    for (
      let j = 0;
      j < testPcm.length - eagle.frameLength + 1;
      j += eagle.frameLength
    ) {
      let start = Date.now();
      await eagle.process(testPcm.slice(j, j + eagle.frameLength));
      if (i > 0) {
        processPerfResults.push((Date.now() - start) / 1000);
      }
    }
  }

  if (eagle instanceof EagleWorker) {
    eagle.terminate();
  } else {
    await eagle.release();
  }

  const procAvgPerf =
    processPerfResults.reduce((a, b) => a + b) / NUM_TEST_ITERATIONS;

  // eslint-disable-next-line no-console
  console.log(`Average process performance: ${procAvgPerf} seconds`);

  expect(procAvgPerf).to.be.lessThan(PROCESS_PERFORMANCE_THRESHOLD_SEC);
}

describe('Eagle Profiler performance test', () => {
  Cypress.config('defaultCommandTimeout', 120000);

  for (const instance of [EagleProfiler, EagleProfilerWorker]) {
    const instanceString = instance === EagleProfilerWorker ? 'worker' : 'main';

    it(`should be lower than performance threshold (${instanceString})`, () => {
      cy.getFramesFromFile('audio_samples/speaker_1_test_utt.wav').then(
        async testPcm => {
          await testEnrollPerformance(instance, testPcm);
        }
      );
    });
  }
});

describe('Eagle performance test', () => {
  Cypress.config('defaultCommandTimeout', 120000);

  for (const instance of [Eagle, EagleWorker]) {
    const instanceString = instance === EagleWorker ? 'worker' : 'main';

    it(`should be lower than performance threshold (${instanceString})`, () => {
      cy.getFramesFromFile('audio_samples/speaker_1_utt_1.wav').then(
        async enrollPcm1 => {
          cy.getFramesFromFile('audio_samples/speaker_1_utt_2.wav').then(
            async enrollPcm2 => {
              cy.getFramesFromFile('audio_samples/speaker_1_test_utt.wav').then(
                async testPcm => {
                  await testProcessPerformance(
                    instance,
                    [enrollPcm1, enrollPcm2],
                    testPcm
                  );
                }
              );
            }
          );
        }
      );
    });
  }
});
