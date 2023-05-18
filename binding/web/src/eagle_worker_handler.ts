/*
  Copyright 2023 Picovoice Inc.
  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.
  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

/// <reference no-default-lib="false"/>
/// <reference lib="webworker" />

import { EagleProfiler } from './eagle';
import { EagleProfilerWorkerRequest } from './types';

let eagleProfiler: EagleProfiler | null = null;

// const processCallback = (enhancedPcm: Int16Array): void => {
//   self.postMessage({
//     command: 'ok',
//     enhancedPcm: enhancedPcm,
//   });
// };

// const processErrorCallback = (error: string): void => {
//   self.postMessage({
//     command: 'error',
//     message: error,
//   });
// };

/**
 * Eagle worker handler.
 */
self.onmessage = async function (
  event: MessageEvent<EagleProfilerWorkerRequest>
): Promise<void> {
  switch (event.data.command) {
    case 'init':
      if (eagleProfiler !== null) {
        self.postMessage({
          command: 'error',
          message: 'Eagle profiler already initialized',
        });
        return;
      }
      try {
        EagleProfiler.setWasm(event.data.wasm);
        EagleProfiler.setWasmSimd(event.data.wasmSimd);
        eagleProfiler = await EagleProfiler._init(
          event.data.accessKey,
          event.data.modelPath,
          event.data.options
        );
        self.postMessage({
          command: 'ok',
          minEnrollSamples: eagleProfiler.minEnrollSamples,
          sampleRate: eagleProfiler.sampleRate,
          version: eagleProfiler.version,
        });
      } catch (e: any) {
        self.postMessage({
          command: 'error',
          message: e.message,
        });
      }
      break;
    case 'enroll':
      if (eagleProfiler === null) {
        self.postMessage({
          command: 'error',
          message: 'Eagle profiler not initialized',
        });
        return;
      }
      await eagleProfiler.enroll(event.data.inputFrame);
      break;
    case 'export':
      if (eagleProfiler === null) {
        self.postMessage({
          command: 'error',
          message: 'Eagle profiler not initialized',
        });
        return;
      }
      await eagleProfiler.export();
      break;
    case 'reset':
      if (eagleProfiler === null) {
        self.postMessage({
          command: 'error',
          message: 'Eagle not initialized',
        });
        return;
      }
      await eagleProfiler.reset();
      break;
    case 'release':
      if (eagleProfiler !== null) {
        await eagleProfiler.release();
        eagleProfiler = null;
        close();
      }
      self.postMessage({
        command: 'ok',
      });
      break;
    default:
      self.postMessage({
        command: 'failed',
        // @ts-ignore
        message: `Unrecognized command: ${event.data.command}`,
      });
  }
};
