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
  PvStatus,
} from './types';
import { EagleError } from "./eagle_errors";

let profiler: EagleProfiler | null = null;

const initRequest = async (
  request: EagleProfilerWorkerInitRequest
): Promise<any> => {
  if (profiler !== null) {
    return {
      command: 'error',
      status: PvStatus.INVALID_STATE,
      shortMessage: 'Eagle profiler already initialized',
    };
  }
  try {
    EagleProfiler.setWasm(request.wasm);
    EagleProfiler.setWasmSimd(request.wasmSimd);
    EagleProfiler.setSdk(request.sdk);
    profiler = await EagleProfiler._init(request.accessKey, request.modelPath);
    return {
      command: 'ok',
      minEnrollSamples: profiler.minEnrollSamples,
      sampleRate: profiler.sampleRate,
      version: profiler.version,
    };
  } catch (e: any) {
    if (e instanceof EagleError) {
      return {
        command: 'error',
        status: e.status,
        shortMessage: e.shortMessage,
        messageStack: e.messageStack
      };
    } else {
      return {
        command: 'error',
        status: PvStatus.RUNTIME_ERROR,
        shortMessage: e.message
      };
    }
  }
};

const enrollRequest = async (
  request: EagleProfilerWorkerEnrollRequest
): Promise<any> => {
  if (profiler === null) {
    return {
      command: 'error',
      status: PvStatus.INVALID_STATE,
      shortMessage: 'Eagle profiler not initialized',
    };
  }
  try {
    const result = await profiler.enroll(request.inputFrame);
    return {
      command: 'ok',
      result,
    };
  } catch (e: any) {
    if (e instanceof EagleError) {
      return {
        command: 'error',
        status: e.status,
        shortMessage: e.shortMessage,
        messageStack: e.messageStack
      };
    } else {
      return {
        command: 'error',
        status: PvStatus.RUNTIME_ERROR,
        shortMessage: e.message
      };
    }
  }
};

const exportRequest = async (): Promise<any> => {
  if (profiler === null) {
    return {
      command: 'error',
      status: PvStatus.INVALID_STATE,
      shortMessage: 'Eagle profiler not initialized',
    };
  }
  try {
    const profile = await profiler.export();
    return {
      command: 'ok',
      profile,
    };
  } catch (e: any) {
    if (e instanceof EagleError) {
      return {
        command: 'error',
        status: e.status,
        shortMessage: e.shortMessage,
        messageStack: e.messageStack
      };
    } else {
      return {
        command: 'error',
        status: PvStatus.RUNTIME_ERROR,
        shortMessage: e.message
      };
    }
  }
};

const resetRequest = async (): Promise<any> => {
  if (profiler === null) {
    return {
      command: 'error',
      status: PvStatus.INVALID_STATE,
      shortMessage: 'Eagle profiler not initialized',
    };
  }
  try {
    await profiler.reset();
    return {
      command: 'ok',
    };
  } catch (e: any) {
    if (e instanceof EagleError) {
      return {
        command: 'error',
        status: e.status,
        shortMessage: e.shortMessage,
        messageStack: e.messageStack
      };
    } else {
      return {
        command: 'error',
        status: PvStatus.RUNTIME_ERROR,
        shortMessage: e.message
      };
    }
  }
};

const releaseRequest = async (): Promise<any> => {
  if (profiler !== null) {
    await profiler.release();
    profiler = null;
    close();
  }
  return {
    command: 'ok',
  };
};

/**
 * Eagle profiler worker handler.
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
    case 'export': {
      const exportMsg = await exportRequest();
      self.postMessage(exportMsg, [exportMsg.profile.bytes.buffer]);
      break;
    }
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
