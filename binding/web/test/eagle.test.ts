import {
  Eagle,
  EagleProfiler,
  EagleProfilerEnrollFeedback,
  EagleProfilerWorker,
} from '../';

// @ts-ignore
import eagleParams from './eagle_params';
import { EagleProfilerEnrollResult } from '../src/types';

const ACCESS_KEY = Cypress.env('ACCESS_KEY');

const getProfile = async (audioChunks: Int16Array[]): Promise<Uint8Array> => {
  const profiler = await EagleProfiler.create(ACCESS_KEY, {
    publicPath: '/test/eagle_params.pv',
    forceWrite: true,
  });

  let percentage = 0;
  for (const audio of audioChunks) {
    const result = await profiler.enroll(audio);
    expect(result.feedback).to.eq(EagleProfilerEnrollFeedback.AUDIO_OK);
    expect(result.percentage).to.be.gt(0);
    percentage = result.percentage;
  }
  expect(percentage).to.eq(100);

  const profile = await profiler.export();
  expect(profile.length).to.be.gt(0);

  await profiler.release();
  return profile;
};

// describe('Eagle Profiler', async function () {
//   // it('should be able to init with public path', async () => {
//   //   try {
//   //     const profiler = await EagleProfiler.create(ACCESS_KEY, {
//   //       publicPath: '/test/eagle_params.pv',
//   //       forceWrite: true,
//   //     });
//   //
//   //     expect(profiler.sampleRate).to.be.gt(0);
//   //     expect(profiler.minEnrollSamples).to.be.gt(0);
//   //     expect(typeof profiler.version).to.eq('string');
//   //     expect(profiler.version).length.to.be.gt(0);
//   //     await profiler.release();
//   //   } catch (e) {
//   //     expect(e).to.be.undefined;
//   //   }
//   // });
//   //
//   // it('should be able to init with public path (worker)', async () => {
//   //   try {
//   //     const profiler = await EagleProfilerWorker.create(ACCESS_KEY, {
//   //       publicPath: '/test/eagle_params.pv',
//   //       forceWrite: true,
//   //     });
//   //     expect(profiler.sampleRate).to.be.gt(0);
//   //     expect(profiler.minEnrollSamples).to.be.gt(0);
//   //     expect(typeof profiler.version).to.eq('string');
//   //     expect(profiler.version).length.to.be.gt(0);
//   //     await profiler.release();
//   //     await profiler.terminate();
//   //   } catch (e) {
//   //     expect(e).to.be.undefined;
//   //   }
//   // });
//   //
//   // it('should be able to init with base64', async () => {
//   //   try {
//   //     const profiler = await EagleProfiler.create(ACCESS_KEY, {
//   //       base64: eagleParams,
//   //       forceWrite: true,
//   //     });
//   //
//   //     expect(profiler.sampleRate).to.be.gt(0);
//   //     expect(profiler.minEnrollSamples).to.be.gt(0);
//   //     expect(typeof profiler.version).to.eq('string');
//   //     expect(profiler.version).length.to.be.gt(0);
//   //     await profiler.release();
//   //   } catch (e) {
//   //     expect(e).to.be.undefined;
//   //   }
//   // });
//   //
//   // it('should be able to init with base64 (worker)', async () => {
//   //   try {
//   //     const profiler = await EagleProfilerWorker.create(ACCESS_KEY, {
//   //       base64: eagleParams,
//   //       forceWrite: true,
//   //     });
//   //     expect(profiler.sampleRate).to.be.gt(0);
//   //     expect(profiler.minEnrollSamples).to.be.gt(0);
//   //     expect(typeof profiler.version).to.eq('string');
//   //     expect(profiler.version).length.to.be.gt(0);
//   //     await profiler.release();
//   //     await profiler.terminate();
//   //   } catch (e) {
//   //     expect(e).to.be.undefined;
//   //   }
//   // });
//   // it('should be able to enroll a speaker', () => {
//   //   cy.getFramesFromFile('audio_samples/speaker_1_utt_1.wav').then(
//   //     async inputPcm1 => {
//   //       cy.getFramesFromFile('audio_samples/speaker_1_utt_2.wav').then(
//   //         async inputPcm2 => {
//   //           try {
//   //             const profiler = await EagleProfilerWorker.create(ACCESS_KEY, {
//   //               publicPath: '/test/eagle_params.pv',
//   //               forceWrite: true,
//   //             });
//   //
//   //             const res1 = await profiler.enroll(inputPcm1);
//   //             expect(res1.feedback).to.eq(EagleProfilerEnrollFeedback.AUDIO_OK);
//   //             expect(res1.percentage).to.be.gt(0);
//   //
//   //             const res2 = await profiler.enroll(inputPcm2);
//   //             expect(res2.feedback).to.eq(EagleProfilerEnrollFeedback.AUDIO_OK);
//   //             expect(res2.percentage).to.eq(100);
//   //
//   //             const profile = await profiler.export();
//   //             expect(profile.length).to.be.gt(0);
//   //
//   //             await profiler.reset();
//   //           } catch (e) {
//   //             expect(e).to.be.undefined;
//   //           }
//   //         }
//   //       );
//   //     }
//   //   );
//   // });
// });

describe('Eagle', function () {
  it('init eagle', () => {
    cy.getFramesFromFile('audio_samples/speaker_1_utt_1.wav').then(
      async inputPcm1 => {
        cy.getFramesFromFile('audio_samples/speaker_1_utt_2.wav').then(
          async inputPcm2 => {
            try {
              const profile = await getProfile([inputPcm1, inputPcm2]);
              const eagle = await Eagle.create(
                ACCESS_KEY,
                {
                  publicPath: '/test/eagle_params.pv',
                  forceWrite: true,
                },
                [profile]
              );
              expect(eagle.sampleRate).to.be.gt(0);
              expect(eagle.frameLength).to.be.gt(0);
              expect(typeof eagle.version).to.eq('string');
              expect(eagle.version).length.to.be.gt(0);
              cy.getFramesFromFile('audio_samples/test.wav').then(
                async testPcm => {
                  const allScores: number[] = [];
                  for (
                    let i = 0;
                    i < testPcm.length - eagle.frameLength + 1;
                    i += eagle.frameLength
                  ) {
                    const scores = await eagle.process(
                      testPcm.slice(i, i + eagle.frameLength)
                    );
                    allScores.push(scores[0]);
                  }
                  console.log(allScores);
                  expect(Math.max(...allScores)).to.be.gt(0.5);
                  await eagle.release();
                }
              );
            } catch (e) {
              expect(e).to.be.undefined;
            }
          }
        );
      }
    );
  });
});
