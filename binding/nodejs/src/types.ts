/*
  Copyright 2024 Picovoice Inc.
  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.
  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

import PvStatus from './pv_status_t';

export type EagleOptions = {
  modelPath?: string;
  libraryPath?: string;
};

export enum EagleProfilerEnrollFeedback {
  NONE = 0,
  AUDIO_TOO_SHORT,
  UNKNOWN_SPEAKER,
  NO_VOICE_FOUND,
  QUALITY_ISSUE,
}

export type EagleProfilerAndStatus = { profiler: any; status: PvStatus };

export type EnrollProgress = {
  percentage: number;
  feedback: EagleProfilerEnrollFeedback;
};

export type EagleProfile = Uint8Array;

export type EnrollStatus = EnrollProgress & {
  status: PvStatus;
};

export type ExportStatus = {
  speaker_profile: Uint8Array;
  status: PvStatus;
};

export type EagleHandleAndStatus = { handle: any; status: PvStatus };

export type ProcessResult = number[];

export type ProcessStatus = {
  scores: ProcessResult;
  status: PvStatus;
};
