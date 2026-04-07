import {
  Eagle,
  EagleProfile,
  EagleProfiler,
  EagleProfilerWorker,
  EagleWorker,
} from '../';

// @ts-ignore
import eagleParams from './eagle_params';
import { EagleError } from "../src/eagle_errors";

const ACCESS_KEY = Cypress.env('ACCESS_KEY');
const DEVICE = Cypress.env('DEVICE');

let testProfile: EagleProfile;

const getProfile = async (
  profiler,
  audioChunks
): Promise<EagleProfile> => {
  let percentage = 0;
  for (let i = 0; i < audioChunks.length; i++) {
    for (
      let j = 0;
      j < audioChunks[i].length - profiler.frameLength + 1;
      j += profiler.frameLength
    ) {
      percentage = await profiler.enroll(
        audioChunks[i].slice(j, j + profiler.frameLength),
      );
    }
    percentage = await profiler.flush();
  }

  expect(percentage).to.be.eq(100);

  return await profiler.export();
};

const getScores = async (
  eagle,
  pcm,
  speakerProfiles
): Promise<number[]> => await eagle.process(
  pcm,
  speakerProfiles
);

before(() => {
  cy.getFramesFromFile('audio_samples/speaker_1_utt_1.wav').then(
    async inputPcm1 => {
      cy.getFramesFromFile('audio_samples/speaker_1_utt_2.wav').then(
        async inputPcm2 => {
          const profiler = await EagleProfiler.create(
            ACCESS_KEY,
            {
              publicPath: '/test/eagle_params.pv',
              forceWrite: true,
            },
            { device: DEVICE }
          );
          testProfile = await getProfile(
            profiler,
            [inputPcm1, inputPcm2]
          );
          profiler.release();
        }
      );
    }
  );
});

describe('Eagle Profiler', async function () {
  for (const instance of [EagleProfiler, EagleProfilerWorker]) {
    const instanceString = instance === EagleProfilerWorker ? 'worker' : 'main';
    it(`should be able to init with public path (${instanceString})`, async () => {
      try {
        const profiler = await instance.create(
          ACCESS_KEY,
          {
            publicPath: '/test/eagle_params.pv',
            forceWrite: true,
          },
          { device: DEVICE }
        );
        expect(profiler.sampleRate).to.be.gt(0);
        expect(profiler.frameLength).to.be.gt(0);
        expect(typeof profiler.version).to.eq('string');
        expect(profiler.version).length.to.be.gt(0);
        await profiler.release();
      } catch (e) {
        expect(e).to.be.undefined;
      }
    });

    it(`should be able to init with base64 (${instanceString})`, async () => {
      try {
        const profiler = await instance.create(
          ACCESS_KEY,
          {
            base64: eagleParams,
            forceWrite: true,
          },
          { device: DEVICE }
        );

        expect(profiler.sampleRate).to.be.gt(0);
        expect(profiler.frameLength).to.be.gt(0);
        expect(typeof profiler.version).to.eq('string');
        expect(profiler.version).length.to.be.gt(0);
        await profiler.release();
      } catch (e) {
        expect(e).to.be.undefined;
      }
    });

    it(`should be able to enroll speakers with reset (${instanceString})`, () => {
      cy.getFramesFromFile('audio_samples/speaker_1_utt_1.wav').then(
        async inputPcm1 => {
          cy.getFramesFromFile('audio_samples/speaker_1_utt_2.wav').then(
            async inputPcm2 => {
              try {
                const profiler = await instance.create(
                  ACCESS_KEY,
                  {
                    publicPath: '/test/eagle_params.pv',
                    forceWrite: true,
                  },
                  { device: DEVICE }
                );

                const profile = await getProfile(
                  profiler,
                  [inputPcm1, inputPcm2]
                );
                expect(profile.bytes.length).to.be.gt(0);

                await profiler.reset();
                const profile2 = await getProfile(
                  profiler,
                  [inputPcm1, inputPcm2]
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

    it(`should return correct error message stack (${instanceString})`, async () => {
      let messageStack = [];
      try {
        const eagle = await instance.create(
          "invalidAccessKey",
          { base64: eagleParams, forceWrite: true },
          { device: DEVICE }
        );
        await eagle.release();
        expect(eagle).to.be.undefined;
      } catch (e: any) {
        messageStack = e.messageStack;
      }

      expect(messageStack.length).to.be.gt(0);
      expect(messageStack.length).to.be.lte(8);

      try {
        const eagle = await instance.create(
          "invalidAccessKey",
          { base64: eagleParams, forceWrite: true },
          { device: DEVICE }
        );
        await eagle.release();
        expect(eagle).to.be.undefined;
      } catch (e: any) {
        expect(messageStack.length).to.be.eq(e.messageStack.length);
      }
    });

    it(`should handle invalid device (${instanceString})`, async () => {
      let messageStack = [];
      try {
        const eagle = await instance.create(
          ACCESS_KEY,
          { base64: eagleParams, forceWrite: true },
          { device: "cloud:9" }
        );
        expect(eagle).to.be.undefined;
      } catch (e: any) {
        messageStack = e.messageStack;
      }

      expect(messageStack.length).to.be.gt(0);
      expect(messageStack.length).to.be.lte(8);
    });
  }

  it(`should return enroll/export error message stack (main)`, async () => {
    let error: EagleError | null = null;

    const eagle = await EagleProfiler.create(
      ACCESS_KEY,
      { base64: eagleParams, forceWrite: true },
      { device: DEVICE }
    );

    const testPcm = new Int16Array(eagle.frameLength);
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

/* eslint-disable no-loop-func */
describe('Eagle', function () {
  for (const instance of [Eagle, EagleWorker]) {
    const instanceString = instance === EagleWorker ? 'worker' : 'main';
    it(`eagle init (${instanceString})`, async () => {
      const eagle = await instance.create(
        ACCESS_KEY,
        {
          publicPath: '/test/eagle_params.pv',
          forceWrite: true,
        },
        { device: DEVICE }
      );
      expect(eagle.sampleRate).to.be.gt(0);
      expect(eagle.minProcessSamples).to.be.gt(0);
      expect(typeof eagle.version).to.eq('string');
      expect(eagle.version).length.to.be.gt(0);
      await eagle.release();
    });

    it(`eagle init with base64 (${instanceString})`, async () => {
      const eagle = await instance.create(
        ACCESS_KEY,
        {
          base64: eagleParams,
          forceWrite: true,
        },
        { device: DEVICE }
      );
      expect(eagle.sampleRate).to.be.gt(0);
      expect(eagle.minProcessSamples).to.be.gt(0);
      expect(typeof eagle.version).to.eq('string');
      expect(eagle.version).length.to.be.gt(0);
      await eagle.release();
    });

    it(`should return correct error message stack (${instanceString})`, async () => {
      let messageStack = [];
      try {
        const eagle = await instance.create(
          "invalidAccessKey",
          { base64: eagleParams, forceWrite: true },
          { device: DEVICE }
        );
        await eagle.release();
        expect(eagle).to.be.undefined;
      } catch (e: any) {
        messageStack = e.messageStack;
      }

      expect(messageStack.length).to.be.gt(0);
      expect(messageStack.length).to.be.lte(8);

      try {
        const eagle = await instance.create(
          "invalidAccessKey",
          { base64: eagleParams, forceWrite: true },
          { device: DEVICE }
        );
        await eagle.release();
        expect(eagle).to.be.undefined;
      } catch (e: any) {
        expect(messageStack.length).to.be.eq(e.messageStack.length);
      }
    });

    it(`should be able to handle invalid device (${instanceString})`, async () => {
      let messageStack = [];
      try {
        const eagle = await instance.create(
          ACCESS_KEY,
          { base64: eagleParams, forceWrite: true },
          { device: "cloud:9" }
        );
        expect(eagle).to.be.undefined;
      } catch (e: any) {
        messageStack = e.messageStack;
      }

      expect(messageStack.length).to.be.gt(0);
      expect(messageStack.length).to.be.lte(8);
    });

    it(`eagle process (${instanceString})`, () => {
      cy.getFramesFromFile('audio_samples/speaker_1_test_utt.wav').then(
        async testPcm => {
          try {
            const eagle = await instance.create(
              ACCESS_KEY,
              {
                publicPath: '/test/eagle_params.pv',
                forceWrite: true,
              },
              { device: DEVICE }
            );
            const scores = await getScores(eagle, testPcm, testProfile);

            expect(scores[0]).to.be.gt(0.5);

            const scores2 = await getScores(eagle, testPcm, testProfile);

            expect(scores2).to.be.deep.eq(scores);
            await eagle.release();
          } catch (e) {
            expect(e).to.be.undefined;
          }
        }
      );
    });

    it(`eagle process imposter (${instanceString})`, () => {
      cy.getFramesFromFile('audio_samples/speaker_2_test_utt.wav').then(
        async testPcm => {
          try {
            const eagle = await instance.create(
              ACCESS_KEY,
              {
                publicPath: '/test/eagle_params.pv',
                forceWrite: true,
              },
              { device: DEVICE }
            );
            const scores = await getScores(eagle, testPcm, testProfile);

            expect(scores[0]).to.be.lt(0.5);
            await eagle.release();
          } catch (e) {
            expect(e).to.be.undefined;
          }
        }
      );
    });
  }

  it('List hardware devices', async () => {
    const hardwareDevices: string[] = await Eagle.listAvailableDevices();
    expect(Array.isArray(hardwareDevices)).to.be.true;
    expect(hardwareDevices).length.to.be.greaterThan(0);
  });

  it(`should return process error message stack (main)`, async () => {
    let error: EagleError | null = null;

    const eagle = await Eagle.create(
      ACCESS_KEY,
      { base64: eagleParams, forceWrite: true },
      { device: DEVICE }
    );
    const testPcm = new Int16Array(eagle.minProcessSamples);
    // @ts-ignore
    const objectAddress = eagle._objectAddress;

    // @ts-ignore
    eagle._objectAddress = 0;

    try {
      await eagle.process(testPcm, testProfile);
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
});
