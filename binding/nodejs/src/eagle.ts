//
// Copyright 2024-2025 Picovoice Inc.
//
// You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
// file accompanying this source.
//
// Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
// an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//

import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';

import PvStatus from './pv_status_t';

import {
  EagleInvalidArgumentError,
  EagleInvalidStateError,
  pvStatusToException,
} from './errors';

import {
  EagleInputOptions,
  EagleOptions,
  EagleProfilerOptions,
  EnrollProgress
} from './types';

import { getSystemLibraryPath } from './platforms';

const DEFAULT_MODEL_PATH = '../lib/common/eagle_params.pv';

type EagleProfilerAndStatus = { profiler: any; status: PvStatus };
type EnrollStatus = EnrollProgress & {
  status: PvStatus;
};
type ExportStatus = {
  speaker_profile: Uint8Array;
  status: PvStatus;
};
type EagleHandleAndStatus = { handle: any; status: PvStatus };
type ProcessStatus = {
  scores: number[];
  status: PvStatus;
};
type EagleHardwareDevicesResult = {
  hardware_devices: string[];
  status: PvStatus;
};

/**
 * Node.js binding for Eagle speaker recognition engine
 *
 * Performs the calls to the Eagle node library. Does some basic parameter validation to prevent
 * errors occurring in the library layer. Provides clearer error messages in native JavaScript.
 */
export class EagleProfiler {
  private _pvEagle: any;
  private _profiler: any;

  private readonly _version: string;
  private readonly _sampleRate: number;
  private readonly _frameLength: number;

  /**
   * Creates an instance of Eagle Profiler.
   * @param {string} accessKey AccessKey obtained from Picovoice Console (https://console.picovoice.ai/).
   * @param options Optional configuration arguments.
   * @param {string} options.modelPath Path to the Eagle model (.pv extension)
   * @param {string} options.device String representation of the device (e.g., CPU or GPU) to use for inference.
   * If set to `best`, the most suitable device is selected automatically. If set to `gpu`, the engine uses the
   * first available GPU device. To select a specific GPU device, set this argument to `gpu:${GPU_INDEX}`, where
   * `${GPU_INDEX}` is the index of the target GPU. If set to `cpu`, the engine will run on the CPU with the
   * default number of threads. To specify the number of threads, set this argument to `cpu:${NUM_THREADS}`,
   * where `${NUM_THREADS}` is the desired number of threads.
   * @param {number} options.minEnrollmentChunks Minimum number of chunks to be processed before enroll returns 100%. The value should be
   * a number greater than or equal to 1. A higher number results in more accurate profiles at the cost of needing more
   * data to create the profile.
   * @param {number} options.voiceThreshold Sensitivity threshold for detecting voice. The value should be a number within [0, 1]. A
   * higher threshold increases detection confidence values at the cost of potentially missing frames of voice.
   * @param {string} options.libraryPath Path to the Eagle library (.node extension)
   */
  constructor(accessKey: string, options: EagleProfilerOptions = {}) {
    assert(typeof accessKey === 'string');
    if (
      accessKey === null ||
      accessKey === undefined ||
      accessKey.length === 0
    ) {
      throw new EagleInvalidArgumentError(`No AccessKey provided to Eagle Profiler`);
    }

    const {
      modelPath = path.resolve(__dirname, DEFAULT_MODEL_PATH),
      device = 'best',
      minEnrollmentChunks = 1,
      voiceThreshold = 0.3,
      libraryPath = getSystemLibraryPath(),
    } = options;

    if (!fs.existsSync(libraryPath)) {
      throw new EagleInvalidArgumentError(
        `File not found at 'libraryPath': ${libraryPath}`
      );
    }

    if (!fs.existsSync(modelPath)) {
      throw new EagleInvalidArgumentError(
        `File not found at 'modelPath': ${modelPath}`
      );
    }

    const pvEagle = require(libraryPath); // eslint-disable-line
    this._pvEagle = pvEagle;

    let eagleProfilerAndStatus: EagleProfilerAndStatus | null = null;
    try {
      pvEagle.set_sdk('nodejs');

      eagleProfilerAndStatus = pvEagle.profiler_init(
        accessKey,
        modelPath,
        device,
        minEnrollmentChunks,
        voiceThreshold);
    } catch (err: any) {
      pvStatusToException(PvStatus[err.code as keyof typeof PvStatus], err);
    }

    const status = eagleProfilerAndStatus!.status;
    if (status !== PvStatus.SUCCESS) {
      this.handlePvStatus(status, 'Eagle Profiler failed to initialize');
    }

    this._profiler = eagleProfilerAndStatus!.profiler;
    this._version = pvEagle.version();
    this._sampleRate = pvEagle.sample_rate();
    this._frameLength = pvEagle.profiler_frame_length();
  }

  /**
   * @returns the version of the Eagle engine
   */
  get version(): string {
    return this._version;
  }

  /**
   * @returns the audio sampling rate accepted by the enroll function
   * @see {@link enroll}
   */
  get sampleRate(): number {
    return this._sampleRate;
  }

  /**
   * @returns number of audio samples per frame (i.e. the length of the array provided to the enroll function)
   * @see {@link enroll}
   */
  get frameLength(): number {
    return this._frameLength;
  }

  /**
   * Enrolls a speaker. This function should be called multiple times with different utterances of the same speaker
   * until `percentage` reaches `100.0`, at which point a speaker voice profile can be exported using `.export()`.
   * Any further enrollment can be used to improve the speaker profile. The minimum length of the input pcm to
   * `.enroll()` can be obtained by calling `.minEnrollSamples`.
   * The audio data used for enrollment should satisfy the following requirements:
   *    - only one speaker should be present in the audio
   *    - the speaker should be speaking in a normal voice
   *    - the audio should contain no speech from other speakers and no other sounds (e.g. music)
   *    - it should be captured in a quiet environment with no background noise
   * @param {Int16Array} pcm Audio data for enrollment. The audio needs to have a sample rate equal to `.sampleRate` and be
   * 16-bit linearly-encoded. EagleProfiler operates on single-channel audio.
   * @return {number} The percentage of completeness of the speaker enrollment process
   */
  enroll(pcm: Int16Array): number {
    assert(pcm instanceof Int16Array);

    if (
      this._profiler === 0 ||
      this._profiler === null ||
      this._profiler === undefined
    ) {
      throw new EagleInvalidStateError('Eagle Profiler is not initialized');
    }

    if (pcm === undefined || pcm === null) {
      throw new EagleInvalidArgumentError(
        `PCM array provided to 'Eagle.enroll()' is undefined or null`
      );
    } else if (pcm.length != this.frameLength) {
      throw new EagleInvalidArgumentError(
        `PCM size (${pcm.length}) must be equal to 'EagleProfiler.frameLength' (${this.frameLength})`
      );
    }

    let enrollStatus: EnrollStatus | null = null;
    try {
      enrollStatus = this._pvEagle.profiler_enroll(this._profiler, pcm, pcm.length);
    } catch (err: any) {
      pvStatusToException(PvStatus[err.code as keyof typeof PvStatus], err);
    }

    const status = enrollStatus!.status;
    if (status !== PvStatus.SUCCESS) {
      this.handlePvStatus(status, 'Eagle Profiler failed to process the audio frame');
    }

    return enrollStatus!.percentage;
  }

  /**
   * Marks the end of the audio stream, flushes internal state of the object, and returns the percentage of enrollment
   * completed.
   * @return {number} The percentage of completeness of the speaker enrollment process
   */
  flush(): number {
    if (
      this._profiler === 0 ||
      this._profiler === null ||
      this._profiler === undefined
    ) {
      throw new EagleInvalidStateError('Eagle Profiler is not initialized');
    }

    let enrollStatus: EnrollStatus | null = null;
    try {
      enrollStatus = this._pvEagle.profiler_flush(this._profiler);
    } catch (err: any) {
      pvStatusToException(PvStatus[err.code as keyof typeof PvStatus], err);
    }

    const status = enrollStatus!.status;
    if (status !== PvStatus.SUCCESS) {
      this.handlePvStatus(status, 'Eagle Profiler failed to process the audio frame');
    }

    return enrollStatus!.percentage;
  }

  /**
   * Exports the speaker profile of the current session.
   * Will throw error if the profile is not ready.
   *
   * @return {Uint8Array} An EagleProfile object.
   */
  export(): Uint8Array {
    if (
      this._profiler === 0 ||
      this._profiler === null ||
      this._profiler === undefined
    ) {
      throw new EagleInvalidStateError('Eagle Profiler is not initialized');
    }

    let exportStatus: ExportStatus | null = null;
    try {
      exportStatus = this._pvEagle.profiler_export(this._profiler);
    } catch (err: any) {
      pvStatusToException(PvStatus[err.code as keyof typeof PvStatus], err);
    }

    const status = exportStatus!.status;
    if (status !== PvStatus.SUCCESS) {
      this.handlePvStatus(status, 'Eagle failed to export the speaker profile');
    }

    return exportStatus!.speaker_profile;
  }

  /**
   * Resets the internal state of Eagle Profiler.
   * It should be called before starting a new enrollment session.
   */
  reset(): void {
    if (
      this._profiler === 0 ||
      this._profiler === null ||
      this._profiler === undefined
    ) {
      throw new EagleInvalidStateError('Eagle Profiler is not initialized');
    }

    let status: number | null = null;
    try {
      status = this._pvEagle.profiler_reset(this._profiler);
    } catch (err: any) {
      pvStatusToException(<PvStatus>err.code, err);
    }

    if (status && status !== PvStatus.SUCCESS) {
      this.handlePvStatus(status, "Eagle Profiler failed to reset");
    }
  }

  /**
   * Releases the resources acquired by Eagle.
   *
   * Be sure to call this when finished with the instance
   * to reclaim the memory that was allocated by the C library.
   */
  release(): void {
    if (this._profiler !== 0) {
      try {
        this._pvEagle.profiler_delete(this._profiler);
      } catch (err: any) {
        pvStatusToException(<PvStatus>err.code, err);
      }
      this._profiler = 0;
    }
  }

  private handlePvStatus(status: PvStatus, message: string): void {
    const errorObject = this._pvEagle.get_error_stack();
    if (errorObject.status === PvStatus.SUCCESS) {
      pvStatusToException(status, message, errorObject.message_stack);
    } else {
      pvStatusToException(status, 'Unable to get Eagle Profiler error state');
    }
  }
}

export class Eagle {
  private _pvEagle: any;
  private _handle: any;

  private readonly _version: string;
  private readonly _sampleRate: number;
  private readonly _minProcessSamples: number;

  /**
   * Creates an instance of Eagle.
   * @param {string} accessKey AccessKey obtained from Picovoice Console (https://console.picovoice.ai/).
   * @param options Optional configuration arguments.
   * @param {string} options.modelPath The path to the Eagle model (.pv extension)
   * @param {string} options.device String representation of the device (e.g., CPU or GPU) to use for inference.
   * If set to `best`, the most suitable device is selected automatically. If set to `gpu`, the engine uses the
   * first available GPU device. To select a specific GPU device, set this argument to `gpu:${GPU_INDEX}`, where
   * `${GPU_INDEX}` is the index of the target GPU. If set to `cpu`, the engine will run on the CPU with the
   * default number of threads. To specify the number of threads, set this argument to `cpu:${NUM_THREADS}`,
   * where `${NUM_THREADS}` is the desired number of threads.
   * @param {number} options.voiceThreshold Sensitivity threshold for detecting voice. The value should be a number within [0, 1]. A
   * higher threshold increases detection confidence values at the cost of potentially missing frames of voice.
   * @param {string} options.libraryPath The path to the Eagle library (.node extension)
   */
  constructor(
    accessKey: string,
    options: EagleOptions = {}) {
    assert(typeof accessKey === 'string');
    if (
      accessKey === null ||
      accessKey === undefined ||
      accessKey.length === 0
    ) {
      throw new EagleInvalidArgumentError(`No AccessKey provided to Eagle`);
    }

    const {
      modelPath = path.resolve(__dirname, DEFAULT_MODEL_PATH),
      device = 'best',
      voiceThreshold = 0.3,
      libraryPath = getSystemLibraryPath(),
    } = options;

    if (!fs.existsSync(libraryPath)) {
      throw new EagleInvalidArgumentError(
        `File not found at 'libraryPath': ${libraryPath}`
      );
    }

    if (!fs.existsSync(modelPath)) {
      throw new EagleInvalidArgumentError(
        `File not found at 'modelPath': ${modelPath}`
      );
    }

    const pvEagle = require(libraryPath); // eslint-disable-line
    this._pvEagle = pvEagle;

    let eagleHandleAndStatus: EagleHandleAndStatus | null = null;
    try {
      pvEagle.set_sdk('nodejs');

      eagleHandleAndStatus = pvEagle.init(
        accessKey,
        modelPath,
        device,
        voiceThreshold
      );
    } catch (err: any) {
      pvStatusToException(PvStatus[err.code as keyof typeof PvStatus], err);
    }

    const status = eagleHandleAndStatus!.status;
    if (status !== PvStatus.SUCCESS) {
      this.handlePvStatus(status, 'Eagle failed to initialize');
    }

    this._handle = eagleHandleAndStatus!.handle;
    this._version = pvEagle.version();
    this._sampleRate = pvEagle.sample_rate();
    this._minProcessSamples = pvEagle.process_min_audio_length_samples(this._handle).num_samples;
  }

  /**
   * @returns the version of the Eagle engine
   */
  get version(): string {
    return this._version;
  }

  /**
   * @returns the audio sampling rate accepted by the process function
   * @see {@link process}
   */
  get sampleRate(): number {
    return this._sampleRate;
  }

  /**
   * @returns the minimum number of samples required by the process function
   * @see {@link process}
   */
  get minProcessSamples(): number {
    return this._minProcessSamples;
  }

  /**
   * Processes a chunk of audio and returns a list of similarity scores for each speaker profile or null.
   *
   * @param {Int16Array} pcm An array of audio samples. The minimum number of samples can be attained by calling
   * `.minProcessSamples`. The incoming audio needs to have a sample rate equal to `.sampleRate` and be 16-bit
   * linearly-encoded. Eagle operates on single-channel audio.
   * @param speakerProfiles One or more Eagle speaker profiles. These can be constructed using `EagleProfiler`.
   *
   * @return {number[] | null} A list of similarity scores for each speaker profile. A higher score indicates that the
   * voice belongs to the corresponding speaker. The range is [0, 1] with 1.0 representing a perfect match. A result of
   * null indicated that there was not enough voice in the audio to detect a speaker.
   */
  process(pcm: Int16Array, speakerProfiles: Uint8Array[] | Uint8Array): number[] {
    assert(pcm instanceof Int16Array);

    if (
      this._handle === 0 ||
      this._handle === null ||
      this._handle === undefined
    ) {
      throw new EagleInvalidStateError('Eagle is not initialized');
    }

    if (pcm === undefined || pcm === null) {
      throw new EagleInvalidArgumentError(
        `PCM array provided to 'Eagle.process()' is undefined or null`
      );
    } else if (pcm.length < this.minProcessSamples) {
      throw new EagleInvalidArgumentError(
        `PCM size (${pcm.length}) must be greater than 'Eagle.minProcessSamples' (${this.minProcessSamples})`
      );
    }

    let processStatus: ProcessStatus | null = null;
    try {
      processStatus = this._pvEagle.process(
        this._handle,
        pcm,
        !Array.isArray(speakerProfiles) ? [speakerProfiles] : speakerProfiles);
    } catch (err: any) {
      pvStatusToException(PvStatus[err.code as keyof typeof PvStatus], err);
    }

    const status = processStatus!.status;
    if (status !== PvStatus.SUCCESS) {
      this.handlePvStatus(status, 'Eagle failed to process the audio frame');
    }

    return processStatus!.scores;
  }

  /**
   * Releases the resources acquired by Eagle.
   *
   * Be sure to call this when finished with the instance
   * to reclaim the memory that was allocated by the C library.
   */
  release(): void {
    if (this._handle !== 0) {
      try {
        this._pvEagle.delete(this._handle);
      } catch (err: any) {
        pvStatusToException(<PvStatus>err.code, err);
      }
      this._handle = 0;
    }
  }

  /**
   * Lists all available devices that Eagle can use for inference. Each entry in the list can be the `device` argument
   * of the constructor.
   *
   * @returns List of all available devices that Eagle can use for inference.
   */
  static listAvailableDevices(options: EagleInputOptions = {}): string[] {
    const {
      libraryPath = getSystemLibraryPath(),
    } = options;

    const pvEagle = require(libraryPath); // eslint-disable-line

    let eagleHardwareDevicesResult: EagleHardwareDevicesResult | null = null;
    try {
      eagleHardwareDevicesResult = pvEagle.list_hardware_devices();
    } catch (err: any) {
      pvStatusToException(<PvStatus>err.code, err);
    }

    const status = eagleHardwareDevicesResult!.status;
    if (status !== PvStatus.SUCCESS) {
      const errorObject = pvEagle.get_error_stack();
      if (errorObject.status === PvStatus.SUCCESS) {
        pvStatusToException(status, 'Eagle failed to get available devices', errorObject.message_stack);
      } else {
        pvStatusToException(status, 'Unable to get Eagle error state');
      }
    }

    return eagleHardwareDevicesResult!.hardware_devices;
  }

  private handlePvStatus(status: PvStatus, message: string): void {
    const errorObject = this._pvEagle.get_error_stack();
    if (errorObject.status === PvStatus.SUCCESS) {
      pvStatusToException(status, message, errorObject.message_stack);
    } else {
      pvStatusToException(status, 'Unable to get Eagle error state');
    }
  }
}
