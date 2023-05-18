import {
  EagleProfiler,
  EagleProfilerEnrollFeedback,
  EagleProfilerWorker,
} from '../';

// @ts-ignore
import eagleParams from './eagle_params';

const ACCESS_KEY = Cypress.env('ACCESS_KEY');

describe('Eagle Binding', function () {
  // it('should be able to init with public path', async () => {
  //   try {
  //     const profiler = await EagleProfiler.create(ACCESS_KEY, {
  //       publicPath: '/test/eagle_params.pv',
  //       forceWrite: true,
  //     });
  //
  //     expect(profiler.sampleRate).to.be.gt(0);
  //     expect(profiler.minEnrollSamples).to.be.gt(0);
  //     expect(typeof profiler.version).to.eq('string');
  //     expect(profiler.version).length.to.be.gt(0);
  //     await profiler.release();
  //   } catch (e) {
  //     expect(e).to.be.undefined;
  //   }
  // });
  //
  // it('should be able to init with public path (worker)', async () => {
  //   try {
  //     const profiler = await EagleProfilerWorker.create(ACCESS_KEY, {
  //       publicPath: '/test/eagle_params.pv',
  //       forceWrite: true,
  //     });
  //     expect(profiler.sampleRate).to.be.gt(0);
  //     expect(profiler.minEnrollSamples).to.be.gt(0);
  //     expect(typeof profiler.version).to.eq('string');
  //     expect(profiler.version).length.to.be.gt(0);
  //     await profiler.release();
  //     await profiler.terminate();
  //   } catch (e) {
  //     expect(e).to.be.undefined;
  //   }
  // });
  //
  // it('should be able to init with base64', async () => {
  //   try {
  //     const profiler = await EagleProfiler.create(ACCESS_KEY, {
  //       base64: eagleParams,
  //       forceWrite: true,
  //     });
  //
  //     expect(profiler.sampleRate).to.be.gt(0);
  //     expect(profiler.minEnrollSamples).to.be.gt(0);
  //     expect(typeof profiler.version).to.eq('string');
  //     expect(profiler.version).length.to.be.gt(0);
  //     await profiler.release();
  //   } catch (e) {
  //     expect(e).to.be.undefined;
  //   }
  // });
  //
  // it('should be able to init with base64 (worker)', async () => {
  //   try {
  //     const profiler = await EagleProfilerWorker.create(ACCESS_KEY, {
  //       base64: eagleParams,
  //       forceWrite: true,
  //     });
  //     expect(profiler.sampleRate).to.be.gt(0);
  //     expect(profiler.minEnrollSamples).to.be.gt(0);
  //     expect(typeof profiler.version).to.eq('string');
  //     expect(profiler.version).length.to.be.gt(0);
  //     await profiler.release();
  //     await profiler.terminate();
  //   } catch (e) {
  //     expect(e).to.be.undefined;
  //   }
  // });

  it('should be able to enroll a speaker', () => {
    cy.getFramesFromFile('audio_samples/enroll_1.wav').then(async inputPcm1 => {
      cy.getFramesFromFile('audio_samples/enroll_2.wav').then(
        async inputPcm2 => {
          try {
            const profiler = await EagleProfilerWorker.create(ACCESS_KEY, {
              publicPath: '/test/eagle_params.pv',
              forceWrite: true,
            });

            const res1 = await profiler.enroll(inputPcm1);
            expect(res1.feedback).to.eq(EagleProfilerEnrollFeedback.AUDIO_OK);
            expect(res1.percentage).to.be.gt(0);

            const res2 = await profiler.enroll(inputPcm2);
            expect(res2.feedback).to.eq(EagleProfilerEnrollFeedback.AUDIO_OK);
            expect(res2.percentage).to.eq(100);

            const result = await profiler.export();
            expect(result.profile.length).to.be.gt(0);

            await profiler.reset();
          } catch (e) {
            expect(e).to.be.undefined;
          }
        }
      );
    });
  });
});
