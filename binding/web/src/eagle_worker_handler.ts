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

import { Eagle } from './eagle';
import {
  EagleWorkerProcessRequest,
  EagleWorkerInitRequest,
  EagleWorkerRequest,
  PvStatus,
} from './types';
import { EagleError } from "./eagle_errors";

let eagle: Eagle | null = null;

const initRequest = async (request: EagleWorkerInitRequest): Promise<any> => {
  if (eagle !== null) {
    return {
      command: 'error',
      status: PvStatus.INVALID_STATE,
      shortMessage: 'Eagle has already been initialized',
    };
  }
  try {
    Eagle.setWasm(request.wasm);
    Eagle.setWasmSimd(request.wasmSimd);
    Eagle.setSdk(request.sdk);
    eagle = await Eagle._init(
      request.accessKey,
      request.modelPath,
      request.speakerProfiles
    );
    return {
      command: 'ok',
      frameLength: eagle.frameLength,
      sampleRate: eagle.sampleRate,
      version: eagle.version,
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

const processRequest = async (
  request: EagleWorkerProcessRequest
): Promise<any> => {
  if (eagle === null) {
    return {
      command: 'error',
      status: PvStatus.INVALID_STATE,
      shortMessage: 'Eagle has not been initialized',
    };
  }
  try {
    const scores = await eagle.process(request.inputFrame);
    return {
      command: 'ok',
      scores,
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
  if (eagle === null) {
    return {
      command: 'error',
      status: PvStatus.INVALID_STATE,
      shortMessage: 'Eagle has not been initialized',
    };
  }
  try {
    await eagle.reset();
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
  if (eagle !== null) {
    await eagle.release();
    eagle = null;
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
  event: MessageEvent<EagleWorkerRequest>
): Promise<void> {
  switch (event.data.command) {
    case 'init':
      self.postMessage(await initRequest(event.data));
      break;
    case 'process':
      self.postMessage(await processRequest(event.data));
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
