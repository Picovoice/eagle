/*
  Copyright 2023 Picovoice Inc.

  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.

  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

/* eslint camelcase: 0 */

import { Mutex } from 'async-mutex';

import {
  aligned_alloc_type,
  pv_free_type,
  buildWasm,
  arrayBufferToStringAtIndex,
  isAccessKeyValid,
  loadModel,
  PvError,
} from '@picovoice/web-utils';

import { simd } from 'wasm-feature-detect';

import { EagleModel, EagleProfilerEnrollResult } from './types';

/**
 * WebAssembly function types
 */
type pv_eagle_profiler_init_type = (
  accessKey: number,
  modelPath: number,
  object: number
) => Promise<number>;
type pv_eagle_profiler_delete_type = (object: number) => Promise<void>;
type pv_eagle_profiler_enroll_type = (
  object: number,
  pcm: number,
  numSamples: number,
  feedback: number,
  percentage: number
) => Promise<number>;
type pv_eagle_profiler_enroll_min_audio_length_samples_type = (
  object: number,
  numSamples: number
) => Promise<number>;
type pv_eagle_profiler_export_type = (
  object: number,
  speakerProfile: number
) => Promise<number>;
type pv_eagle_profiler_export_size_type = (
  object: number,
  speakerProfileSizeBytes: number
) => Promise<number>;
type pv_eagle_profiler_reset_type = (object: number) => Promise<number>;
type pv_eagle_init_type = (
  accessKey: number,
  modelPath: number,
  numSpeakers: number,
  speakerProfiles: number,
  object: number
) => Promise<number>;
type pv_eagle_delete_type = (object: number) => Promise<void>;
type pv_eagle_process_type = (
  object: number,
  pcm: number,
  scores: number
) => Promise<number>;
type pv_eagle_reset_type = (object: number) => Promise<number>;
type pv_eagle_frame_length_type = () => Promise<number>;
type pv_eagle_version_type = () => Promise<number>;
type pv_sample_rate_type = () => Promise<number>;
type pv_status_to_string_type = (status: number) => Promise<number>;

type EagleBaseWasmOutput = {
  memory: WebAssembly.Memory;
  alignedAlloc: aligned_alloc_type;
  pvFree: pv_free_type;
  pvError: PvError;

  sampleRate: number;
  version: string;

  pvStatusToString: pv_status_to_string_type;
  exports: any;
};

type EagleProfilerWasmOutput = EagleBaseWasmOutput & {
  minEnrollSamples: number;
  profileSize: number;

  objectAddress: number;

  pvEagleProfilerDelete: pv_eagle_profiler_delete_type;
  pvEagleProfilerEnroll: pv_eagle_profiler_enroll_type;
  pvEagleProfilerExport: pv_eagle_profiler_export_type;
  pvEagleProfilerReset: pv_eagle_profiler_reset_type;
};

type EagleWasmOutput = EagleBaseWasmOutput & {
  frameLength: number;
  numSpeakers: number;

  objectAddress: number;
  scoresAddress: number;

  pvEagleDelete: pv_eagle_delete_type;
  pvEagleProcess: pv_eagle_process_type;
  pvEagleReset: pv_eagle_profiler_reset_type;
};

const PV_STATUS_SUCCESS = 10000;
const MAX_PCM_LENGTH_SEC = 60 * 15;

class EagleBase {
  protected readonly _pvStatusToString: pv_status_to_string_type;
  protected _wasmMemory: WebAssembly.Memory | undefined;
  protected readonly _alignedAlloc: CallableFunction;
  protected readonly _pvFree: pv_free_type;
  protected readonly _memoryBuffer: Int16Array;
  protected readonly _memoryBufferUint8: Uint8Array;
  protected readonly _memoryBufferView: DataView;
  protected readonly _functionMutex: Mutex;

  protected static _sampleRate: number;
  protected static _version: string;

  protected static _wasm: string;
  protected static _wasmSimd: string;

  protected static _eagleMutex = new Mutex();

  protected readonly _pvError: PvError;

  protected constructor(handleWasm: EagleBaseWasmOutput) {
    EagleBase._sampleRate = handleWasm.sampleRate;
    EagleBase._version = handleWasm.version;

    this._pvStatusToString = handleWasm.pvStatusToString;

    this._wasmMemory = handleWasm.memory;
    this._alignedAlloc = handleWasm.alignedAlloc;
    this._pvFree = handleWasm.pvFree;
    this._pvError = handleWasm.pvError;

    this._memoryBuffer = new Int16Array(handleWasm.memory.buffer);
    this._memoryBufferUint8 = new Uint8Array(handleWasm.memory.buffer);
    this._memoryBufferView = new DataView(handleWasm.memory.buffer);

    this._functionMutex = new Mutex();
  }

  /**
   * Audio sample rate required by Eagle.
   */
  get sampleRate(): number {
    return EagleBase._sampleRate;
  }

  /**
   * Version of Eagle.
   */
  get version(): string {
    return EagleBase._version;
  }

  /**
   * Set base64 wasm file.
   * @param wasm Base64'd wasm file to use to initialize wasm.
   */
  public static setWasm(wasm: string): void {
    if (this._wasm === undefined) {
      this._wasm = wasm;
    }
  }

  /**
   * Set base64 wasm file with SIMD feature.
   * @param wasmSimd Base64'd wasm file to use to initialize wasm.
   */
  public static setWasmSimd(wasmSimd: string): void {
    if (this._wasmSimd === undefined) {
      this._wasmSimd = wasmSimd;
    }
  }

  protected static async _initBaseWasm(
    wasmBase64: string,
    wasmMemorySize: number
  ): Promise<EagleBaseWasmOutput> {
    // A WebAssembly page has a constant size of 64KiB. -> 1MiB ~= 16 pages
    const memory = new WebAssembly.Memory({ initial: wasmMemorySize });
    const memoryBufferUint8 = new Uint8Array(memory.buffer);
    const pvError = new PvError();
    const exports = await buildWasm(memory, wasmBase64, pvError);

    const aligned_alloc = exports.aligned_alloc as aligned_alloc_type;
    const pv_free = exports.pv_free as pv_free_type;
    const pv_eagle_version = exports.pv_eagle_version as pv_eagle_version_type;
    const pv_sample_rate = exports.pv_sample_rate as pv_sample_rate_type;
    const pv_status_to_string =
      exports.pv_status_to_string as pv_status_to_string_type;

    const sampleRate = await pv_sample_rate();
    const versionAddress = await pv_eagle_version();
    const version = arrayBufferToStringAtIndex(
      memoryBufferUint8,
      versionAddress
    );

    return {
      memory: memory,
      alignedAlloc: aligned_alloc,
      pvFree: pv_free,
      pvError: pvError,

      sampleRate: sampleRate,
      version: version,

      pvStatusToString: pv_status_to_string,
      exports: exports,
    };
  }
}

/**
 * JavaScript/WebAssembly binding for the profiler of the Eagle Speaker Recognition engine.
 * It enrolls a speaker given a set of utterances and then constructs a profile for the enrolled speaker.
 */
export class EagleProfiler extends EagleBase {
  private readonly _pvEagleProfilerDelete: pv_eagle_profiler_delete_type;
  private readonly _pvEagleProfilerEnroll: pv_eagle_profiler_enroll_type;
  private readonly _pvEagleProfilerExport: pv_eagle_profiler_export_type;
  private readonly _pvEagleProfilerReset: pv_eagle_profiler_reset_type;

  private readonly _objectAddress: number;

  private static _maxEnrollSamples: number;
  private static _minEnrollSamples: number;
  private static _profileSize: number;

  private constructor(handleWasm: EagleProfilerWasmOutput) {
    super(handleWasm);

    EagleProfiler._minEnrollSamples = handleWasm.minEnrollSamples;
    EagleProfiler._profileSize = handleWasm.profileSize;
    EagleProfiler._maxEnrollSamples =
      MAX_PCM_LENGTH_SEC * EagleProfiler._sampleRate;

    this._pvEagleProfilerDelete = handleWasm.pvEagleProfilerDelete;
    this._pvEagleProfilerEnroll = handleWasm.pvEagleProfilerEnroll;
    this._pvEagleProfilerExport = handleWasm.pvEagleProfilerExport;
    this._pvEagleProfilerReset = handleWasm.pvEagleProfilerReset;

    this._objectAddress = handleWasm.objectAddress;
  }

  /**
   * The minimum length of the input pcm required by `.enroll()`.
   */
  get minEnrollSamples(): number {
    return EagleProfiler._minEnrollSamples;
  }

  /**
   * Creates an instance of profiler component of the Eagle Speaker Recognition Engine.
   *
   * @param accessKey AccessKey obtained from Picovoice Console (https://console.picovoice.ai/).
   * @param model Eagle model options.
   * @param model.base64 The model in base64 string to initialize Eagle.
   * @param model.publicPath The model path relative to the public directory.
   * @param model.customWritePath Custom path to save the model in storage.
   * Set to a different name to use multiple models across `eagle` instances.
   * @param model.forceWrite Flag to overwrite the model in storage even if it exists.
   * @param model.version Version of the model file. Increment to update the model file in storage.
   *
   * @return An instance of the Eagle Profiler.
   */
  public static async create(
    accessKey: string,
    model: EagleModel
  ): Promise<EagleProfiler> {
    const customWritePath = model.customWritePath
      ? model.customWritePath
      : 'eagle_model';
    const modelPath = await loadModel({ ...model, customWritePath });

    return EagleProfiler._init(accessKey, modelPath);
  }

  public static async _init(
    accessKey: string,
    modelPath: string
  ): Promise<EagleProfiler> {
    if (!isAccessKeyValid(accessKey)) {
      throw new Error('Invalid AccessKey');
    }

    return new Promise<EagleProfiler>((resolve, reject) => {
      EagleProfiler._eagleMutex
        .runExclusive(async () => {
          const isSimd = await simd();
          const wasmOutput = await EagleProfiler._initProfilerWasm(
            accessKey,
            modelPath,
            isSimd ? this._wasmSimd : this._wasm
          );
          return new EagleProfiler(wasmOutput);
        })
        .then((result: EagleProfiler) => {
          resolve(result);
        })
        .catch((error: any) => {
          reject(error);
        });
    });
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
   * @param pcm Audio data for enrollment. The audio needs to have a sample rate equal to `.sampleRate` and be
   * 16-bit linearly-encoded. EagleProfiler operates on single-channel audio.
   *
   * @return The percentage of completeness of the speaker enrollment process along with the feedback code
   * corresponding to the last enrollment attempt:
   *    - `AUDIO_OK`: The audio is good for enrollment.
   *    - `AUDIO_TOO_SHORT`: Audio length is insufficient for enrollment,
   *       i.e. it is shorter than`.min_enroll_samples`.
   *    - `UNKNOWN_SPEAKER`: There is another speaker in the audio that is different from the speaker
   *       being enrolled. Too much background noise may cause this error as well.
   *    - `NO_VOICE_FOUND`: The audio does not contain any voice, i.e. it is silent or
   *       has a low signal-to-noise ratio.
   *    - `QUALITY_ISSUE`: The audio quality is too low for enrollment due to a bad microphone
   *       or recording environment.
   */
  public async enroll(pcm: Int16Array): Promise<EagleProfilerEnrollResult> {
    if (!(pcm instanceof Int16Array)) {
      throw new Error("The argument 'pcm' must be provided as an Int16Array");
    }

    if (pcm.length > EagleProfiler._maxEnrollSamples) {
      throw new Error(
        `'pcm' size must be smaller than ${EagleProfiler._maxEnrollSamples}`
      );
    }

    return new Promise<EagleProfilerEnrollResult>((resolve, reject) => {
      this._functionMutex
        .runExclusive(async () => {
          if (this._wasmMemory === undefined) {
            throw new Error('Attempted to call `.enroll()` after release');
          }

          const pcmAddress = await this._alignedAlloc(
            Int16Array.BYTES_PER_ELEMENT,
            pcm.length * Int16Array.BYTES_PER_ELEMENT
          );

          const memoryBufferInt16 = new Int16Array(this._wasmMemory.buffer);
          memoryBufferInt16.set(pcm, pcmAddress / Int16Array.BYTES_PER_ELEMENT);

          const feedbackAddress = await this._alignedAlloc(
            Int32Array.BYTES_PER_ELEMENT,
            Int32Array.BYTES_PER_ELEMENT
          );
          if (feedbackAddress === 0) {
            throw new Error('malloc failed: Cannot allocate memory');
          }
          const percentageAddress = await this._alignedAlloc(
            Int32Array.BYTES_PER_ELEMENT,
            Int32Array.BYTES_PER_ELEMENT
          );
          if (percentageAddress === 0) {
            throw new Error('malloc failed: Cannot allocate memory');
          }

          const status = await this._pvEagleProfilerEnroll(
            this._objectAddress,
            pcmAddress,
            pcm.length,
            feedbackAddress,
            percentageAddress
          );
          await this._pvFree(pcmAddress);
          if (status !== PV_STATUS_SUCCESS) {
            await this._pvFree(feedbackAddress);
            await this._pvFree(percentageAddress);

            throw new Error(
              `enroll failed with status ${arrayBufferToStringAtIndex(
                this._memoryBufferUint8,
                await this._pvStatusToString(status)
              )}`
            );
          }

          const feedback = this._memoryBufferView.getInt32(
            feedbackAddress,
            true
          );
          await this._pvFree(feedbackAddress);

          const percentage = this._memoryBufferView.getFloat32(
            percentageAddress,
            true
          );
          await this._pvFree(percentageAddress);

          return { feedback, percentage };
        })
        .then((result: EagleProfilerEnrollResult) => {
          resolve(result);
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  }

  /**
   * Exports the speaker profile of the current session.
   * Will throw error if the profile is not ready.
   *
   * @return A byte array containing the speaker profile.
   */
  public async export(): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
      this._functionMutex
        .runExclusive(async () => {
          if (this._wasmMemory === undefined) {
            throw new Error('Attempted to call `.export()` after release');
          }

          const profileAddress = await this._alignedAlloc(
            Uint8Array.BYTES_PER_ELEMENT,
            Uint8Array.BYTES_PER_ELEMENT * EagleProfiler._profileSize
          );

          const status = await this._pvEagleProfilerExport(
            this._objectAddress,
            profileAddress
          );
          if (status !== PV_STATUS_SUCCESS) {
            await this._pvFree(profileAddress);
            throw new Error(
              `export failed with status ${arrayBufferToStringAtIndex(
                this._memoryBufferUint8,
                await this._pvStatusToString(status)
              )}`
            );
          }

          const profile = this._memoryBufferUint8.slice(
            profileAddress / Uint8Array.BYTES_PER_ELEMENT,
            profileAddress / Uint8Array.BYTES_PER_ELEMENT +
              EagleProfiler._profileSize
          );
          await this._pvFree(profileAddress);

          return profile;
        })
        .then((result: Uint8Array) => {
          resolve(result);
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  }

  /**
   * Resets the internal state of Eagle Profiler.
   * It should be called before starting a new enrollment session.
   */
  public async reset(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this._functionMutex
        .runExclusive(async () => {
          if (this._wasmMemory === undefined) {
            throw new Error('Attempted to call `.reset()` after release');
          }

          const status = await this._pvEagleProfilerReset(this._objectAddress);
          if (status !== PV_STATUS_SUCCESS) {
            throw new Error(
              `reset failed with status ${arrayBufferToStringAtIndex(
                this._memoryBufferUint8,
                await this._pvStatusToString(status)
              )}`
            );
          }
        })
        .then(() => {
          resolve();
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  }

  /**
   * Releases resources acquired by Eagle Profiler
   */
  public async release(): Promise<void> {
    await this._pvEagleProfilerDelete(this._objectAddress);
    delete this._wasmMemory;
    this._wasmMemory = undefined;
  }

  private static async _initProfilerWasm(
    accessKey: string,
    modelPath: string,
    wasmBase64: string
  ): Promise<EagleProfilerWasmOutput> {
    const baseWasmOutput = await super._initBaseWasm(wasmBase64, 3500);
    const memoryBufferUint8 = new Uint8Array(baseWasmOutput.memory.buffer);

    const pv_eagle_profiler_init = baseWasmOutput.exports
      .pv_eagle_profiler_init as pv_eagle_profiler_init_type;
    const pv_eagle_profiler_delete = baseWasmOutput.exports
      .pv_eagle_profiler_delete as pv_eagle_profiler_delete_type;
    const pv_eagle_profiler_enroll = baseWasmOutput.exports
      .pv_eagle_profiler_enroll as pv_eagle_profiler_enroll_type;
    const pv_eagle_profiler_enroll_min_audio_length_samples = baseWasmOutput
      .exports
      .pv_eagle_profiler_enroll_min_audio_length_samples as pv_eagle_profiler_enroll_min_audio_length_samples_type;
    const pv_eagle_profiler_export = baseWasmOutput.exports
      .pv_eagle_profiler_export as pv_eagle_profiler_export_type;
    const pv_eagle_profiler_export_size = baseWasmOutput.exports
      .pv_eagle_profiler_export_size as pv_eagle_profiler_export_size_type;
    const pv_eagle_profiler_reset = baseWasmOutput.exports
      .pv_eagle_profiler_reset as pv_eagle_profiler_reset_type;

    const objectAddressAddress = await baseWasmOutput.alignedAlloc(
      Int32Array.BYTES_PER_ELEMENT,
      Int32Array.BYTES_PER_ELEMENT
    );
    if (objectAddressAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }

    const accessKeyAddress = await baseWasmOutput.alignedAlloc(
      Uint8Array.BYTES_PER_ELEMENT,
      (accessKey.length + 1) * Uint8Array.BYTES_PER_ELEMENT
    );
    if (accessKeyAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }
    for (let i = 0; i < accessKey.length; i++) {
      memoryBufferUint8[accessKeyAddress + i] = accessKey.charCodeAt(i);
    }
    memoryBufferUint8[accessKeyAddress + accessKey.length] = 0;

    const modelPathEncoded = new TextEncoder().encode(modelPath);
    const modelPathAddress = await baseWasmOutput.alignedAlloc(
      Uint8Array.BYTES_PER_ELEMENT,
      (modelPathEncoded.length + 1) * Uint8Array.BYTES_PER_ELEMENT
    );
    if (modelPathAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }
    memoryBufferUint8.set(modelPathEncoded, modelPathAddress);
    memoryBufferUint8[modelPathAddress + modelPathEncoded.length] = 0;

    let status = await pv_eagle_profiler_init(
      accessKeyAddress,
      modelPathAddress,
      objectAddressAddress
    );
    await baseWasmOutput.pvFree(accessKeyAddress);
    await baseWasmOutput.pvFree(modelPathAddress);
    if (status !== PV_STATUS_SUCCESS) {
      const msg = `'pv_eagle_profiler_init' failed with status ${arrayBufferToStringAtIndex(
        memoryBufferUint8,
        await baseWasmOutput.pvStatusToString(status)
      )}`;

      throw new Error(
        `${msg}\nDetails: ${baseWasmOutput.pvError.getErrorString()}`
      );
    }

    const memoryBufferView = new DataView(baseWasmOutput.memory.buffer);
    const objectAddress = memoryBufferView.getInt32(objectAddressAddress, true);
    await baseWasmOutput.pvFree(objectAddressAddress);

    const minEnrollSamplesAddress = await baseWasmOutput.alignedAlloc(
      Int32Array.BYTES_PER_ELEMENT,
      Int32Array.BYTES_PER_ELEMENT
    );
    if (minEnrollSamplesAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }

    status = await pv_eagle_profiler_enroll_min_audio_length_samples(
      objectAddress,
      minEnrollSamplesAddress
    );
    if (status !== PV_STATUS_SUCCESS) {
      const msg = `'pv_eagle_profiler_enroll_min_audio_length_samples' failed with status ${arrayBufferToStringAtIndex(
        memoryBufferUint8,
        await baseWasmOutput.pvStatusToString(status)
      )}`;
      throw new Error(
        `${msg}\nDetails: ${baseWasmOutput.pvError.getErrorString()}`
      );
    }
    const minEnrollSamples = memoryBufferView.getInt32(
      minEnrollSamplesAddress,
      true
    );
    await baseWasmOutput.pvFree(minEnrollSamplesAddress);

    const profileSizeAddress = await baseWasmOutput.alignedAlloc(
      Int32Array.BYTES_PER_ELEMENT,
      Int32Array.BYTES_PER_ELEMENT
    );
    if (profileSizeAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }

    status = await pv_eagle_profiler_export_size(
      objectAddress,
      profileSizeAddress
    );
    if (status !== PV_STATUS_SUCCESS) {
      const msg = `'pv_eagle_profiler_export_size' failed with status ${arrayBufferToStringAtIndex(
        memoryBufferUint8,
        await baseWasmOutput.pvStatusToString(status)
      )}`;
      throw new Error(
        `${msg}\nDetails: ${baseWasmOutput.pvError.getErrorString()}`
      );
    }

    const profileSize = memoryBufferView.getInt32(profileSizeAddress, true);
    await baseWasmOutput.pvFree(profileSizeAddress);

    return {
      ...baseWasmOutput,
      minEnrollSamples: minEnrollSamples,
      profileSize: profileSize,

      objectAddress: objectAddress,

      pvEagleProfilerDelete: pv_eagle_profiler_delete,
      pvEagleProfilerEnroll: pv_eagle_profiler_enroll,
      pvEagleProfilerExport: pv_eagle_profiler_export,
      pvEagleProfilerReset: pv_eagle_profiler_reset,
    };
  }
}

/**
 * JavaScript/WebAssembly binding for Eagle Speaker Recognition engine.
 * It processes incoming audio in consecutive frames and emits a similarity score for each enrolled speaker.
 */
export class Eagle extends EagleBase {
  private readonly _pvEagleDelete: pv_eagle_delete_type;
  private readonly _pvEagleProcess: pv_eagle_process_type;
  private readonly _pvEagleReset: pv_eagle_profiler_reset_type;

  private readonly _objectAddress: number;
  private readonly _scoresAddress: number;
  private readonly _numSpeakers: number;

  private static _frameLength: number;

  private constructor(handleWasm: EagleWasmOutput) {
    super(handleWasm);

    Eagle._frameLength = handleWasm.frameLength;

    this._pvEagleDelete = handleWasm.pvEagleDelete;
    this._pvEagleProcess = handleWasm.pvEagleProcess;
    this._pvEagleReset = handleWasm.pvEagleReset;

    this._objectAddress = handleWasm.objectAddress;
    this._scoresAddress = handleWasm.scoresAddress;
    this._numSpeakers = handleWasm.numSpeakers;
  }

  /**
   * Number of audio samples per frame expected by Eagle (i.e. length of the array passed into `.process()`)
   */
  get frameLength(): number {
    return Eagle._frameLength;
  }

  /**
   * Creates an instance of the Picovoice Eagle Speaker Recognition Engine.
   *
   * @param accessKey: AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
   * @param model Eagle model options.
   * @param model.base64 The model in base64 string to initialize Eagle.
   * @param model.publicPath The model path relative to the public directory.
   * @param model.customWritePath Custom path to save the model in storage.
   * Set to a different name to use multiple models across `eagle` instances.
   * @param model.forceWrite Flag to overwrite the model in storage even if it exists.
   * @param model.version Version of the model file. Increment to update the model file in storage.
   * @param speakerProfiles One or more Eagle speaker profiles. These can be constructed using `EagleProfiler`.
   *
   * @return An instance of the Eagle engine.
   */
  public static async create(
    accessKey: string,
    model: EagleModel,
    speakerProfiles: Uint8Array[] | Uint8Array
  ): Promise<Eagle> {
    const customWritePath = model.customWritePath
      ? model.customWritePath
      : 'eagle_model';
    const modelPath = await loadModel({ ...model, customWritePath });

    return Eagle._init(
      accessKey,
      modelPath,
      !Array.isArray(speakerProfiles) ? [speakerProfiles] : speakerProfiles
    );
  }

  public static async _init(
    accessKey: string,
    modelPath: string,
    speakerProfiles: Uint8Array[]
  ): Promise<Eagle> {
    if (!isAccessKeyValid(accessKey)) {
      throw new Error('Invalid AccessKey');
    }

    if (!speakerProfiles || speakerProfiles.length === 0) {
      throw new Error('No speaker profiles provided');
    }

    return new Promise<Eagle>((resolve, reject) => {
      Eagle._eagleMutex
        .runExclusive(async () => {
          const isSimd = await simd();
          const wasmOutput = await Eagle._initWasm(
            accessKey,
            modelPath,
            speakerProfiles,
            isSimd ? this._wasmSimd : this._wasm
          );
          return new Eagle(wasmOutput);
        })
        .then((result: Eagle) => {
          resolve(result);
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  }

  /**
   * Processes a frame of audio and returns a list of similarity scores for each speaker profile.
   *
   * @param pcm A frame of audio samples. The number of samples per frame can be attained by calling
   * `.frameLength`. The incoming audio needs to have a sample rate equal to `.sampleRate` and be 16-bit
   * linearly-encoded. Eagle operates on single-channel audio.
   *
   * @return A list of similarity scores for each speaker profile. A higher score indicates that the voice
   * belongs to the corresponding speaker. The range is [0, 1] with 1.0 representing a perfect match.
   */
  public async process(pcm: Int16Array): Promise<number[]> {
    if (!(pcm instanceof Int16Array)) {
      throw new Error("The argument 'pcm' must be provided as an Int16Array");
    }

    if (pcm.length !== Eagle._frameLength) {
      throw new Error(
        `Length of input frame (${pcm.length}) does not match required frame length (${Eagle._frameLength})`
      );
    }

    return new Promise<number[]>((resolve, reject) => {
      this._functionMutex
        .runExclusive(async () => {
          if (this._wasmMemory === undefined) {
            throw new Error('Attempted to call `.process` after release');
          }

          const pcmAddress = await this._alignedAlloc(
            Int16Array.BYTES_PER_ELEMENT,
            pcm.length * Int16Array.BYTES_PER_ELEMENT
          );

          const memoryBufferInt16 = new Int16Array(this._wasmMemory.buffer);
          memoryBufferInt16.set(pcm, pcmAddress / Int16Array.BYTES_PER_ELEMENT);

          const status = await this._pvEagleProcess(
            this._objectAddress,
            pcmAddress,
            this._scoresAddress
          );
          await this._pvFree(pcmAddress);
          if (status !== PV_STATUS_SUCCESS) {
            throw new Error(
              `process failed with status ${arrayBufferToStringAtIndex(
                this._memoryBufferUint8,
                await this._pvStatusToString(status)
              )}`
            );
          }

          const scores: number[] = [];
          for (let i = 0; i < this._numSpeakers; i++) {
            scores.push(
              this._memoryBufferView.getFloat32(
                this._scoresAddress + i * Float32Array.BYTES_PER_ELEMENT,
                true
              )
            );
          }

          return scores;
        })
        .then((result: number[]) => {
          resolve(result);
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  }

  /**
   * Resets the internal state of the engine.
   * It must be called before processing a new sequence of audio frames.
   */
  public async reset(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this._functionMutex
        .runExclusive(async () => {
          if (this._wasmMemory === undefined) {
            throw new Error('Attempted to call `.reset` after release');
          }

          const status = await this._pvEagleReset(this._objectAddress);
          if (status !== PV_STATUS_SUCCESS) {
            throw new Error(
              `reset failed with status ${arrayBufferToStringAtIndex(
                this._memoryBufferUint8,
                await this._pvStatusToString(status)
              )}`
            );
          }
        })
        .then(() => {
          resolve();
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  }

  /**
   * Releases resources acquired by Eagle
   */
  public async release(): Promise<void> {
    await this._pvFree(this._scoresAddress);
    await this._pvEagleDelete(this._objectAddress);
    delete this._wasmMemory;
    this._wasmMemory = undefined;
  }

  private static async _initWasm(
    accessKey: string,
    modelPath: string,
    speakerProfiles: Uint8Array[],
    wasmBase64: string
  ): Promise<EagleWasmOutput> {
    const baseWasmOutput = await super._initBaseWasm(wasmBase64, 3150);
    const memoryBufferUint8 = new Uint8Array(baseWasmOutput.memory.buffer);
    const memoryBufferInt32 = new Int32Array(baseWasmOutput.memory.buffer);

    const pv_eagle_init = baseWasmOutput.exports
      .pv_eagle_init as pv_eagle_init_type;
    const pv_eagle_delete = baseWasmOutput.exports
      .pv_eagle_delete as pv_eagle_delete_type;
    const pv_eagle_process = baseWasmOutput.exports
      .pv_eagle_process as pv_eagle_process_type;
    const pv_eagle_frame_length = baseWasmOutput.exports
      .pv_eagle_frame_length as pv_eagle_frame_length_type;
    const pv_eagle_reset = baseWasmOutput.exports
      .pv_eagle_reset as pv_eagle_reset_type;

    const objectAddressAddress = await baseWasmOutput.alignedAlloc(
      Int32Array.BYTES_PER_ELEMENT,
      Int32Array.BYTES_PER_ELEMENT
    );
    if (objectAddressAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }

    const accessKeyAddress = await baseWasmOutput.alignedAlloc(
      Uint8Array.BYTES_PER_ELEMENT,
      (accessKey.length + 1) * Uint8Array.BYTES_PER_ELEMENT
    );
    if (accessKeyAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }
    for (let i = 0; i < accessKey.length; i++) {
      memoryBufferUint8[accessKeyAddress + i] = accessKey.charCodeAt(i);
    }
    memoryBufferUint8[accessKeyAddress + accessKey.length] = 0;

    const modelPathEncoded = new TextEncoder().encode(modelPath);
    const modelPathAddress = await baseWasmOutput.alignedAlloc(
      Uint8Array.BYTES_PER_ELEMENT,
      (modelPathEncoded.length + 1) * Uint8Array.BYTES_PER_ELEMENT
    );
    if (modelPathAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }
    memoryBufferUint8.set(modelPathEncoded, modelPathAddress);
    memoryBufferUint8[modelPathAddress + modelPathEncoded.length] = 0;

    const numSpeakers = speakerProfiles.length;
    const profilesAddressAddress = await baseWasmOutput.alignedAlloc(
      Int32Array.BYTES_PER_ELEMENT,
      numSpeakers * Int32Array.BYTES_PER_ELEMENT
    );
    if (profilesAddressAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }
    const profilesAddressList: number[] = [];
    for (const profile of speakerProfiles) {
      const profileAddress = await baseWasmOutput.alignedAlloc(
        Uint8Array.BYTES_PER_ELEMENT,
        profile.length * Uint8Array.BYTES_PER_ELEMENT
      );
      if (profileAddress === 0) {
        throw new Error('malloc failed: Cannot allocate memory');
      }
      memoryBufferUint8.set(profile, profileAddress);
      profilesAddressList.push(profileAddress);
    }
    memoryBufferInt32.set(
      new Int32Array(profilesAddressList),
      profilesAddressAddress / Int32Array.BYTES_PER_ELEMENT
    );
    const status = await pv_eagle_init(
      accessKeyAddress,
      modelPathAddress,
      numSpeakers,
      profilesAddressAddress,
      objectAddressAddress
    );
    await baseWasmOutput.pvFree(accessKeyAddress);
    await baseWasmOutput.pvFree(modelPathAddress);
    await baseWasmOutput.pvFree(profilesAddressAddress);
    if (status !== PV_STATUS_SUCCESS) {
      const msg = `'pv_eagle_init' failed with status ${arrayBufferToStringAtIndex(
        memoryBufferUint8,
        await baseWasmOutput.pvStatusToString(status)
      )}`;

      throw new Error(
        `${msg}\nDetails: ${baseWasmOutput.pvError.getErrorString()}`
      );
    }

    const memoryBufferView = new DataView(baseWasmOutput.memory.buffer);
    const objectAddress = memoryBufferView.getInt32(objectAddressAddress, true);
    await baseWasmOutput.pvFree(objectAddressAddress);

    const scoresAddress = await baseWasmOutput.alignedAlloc(
      Float32Array.BYTES_PER_ELEMENT,
      numSpeakers * Float32Array.BYTES_PER_ELEMENT
    );
    if (scoresAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }

    const frameLength = await pv_eagle_frame_length();

    return {
      ...baseWasmOutput,
      frameLength: frameLength,
      numSpeakers: numSpeakers,
      objectAddress: objectAddress,
      scoresAddress: scoresAddress,

      pvEagleDelete: pv_eagle_delete,
      pvEagleProcess: pv_eagle_process,
      pvEagleReset: pv_eagle_reset,
    };
  }
}
