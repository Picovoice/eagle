import {
  Eagle,
  EagleProfile,
  EagleProfiler,
  EagleProfilerEnrollFeedback,
  EagleProfilerWorker,
  EagleWorker,
} from '../';

// @ts-ignore
import eagleParams from './eagle_params';
import { EagleError } from "../src/eagle_errors";

const ACCESS_KEY = Cypress.env('ACCESS_KEY');
let testProfile: EagleProfile;

const getProfile = async (
  profiler,
  audioChunks,
  expectedFeedback
): Promise<EagleProfile> => {
  let percentage = 0;
  for (let i = 0; i < audioChunks.length; i++) {
    const result = await profiler.enroll(audioChunks[i]);
    expect(result.feedback).to.eq(expectedFeedback[i]);
    expect(result.percentage).to.be.gt(0);
    percentage = result.percentage;
  }
  expect(percentage).to.be.eq(100);

  return await profiler.export();
};

const getScores = async (eagle, pcm): Promise<number[]> => {
  const allScores: number[] = [];
  for (
    let i = 0;
    i < pcm.length - eagle.frameLength + 1;
    i += eagle.frameLength
  ) {
    const scores = await eagle.process(pcm.slice(i, i + eagle.frameLength));
    allScores.push(scores[0]);
  }

  return allScores;
};

before(() => {
  cy.getFramesFromFile('audio_samples/speaker_1_utt_1.wav').then(
    async inputPcm1 => {
      cy.getFramesFromFile('audio_samples/speaker_1_utt_2.wav').then(
        async inputPcm2 => {
          const profiler = await EagleProfiler.create(ACCESS_KEY, {
            publicPath: '/test/eagle_params.pv',
            forceWrite: true,
          });
          testProfile = await getProfile(
            profiler,
            [inputPcm1, inputPcm2],
            [
              EagleProfilerEnrollFeedback.AUDIO_OK,
              EagleProfilerEnrollFeedback.AUDIO_OK,
            ]
          );
          profiler.release();
        }
      );
    }
  );
});

describe('Eagle Profiler', async function () {
  it('should be able to init with public path', async () => {
    try {
      const profiler = await EagleProfiler.create(ACCESS_KEY, {
        publicPath: '/test/eagle_params.pv',
        forceWrite: true,
      });

      expect(profiler.sampleRate).to.be.gt(0);
      expect(profiler.minEnrollSamples).to.be.gt(0);
      expect(typeof profiler.version).to.eq('string');
      expect(profiler.version).length.to.be.gt(0);
      await profiler.release();
    } catch (e) {
      expect(e).to.be.undefined;
    }
  });

  it('should be able to init with public path (worker)', async () => {
    try {
      const profiler = await EagleProfilerWorker.create(ACCESS_KEY, {
        publicPath: '/test/eagle_params.pv',
        forceWrite: true,
      });
      expect(profiler.sampleRate).to.be.gt(0);
      expect(profiler.minEnrollSamples).to.be.gt(0);
      expect(typeof profiler.version).to.eq('string');
      expect(profiler.version).length.to.be.gt(0);
      await profiler.release();
      await profiler.terminate();
    } catch (e) {
      expect(e).to.be.undefined;
    }
  });

  it('should be able to init with base64', async () => {
    try {
      const profiler = await EagleProfiler.create(ACCESS_KEY, {
        base64: eagleParams,
        forceWrite: true,
      });

      expect(profiler.sampleRate).to.be.gt(0);
      expect(profiler.minEnrollSamples).to.be.gt(0);
      expect(typeof profiler.version).to.eq('string');
      expect(profiler.version).length.to.be.gt(0);
      await profiler.release();
    } catch (e) {
      expect(e).to.be.undefined;
    }
  });

  it('should be able to init with base64 (worker)', async () => {
    try {
      const profiler = await EagleProfilerWorker.create(ACCESS_KEY, {
        base64: eagleParams,
        forceWrite: true,
      });
      expect(profiler.sampleRate).to.be.gt(0);
      expect(profiler.minEnrollSamples).to.be.gt(0);
      expect(typeof profiler.version).to.eq('string');
      expect(profiler.version).length.to.be.gt(0);
      await profiler.release();
      await profiler.terminate();
    } catch (e) {
      expect(e).to.be.undefined;
    }
  });

  it('should be able to enroll speakers with reset', () => {
    cy.getFramesFromFile('audio_samples/speaker_1_utt_1.wav').then(
      async inputPcm1 => {
        cy.getFramesFromFile('audio_samples/speaker_1_utt_2.wav').then(
          async inputPcm2 => {
            try {
              const profiler = await EagleProfiler.create(ACCESS_KEY, {
                publicPath: '/test/eagle_params.pv',
                forceWrite: true,
              });

              const profile = await getProfile(
                profiler,
                [inputPcm1, inputPcm2],
                [
                  EagleProfilerEnrollFeedback.AUDIO_OK,
                  EagleProfilerEnrollFeedback.AUDIO_OK,
                ]
              );
              expect(profile.bytes.length).to.be.gt(0);

              await profiler.reset();
              const profile2 = await getProfile(
                profiler,
                [inputPcm1, inputPcm2],
                [
                  EagleProfilerEnrollFeedback.AUDIO_OK,
                  EagleProfilerEnrollFeedback.AUDIO_OK,
                ]
              );
              expect(profile2.bytes.length).to.be.eq(profile.bytes.length);
              await profiler.release();
            } catch (e) {
              expect(e).to.be.undefined;
            }
          }
        );
      }
    );
  });

  it('should be able to enroll speakers with reset (worker)', () => {
    cy.getFramesFromFile('audio_samples/speaker_1_utt_1.wav').then(
      async inputPcm1 => {
        cy.getFramesFromFile('audio_samples/speaker_1_utt_2.wav').then(
          async inputPcm2 => {
            try {
              const profiler = await EagleProfilerWorker.create(ACCESS_KEY, {
                publicPath: '/test/eagle_params.pv',
                forceWrite: true,
              });

              const profile = await getProfile(
                profiler,
                [inputPcm1, inputPcm2],
                [
                  EagleProfilerEnrollFeedback.AUDIO_OK,
                  EagleProfilerEnrollFeedback.AUDIO_OK,
                ]
              );
              expect(profile.bytes.length).to.be.gt(0);

              await profiler.reset();
              const profile2 = await getProfile(
                profiler,
                [inputPcm1, inputPcm2],
                [
                  EagleProfilerEnrollFeedback.AUDIO_OK,
                  EagleProfilerEnrollFeedback.AUDIO_OK,
                ]
              );
              expect(profile2.bytes.length).to.be.eq(profile.bytes.length);
              await profiler.release();
            } catch (e) {
              expect(e).to.be.undefined;
            }
          }
        );
      }
    );
  });

  it(`should return correct error message stack`, async () => {
    let messageStack = [];
    try {
      const eagle = await EagleProfiler.create(
        "invalidAccessKey",
        { base64: eagleParams, forceWrite: true }
      );
      await eagle.release();
      expect(eagle).to.be.undefined;
    } catch (e: any) {
      messageStack = e.messageStack;
    }

    expect(messageStack.length).to.be.gt(0);
    expect(messageStack.length).to.be.lte(8);

    try {
      const eagle = await EagleProfiler.create(
        "invalidAccessKey",
        { base64: eagleParams, forceWrite: true }
      );
      await eagle.release();
      expect(eagle).to.be.undefined;
    } catch (e: any) {
      expect(messageStack.length).to.be.eq(e.messageStack.length);
    }
  });

  it(`should return correct error message stack (worker)`, async () => {
    let messageStack = [];
    try {
      const eagle = await EagleProfilerWorker.create(
        "invalidAccessKey",
        { base64: eagleParams, forceWrite: true }
      );
      eagle.terminate();
      expect(eagle).to.be.undefined;
    } catch (e: any) {
      messageStack = e.messageStack;
    }

    expect(messageStack.length).to.be.gt(0);
    expect(messageStack.length).to.be.lte(8);

    try {
      const eagle = await EagleProfilerWorker.create(
        "invalidAccessKey",
        { base64: eagleParams, forceWrite: true }
      );
      eagle.terminate();
      expect(eagle).to.be.undefined;
    } catch (e: any) {
      expect(messageStack.length).to.be.eq(e.messageStack.length);
    }
  });

  it(`should return enroll/export error message stack`, async () => {
    let error: EagleError | null = null;

    const eagle = await EagleProfiler.create(
      ACCESS_KEY,
      { base64: eagleParams, forceWrite: true }
    );

    const testPcm = new Int16Array(eagle.minEnrollSamples);
    // @ts-ignore
    const objectAddress = eagle._objectAddress;

    // @ts-ignore
    eagle._objectAddress = 0;

    try {
      await eagle.enroll(testPcm);
    } catch (e: any) {
      error = e;
    }

    expect(error).to.not.be.null;
    if (error) {
      expect((error as EagleError).messageStack.length).to.be.gt(0);
      expect((error as EagleError).messageStack.length).to.be.lte(8);
    }

    try {
      await eagle.export();
    } catch (e: any) {
      error = e;
    }

    expect(error).to.not.be.null;
    if (error) {
      expect((error as EagleError).messageStack.length).to.be.gt(0);
      expect((error as EagleError).messageStack.length).to.be.lte(8);
    }

    // @ts-ignore
    eagle._objectAddress = objectAddress;
    await eagle.release();
  });
});

describe('Eagle', function () {
  it('eagle init', async () => {
    const eagle = await Eagle.create(
      ACCESS_KEY,
      {
        publicPath: '/test/eagle_params.pv',
        forceWrite: true,
      },
      testProfile
    );
    expect(eagle.sampleRate).to.be.gt(0);
    expect(eagle.frameLength).to.be.gt(0);
    expect(typeof eagle.version).to.eq('string');
    expect(eagle.version).length.to.be.gt(0);
    await eagle.release();
  });

  it('eagle init (worker)', async () => {
    const eagle = await EagleWorker.create(
      ACCESS_KEY,
      {
        publicPath: '/test/eagle_params.pv',
        forceWrite: true,
      },
      testProfile
    );
    expect(eagle.sampleRate).to.be.gt(0);
    expect(eagle.frameLength).to.be.gt(0);
    expect(typeof eagle.version).to.eq('string');
    expect(eagle.version).length.to.be.gt(0);
    await eagle.release();
    await eagle.terminate();
  });

  it('eagle init with base64', async () => {
    const eagle = await Eagle.create(
      ACCESS_KEY,
      {
        base64: eagleParams,
        forceWrite: true,
      },
      testProfile
    );
    expect(eagle.sampleRate).to.be.gt(0);
    expect(eagle.frameLength).to.be.gt(0);
    expect(typeof eagle.version).to.eq('string');
    expect(eagle.version).length.to.be.gt(0);
    await eagle.release();
  });

  it('eagle init with base64 (worker)', async () => {
    const eagle = await EagleWorker.create(
      ACCESS_KEY,
      {
        base64: eagleParams,
        forceWrite: true,
      },
      testProfile
    );
    expect(eagle.sampleRate).to.be.gt(0);
    expect(eagle.frameLength).to.be.gt(0);
    expect(typeof eagle.version).to.eq('string');
    expect(eagle.version).length.to.be.gt(0);
    await eagle.release();
    await eagle.terminate();
  });

  it(`should return correct error message stack`, async () => {
    let messageStack = [];
    try {
      const eagle = await Eagle.create(
        "invalidAccessKey",
        { base64: eagleParams, forceWrite: true },
        testProfile
      );
      await eagle.release();
      expect(eagle).to.be.undefined;
    } catch (e: any) {
      messageStack = e.messageStack;
    }

    expect(messageStack.length).to.be.gt(0);
    expect(messageStack.length).to.be.lte(8);

    try {
      const eagle = await Eagle.create(
        "invalidAccessKey",
        { base64: eagleParams, forceWrite: true },
        testProfile
      );
      await eagle.release();
      expect(eagle).to.be.undefined;
    } catch (e: any) {
      expect(messageStack.length).to.be.eq(e.messageStack.length);
    }
  });

  it(`should return correct error message stack (worker)`, async () => {
    let messageStack = [];
    try {
      const eagle = await EagleWorker.create(
        "invalidAccessKey",
        { base64: eagleParams, forceWrite: true },
        testProfile
      );
      eagle.terminate();
      expect(eagle).to.be.undefined;
    } catch (e: any) {
      messageStack = e.messageStack;
    }

    expect(messageStack.length).to.be.gt(0);
    expect(messageStack.length).to.be.lte(8);

    try {
      const eagle = await EagleWorker.create(
        "invalidAccessKey",
        { base64: eagleParams, forceWrite: true },
        testProfile
      );
      eagle.terminate();
      expect(eagle).to.be.undefined;
    } catch (e: any) {
      expect(messageStack.length).to.be.eq(e.messageStack.length);
    }
  });

  it(`should return process error message stack`, async () => {
    let error: EagleError | null = null;

    const eagle = await Eagle.create(
      ACCESS_KEY,
      { base64: eagleParams, forceWrite: true },
      testProfile
    );
    const testPcm = new Int16Array(eagle.frameLength);
    // @ts-ignore
    const objectAddress = eagle._objectAddress;

    // @ts-ignore
    eagle._objectAddress = 0;

    try {
      await eagle.process(testPcm);
    } catch (e: any) {
      error = e;
    }

    // @ts-ignore
    eagle._objectAddress = objectAddress;
    await eagle.release();

    expect(error).to.not.be.null;
    if (error) {
      expect((error as EagleError).messageStack.length).to.be.gt(0);
      expect((error as EagleError).messageStack.length).to.be.lte(8);
    }
  });

  it('eagle process with reset', () => {
    cy.getFramesFromFile('audio_samples/speaker_1_test_utt.wav').then(
      async testPcm => {
        try {
          const eagle = await Eagle.create(
            ACCESS_KEY,
            {
              publicPath: '/test/eagle_params.pv',
              forceWrite: true,
            },
            testProfile
          );
          const scores = await getScores(eagle, testPcm);

          expect(Math.max(...scores)).to.be.gt(0.5);
          await eagle.reset();

          const scores2 = await getScores(eagle, testPcm);

          expect(scores2).to.be.deep.eq(scores);
          await eagle.release();
        } catch (e) {
          expect(e).to.be.undefined;
        }
      }
    );
  });

  it('eagle process with reset (worker)', () => {
    cy.getFramesFromFile('audio_samples/speaker_1_test_utt.wav').then(
      async testPcm => {
        try {
          const eagle = await EagleWorker.create(
            ACCESS_KEY,
            {
              publicPath: '/test/eagle_params.pv',
              forceWrite: true,
            },
            testProfile
          );
          const scores = await getScores(eagle, testPcm);

          expect(Math.max(...scores)).to.be.gt(0.5);
          await eagle.reset();

          const scores2 = await getScores(eagle, testPcm);

          expect(scores2).to.be.deep.eq(scores);
          await eagle.release();
          await eagle.terminate();
        } catch (e) {
          expect(e).to.be.undefined;
        }
      }
    );
  });

  it('eagle process imposter', () => {
    cy.getFramesFromFile('audio_samples/speaker_2_test_utt.wav').then(
      async testPcm => {
        try {
          const eagle = await Eagle.create(
            ACCESS_KEY,
            {
              publicPath: '/test/eagle_params.pv',
              forceWrite: true,
            },
            testProfile
          );
          const scores = await getScores(eagle, testPcm);

          expect(Math.max(...scores)).to.be.lt(0.5);
          await eagle.release();
        } catch (e) {
          expect(e).to.be.undefined;
        }
      }
    );
  });
});
