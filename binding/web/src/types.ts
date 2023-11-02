/*
  Copyright 2023 Picovoice Inc.

  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.

  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

import { PvModel } from '@picovoice/web-utils';

export enum PvStatus {
  SUCCESS = 10000,
  OUT_OF_MEMORY,
  IO_ERROR,
  INVALID_ARGUMENT,
  STOP_ITERATION,
  KEY_ERROR,
  INVALID_STATE,
  RUNTIME_ERROR,
  ACTIVATION_ERROR,
  ACTIVATION_LIMIT_REACHED,
  ACTIVATION_THROTTLED,
  ACTIVATION_REFUSED,
}

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

export type EagleProfile = {
  /** Buffer containing the speaker profile. */
  bytes: Uint8Array;
};

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
  sdk: string;
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
  status: PvStatus;
  shortMessage: string;
  messageStack: string[];
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
      profile: EagleProfile;
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

export type EagleWorkerInitRequest = {
  command: 'init';
  accessKey: string;
  modelPath: string;
  speakerProfiles: EagleProfile[];
  wasm: string;
  wasmSimd: string;
  sdk: string;
};

export type EagleWorkerProcessRequest = {
  command: 'process';
  inputFrame: Int16Array;
};

export type EagleWorkerResetRequest = {
  command: 'reset';
};

export type EagleWorkerReleaseRequest = {
  command: 'release';
};

export type EagleWorkerRequest =
  | EagleWorkerInitRequest
  | EagleWorkerProcessRequest
  | EagleWorkerResetRequest
  | EagleWorkerReleaseRequest;

export type EagleWorkerFailureResponse = {
  command: 'failed' | 'error';
  status: PvStatus;
  shortMessage: string;
  messageStack: string[];
};

export type EagleWorkerInitResponse =
  | EagleWorkerFailureResponse
  | {
      command: 'ok';
      frameLength: number;
      sampleRate: number;
      version: string;
    };

export type EagleWorkerProcessResponse =
  | EagleWorkerFailureResponse
  | {
      command: 'ok';
      scores: number[];
    };

export type EagleWorkerResetResponse =
  | EagleWorkerFailureResponse
  | {
      command: 'ok';
    };

export type EagleWorkerReleaseResponse =
  | EagleWorkerFailureResponse
  | {
      command: 'ok';
    };

export type EagleWorkerResponse =
  | EagleWorkerInitResponse
  | EagleWorkerProcessResponse
  | EagleWorkerResetResponse
  | EagleWorkerReleaseResponse;
