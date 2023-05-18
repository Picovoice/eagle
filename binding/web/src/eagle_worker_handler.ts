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
import {
  EagleProfilerWorkerEnrollRequest,
  EagleProfilerWorkerInitRequest,
  EagleProfilerWorkerRequest,
} from './types';

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

const initRequest = async (
  request: EagleProfilerWorkerInitRequest
): Promise<any> => {
  if (eagleProfiler !== null) {
    return {
      command: 'error',
      message: 'Eagle profiler already initialized',
    };
  }
  try {
    EagleProfiler.setWasm(request.wasm);
    EagleProfiler.setWasmSimd(request.wasmSimd);
    eagleProfiler = await EagleProfiler._init(
      request.accessKey,
      request.modelPath,
      request.options
    );
    return {
      command: 'ok',
      minEnrollSamples: eagleProfiler.minEnrollSamples,
      sampleRate: eagleProfiler.sampleRate,
      version: eagleProfiler.version,
    };
  } catch (e: any) {
    return {
      command: 'error',
      message: e.message,
    };
  }
};

const enrollRequest = async (
  request: EagleProfilerWorkerEnrollRequest
): Promise<any> => {
  if (eagleProfiler === null) {
    return {
      command: 'error',
      message: 'Eagle profiler not initialized',
    };
  }
  try {
    const result = await eagleProfiler.enroll(request.inputFrame);
    return {
      command: 'ok',
      result,
    };
  } catch (e: any) {
    return {
      command: 'error',
      message: e.message,
    };
  }
};

const exportRequest = async (): Promise<any> => {
  if (eagleProfiler === null) {
    return {
      command: 'error',
      message: 'Eagle profiler not initialized',
    };
  }
  try {
    const profile = await eagleProfiler.export();
    return {
      command: 'ok',
      profile,
    };
  } catch (e: any) {
    return {
      command: 'error',
      message: e.message,
    };
  }
};

const resetRequest = async (): Promise<any> => {
  if (eagleProfiler === null) {
    return {
      command: 'error',
      message: 'Eagle not initialized',
    };
  }
  try {
    await eagleProfiler.reset();
    return {
      command: 'ok',
    };
  } catch (e: any) {
    return {
      command: 'error',
      message: e.message,
    };
  }
};

const releaseRequest = async (): Promise<any> => {
  if (eagleProfiler !== null) {
    await eagleProfiler.release();
    eagleProfiler = null;
    close();
  }
  return {
    command: 'ok',
  };
};

/**
 * Eagle worker handler.
 */
self.onmessage = async function (
  event: MessageEvent<EagleProfilerWorkerRequest>
): Promise<void> {
  switch (event.data.command) {
    case 'init':
      self.postMessage(await initRequest(event.data));
      break;
    case 'enroll':
      self.postMessage(await enrollRequest(event.data));
      break;
    case 'export':
      self.postMessage(await exportRequest());
      break;
    case 'reset':
      self.postMessage(await resetRequest());
      break;
    case 'release':
      self.postMessage(await releaseRequest());
      break;
    default:
      self.postMessage({
        command: 'failed',
        // @ts-ignore
        message: `Unrecognized command: ${event.data.command}`,
      });
  }
};
