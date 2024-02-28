/*
  Copyright 2024 Picovoice Inc.
  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.
  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

export enum EagleProfilerEnrollFeedback {
  NONE = "NONE",
  AUDIO_TOO_SHORT = "AUDIO_TOO_SHORT",
  UNKNOWN_SPEAKER = "UNKNOWN_SPEAKER",
  NO_VOICE_FOUND = "NO_VOICE_FOUND",
  QUALITY_ISSUE = "QUALITY_ISSUE",
}

export type EnrollProgress = {
  percentage: number;
  feedback: EagleProfilerEnrollFeedback;
};

export type EagleOptions = {
  modelPath?: string;
  libraryPath?: string;
};
