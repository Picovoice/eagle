/*
  Copyright 2024-2025 Picovoice Inc.
  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.
  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

export type EnrollProgress = {
  percentage: number;
};

export type EagleInitOptions = {
  modelPath?: string;
  device?: string;
  voiceThreshold?: number;
};

export type EagleProfilerInitOptions = {
  modelPath?: string;
  device?: string;
  minEnrollmentChunks?: number;
  voiceThreshold?: number;
};

export type EagleInputOptions = {
  libraryPath?: string;
};

export type EagleOptions = EagleInitOptions & EagleInputOptions;
export type EagleProfilerOptions = EagleProfilerInitOptions & EagleInputOptions;
