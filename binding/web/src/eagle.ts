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

import {
  EagleModel,
  EagleProfile,
  EagleProfilerEnrollFeedback,
  EagleProfilerEnrollResult,
  EagleProfilerOptions,
} from './types';

const PV_STATUS_SUCCESS = 10000;
const MAX_PCM_LENGTH_SEC = 60 * 15;

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

/**
 * JavaScript/WebAssembly Binding for Eagle
 */
type EagleProfilerWasmOutput = {
  memory: WebAssembly.Memory;
  alignedAlloc: aligned_alloc_type;
  pvFree: pv_free_type;
  pvError: PvError;

  minEnrollSamples: number;
  profileSize: number;
  sampleRate: number;
  version: string;

  objectAddress: number;

  pvEagleProfilerDelete: pv_eagle_profiler_delete_type;
  pvEagleProfilerEnroll: pv_eagle_profiler_enroll_type;
  pvEagleProfilerExport: pv_eagle_profiler_export_type;
  pvEagleProfilerReset: pv_eagle_profiler_reset_type;
  pvStatusToString: pv_status_to_string_type;
};

export class EagleProfiler {
  private readonly _pvEagleProfilerDelete: pv_eagle_profiler_delete_type;
  private readonly _pvEagleProfilerEnroll: pv_eagle_profiler_enroll_type;
  private readonly _pvEagleProfilerExport: pv_eagle_profiler_export_type;
  private readonly _pvEagleProfilerReset: pv_eagle_profiler_reset_type;
  private readonly _pvStatusToString: pv_status_to_string_type;

  private _wasmMemory: WebAssembly.Memory | undefined;
  private readonly _alignedAlloc: CallableFunction;
  private readonly _pvFree: pv_free_type;
  private readonly _memoryBuffer: Int16Array;
  private readonly _memoryBufferUint8: Uint8Array;
  private readonly _memoryBufferView: DataView;
  private readonly _functionMutex: Mutex;

  private readonly _objectAddress: number;

  private static _maxEnrollSamples: number;
  private static _minEnrollSamples: number;
  private static _profileSize: number;
  private static _sampleRate: number;
  private static _version: string;

  private static _wasm: string;
  private static _wasmSimd: string;

  private static _eagleMutex = new Mutex();

  private readonly _pvError: PvError;

  private constructor(
    handleWasm: EagleProfilerWasmOutput,
    _: EagleProfilerOptions
  ) {
    EagleProfiler._minEnrollSamples = handleWasm.minEnrollSamples;
    EagleProfiler._profileSize = handleWasm.profileSize;
    EagleProfiler._sampleRate = handleWasm.sampleRate;
    EagleProfiler._version = handleWasm.version;
    EagleProfiler._maxEnrollSamples =
      MAX_PCM_LENGTH_SEC * EagleProfiler._sampleRate;

    this._pvEagleProfilerDelete = handleWasm.pvEagleProfilerDelete;
    this._pvEagleProfilerEnroll = handleWasm.pvEagleProfilerEnroll;
    this._pvEagleProfilerExport = handleWasm.pvEagleProfilerExport;
    this._pvEagleProfilerReset = handleWasm.pvEagleProfilerReset;
    this._pvStatusToString = handleWasm.pvStatusToString;

    this._wasmMemory = handleWasm.memory;
    this._alignedAlloc = handleWasm.alignedAlloc;
    this._pvFree = handleWasm.pvFree;
    this._pvError = handleWasm.pvError;

    this._objectAddress = handleWasm.objectAddress;

    this._memoryBuffer = new Int16Array(handleWasm.memory.buffer);
    this._memoryBufferUint8 = new Uint8Array(handleWasm.memory.buffer);
    this._memoryBufferView = new DataView(handleWasm.memory.buffer);

    this._functionMutex = new Mutex();
  }

  /**
   * Get Eagle engine version.
   */
  get version(): string {
    return EagleProfiler._version;
  }

  /**
   * Get the minimum length of the input pcm required by `.enroll`.
   */
  get minEnrollSamples(): number {
    return EagleProfiler._minEnrollSamples;
  }

  /**
   * Audio sample rate accepted by `.enroll`.
   */
  get sampleRate(): number {
    return EagleProfiler._sampleRate;
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

  /**
   * Creates an instance of the Picovoice Eagle Speaker Recognition Engine.
   * Behind the scenes, it requires the WebAssembly code to load and initialize before
   * it can create an instance.
   *
   * @param accessKey AccessKey obtained from Picovoice Console (https://console.picovoice.ai/).
   * @param model Eagle model options.
   * @param model.base64 The model in base64 string to initialize Eagle.
   * @param model.publicPath The model path relative to the public directory.
   * @param model.customWritePath Custom path to save the model in storage.
   * Set to a different name to use multiple models across `eagle` instances.
   * @param model.forceWrite Flag to overwrite the model in storage even if it exists.
   * @param model.version Version of the model file. Increment to update the model file in storage.
   * @param options Optional configuration arguments.
   * @param options.enrollErrorCallback User-defined callback invoked if any error happens
   * while enrolling a speaker.
   *
   * @returns An instance of the Eagle engine.
   */
  public static async create(
    accessKey: string,
    model: EagleModel,
    options: EagleProfilerOptions = {}
  ): Promise<EagleProfiler> {
    const customWritePath = model.customWritePath
      ? model.customWritePath
      : 'eagle_model';
    const modelPath = await loadModel({ ...model, customWritePath });

    return EagleProfiler._init(accessKey, modelPath, options);
  }

  public static async _init(
    accessKey: string,
    modelPath: string,
    options: EagleProfilerOptions = {}
  ): Promise<EagleProfiler> {
    if (!isAccessKeyValid(accessKey)) {
      throw new Error('Invalid AccessKey');
    }

    return new Promise<EagleProfiler>((resolve, reject) => {
      EagleProfiler._eagleMutex
        .runExclusive(async () => {
          const isSimd = await simd();
          const wasmOutput = await EagleProfiler._initWasm(
            accessKey,
            modelPath,
            isSimd ? this._wasmSimd : this._wasm
          );
          return new EagleProfiler(wasmOutput, options);
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
   * `.enroll` can be obtained by calling `.minEnrollSamples()`.
   * The audio data used for enrollment should satisfy the following requirements:
   *    - only one speaker should be present in the audio
   *    - the speaker should be speaking in a normal voice
   *    - the audio should contain no speech from other speakers and no other sounds (e.g. music)
   *    - it should be captured in a quiet environment with no background noise
   * @param pcm Audio data for enrollment. The audio needs to have a sample rate equal to `.sampleRate` and be
   * 16-bit linearly-encoded. EagleProfiler operates on single-channel audio.
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
            throw new Error('Attempted to call `enroll()` after release');
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

            const memoryBufferUint8 = new Uint8Array(this._wasmMemory.buffer);
            throw new Error(
              `enroll failed with status ${arrayBufferToStringAtIndex(
                memoryBufferUint8,
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
   * Will raise an exception if the profile is not ready.
   *
   * @return An immutable EagleProfile object.
   */
  public async export(): Promise<EagleProfile> {
    return new Promise<EagleProfile>((resolve, reject) => {
      this._functionMutex
        .runExclusive(async () => {
          if (this._wasmMemory === undefined) {
            throw new Error('Attempted to call `export()` after release');
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

          return { profile };
        })
        .then((result: EagleProfile) => {
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
            throw new Error('Attempted to call `reset()` after release');
          }

          const status = await this._pvEagleProfilerReset(this._objectAddress);
          if (status !== PV_STATUS_SUCCESS) {
            throw new Error(
              `search failed with status ${arrayBufferToStringAtIndex(
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
   * Releases resources acquired by EagleProfiler
   */
  public async release(): Promise<void> {
    await this._pvEagleProfilerDelete(this._objectAddress);
    delete this._wasmMemory;
    this._wasmMemory = undefined;
  }

  private static async _initWasm(
    accessKey: string,
    modelPath: string,
    wasmBase64: string
  ): Promise<EagleProfilerWasmOutput> {
    // A WebAssembly page has a constant size of 64KiB. -> 1MiB ~= 16 pages
    const memory = new WebAssembly.Memory({ initial: 3500 });
    const memoryBufferUint8 = new Uint8Array(memory.buffer);
    const pvError = new PvError();
    const exports = await buildWasm(memory, wasmBase64, pvError);

    const aligned_alloc = exports.aligned_alloc as aligned_alloc_type;
    const pv_free = exports.pv_free as pv_free_type;
    const pv_eagle_profiler_init =
      exports.pv_eagle_profiler_init as pv_eagle_profiler_init_type;
    const pv_eagle_profiler_delete =
      exports.pv_eagle_profiler_delete as pv_eagle_profiler_delete_type;
    const pv_eagle_profiler_enroll =
      exports.pv_eagle_profiler_enroll as pv_eagle_profiler_enroll_type;
    const pv_eagle_profiler_enroll_min_audio_length_samples =
      exports.pv_eagle_profiler_enroll_min_audio_length_samples as pv_eagle_profiler_enroll_min_audio_length_samples_type;
    const pv_eagle_profiler_export =
      exports.pv_eagle_profiler_export as pv_eagle_profiler_export_type;
    const pv_eagle_profiler_export_size =
      exports.pv_eagle_profiler_export_size as pv_eagle_profiler_export_size_type;
    const pv_eagle_profiler_reset =
      exports.pv_eagle_profiler_reset as pv_eagle_profiler_reset_type;
    const pv_eagle_version = exports.pv_eagle_version as pv_eagle_version_type;
    const pv_status_to_string =
      exports.pv_status_to_string as pv_status_to_string_type;
    const pv_sample_rate = exports.pv_sample_rate as pv_sample_rate_type;

    const objectAddressAddress = await aligned_alloc(
      Int32Array.BYTES_PER_ELEMENT,
      Int32Array.BYTES_PER_ELEMENT
    );
    if (objectAddressAddress === 0) {
      throw new Error('malloc failed: Cannot allocate memory');
    }

    const accessKeyAddress = await aligned_alloc(
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
    const modelPathAddress = await aligned_alloc(
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
    await pv_free(accessKeyAddress);
    await pv_free(modelPathAddress);
    if (status !== PV_STATUS_SUCCESS) {
      const msg = `'pv_eagle_profiler_init' failed with status ${arrayBufferToStringAtIndex(
        memoryBufferUint8,
        await pv_status_to_string(status)
      )}`;

      throw new Error(`${msg}\nDetails: ${pvError.getErrorString()}`);
    }

    const memoryBufferView = new DataView(memory.buffer);
    const objectAddress = memoryBufferView.getInt32(objectAddressAddress, true);
    await pv_free(objectAddressAddress);

    const minEnrollSamplesAddress = await aligned_alloc(
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
        await pv_status_to_string(status)
      )}`;
      throw new Error(`${msg}\nDetails: ${pvError.getErrorString()}`);
    }
    const minEnrollSamples = memoryBufferView.getInt32(
      minEnrollSamplesAddress,
      true
    );
    await pv_free(minEnrollSamplesAddress);

    const profileSizeAddress = await aligned_alloc(
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
        await pv_status_to_string(status)
      )}`;
      throw new Error(`${msg}\nDetails: ${pvError.getErrorString()}`);
    }

    const profileSize = memoryBufferView.getInt32(profileSizeAddress, true);
    await pv_free(profileSizeAddress);

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

      minEnrollSamples: minEnrollSamples,
      profileSize: profileSize,
      sampleRate: sampleRate,
      version: version,

      objectAddress: objectAddress,

      pvEagleProfilerDelete: pv_eagle_profiler_delete,
      pvEagleProfilerEnroll: pv_eagle_profiler_enroll,
      pvEagleProfilerExport: pv_eagle_profiler_export,
      pvEagleProfilerReset: pv_eagle_profiler_reset,
      pvStatusToString: pv_status_to_string,
    };
  }
}
