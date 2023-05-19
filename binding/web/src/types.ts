/*
  Copyright 2023 Picovoice Inc.

  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.

  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

import { PvModel } from '@picovoice/web-utils';

/**
 * EagleModel types
 */
export type EagleModel = PvModel;

export enum EagleProfilerEnrollFeedback {
  AUDIO_OK = 0,
  AUDIO_TOO_SHORT,
  UNKNOWN_SPEAKER,
  NO_VOICE_FOUND,
  QUALITY_ISSUE,
}

export type EagleProfilerEnrollResult = {
  feedback: EagleProfilerEnrollFeedback;
  percentage: number;
};

export type EagleProfilerWorkerInitRequest = {
  command: 'init';
  accessKey: string;
  modelPath: string;
  wasm: string;
  wasmSimd: string;
};

export type EagleProfilerWorkerEnrollRequest = {
  command: 'enroll';
  inputFrame: Int16Array;
};

export type EagleProfilerWorkerExportRequest = {
  command: 'export';
};

export type EagleProfilerWorkerResetRequest = {
  command: 'reset';
};

export type EagleProfilerWorkerReleaseRequest = {
  command: 'release';
};

export type EagleProfilerWorkerRequest =
  | EagleProfilerWorkerInitRequest
  | EagleProfilerWorkerEnrollRequest
  | EagleProfilerWorkerExportRequest
  | EagleProfilerWorkerResetRequest
  | EagleProfilerWorkerReleaseRequest;

export type EagleProfilerWorkerFailureResponse = {
  command: 'failed' | 'error';
  message: string;
};

export type EagleProfilerWorkerInitResponse =
  | EagleProfilerWorkerFailureResponse
  | {
      command: 'ok';
      minEnrollSamples: number;
      sampleRate: number;
      version: string;
    };

export type EagleProfilerWorkerEnrollResponse =
  | EagleProfilerWorkerFailureResponse
  | {
      command: 'ok';
      result: EagleProfilerEnrollResult;
    };

export type EagleProfilerWorkerExportResponse =
  | EagleProfilerWorkerFailureResponse
  | {
      command: 'ok';
      profile: Uint8Array;
    };

export type EagleProfilerWorkerResetResponse =
  | EagleProfilerWorkerFailureResponse
  | {
      command: 'ok';
    };

export type EagleProfilerWorkerReleaseResponse =
  | EagleProfilerWorkerFailureResponse
  | {
      command: 'ok';
    };

export type EagleProfilerWorkerResponse =
  | EagleProfilerWorkerInitResponse
  | EagleProfilerWorkerEnrollResponse
  | EagleProfilerWorkerExportResponse
  | EagleProfilerWorkerResetResponse
  | EagleProfilerWorkerReleaseResponse;
