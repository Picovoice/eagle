/*
  Copyright 2023-2026 Picovoice Inc.

  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.

  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

/* eslint camelcase: 0 */

import { Mutex } from 'async-mutex';

import {
  arrayBufferToStringAtIndex,
  base64ToUint8Array,
  isAccessKeyValid,
  loadModel,
} from '@picovoice/web-utils';

import createModuleSimd from "./lib/pv_eagle_simd";
import createModulePThread from "./lib/pv_eagle_pthread";

import { simd } from 'wasm-feature-detect';

import {
  EagleModel,
  EagleOptions,
  EagleProfile,
  EagleProfilerOptions,
  PvStatus
} from './types';

import * as EagleErrors from './eagle_errors';
import { pvStatusToException } from './eagle_errors';

/**
 * WebAssembly function types
 */
type pv_eagle_profiler_init_type = (
  accessKey: number,
  modelPath: number,
  device: number,
  min_enrollment_chunks,
  voice_threshold: number,
  object: number
) => Promise<number>;
type pv_eagle_profiler_delete_type = (object: number) => Promise<void>;
type pv_eagle_profiler_enroll_type = (
  object: number,
  pcm: number,
  percentage: number
) => Promise<number>;
type pv_eagle_profiler_flush_type = (
  object: number,
  percentage: number
) => Promise<number>;
type pv_eagle_profiler_frame_length_type = () => number;
type pv_eagle_profiler_export_type = (
  object: number,
  speakerProfile: number
) => number;
type pv_eagle_profiler_export_size_type = (
  object: number,
  speakerProfileSizeBytes: number
) => number;
type pv_eagle_profiler_reset_type = (object: number) => Promise<number>;
type pv_eagle_init_type = (
  accessKey: number,
  modelPath: number,
  device: number,
  voiceThreshold: number,
  object: number
) => Promise<number>;
type pv_eagle_delete_type = (object: number) => Promise<void>;
type pv_eagle_process_type = (
  object: number,
  pcm: number,
  pcmLength: number,
  speakerProfiles: number,
  numSpeakers: number,
  scores: number
) => Promise<number>;
type pv_eagle_scores_delete_type = (
  scores: number
) => Promise<void>;
type pv_eagle_process_min_audio_length_samples_type = (
  object: number,
  numSamples: number
) => number;
type pv_eagle_version_type = () => number;
type pv_eagle_list_hardware_devices_type = (
  hardwareDevices: number,
  numHardwareDevices: number
) => number;
type pv_eagle_free_hardware_devices_type = (
  hardwareDevices: number,
  numHardwareDevices: number
) => number;
type pv_sample_rate_type = () => number;
type pv_set_sdk_type = (sdk: number) => void;
type pv_get_error_stack_type = (
  messageStack: number,
  messageStackDepth: number
) => number;
type pv_free_error_stack_type = (messageStack: number) => void;

type EagleModule = EmscriptenModule & {
  _pv_free: (address: number) => void;

  _pv_eagle_profiler_export: pv_eagle_profiler_export_type
  _pv_eagle_profiler_export_size: pv_eagle_profiler_export_size_type
  _pv_eagle_profiler_frame_length: pv_eagle_profiler_frame_length_type
  _pv_eagle_process_min_audio_length_samples: pv_eagle_process_min_audio_length_samples_type
  _pv_eagle_version: pv_eagle_version_type
  _pv_eagle_list_hardware_devices: pv_eagle_list_hardware_devices_type;
  _pv_eagle_free_hardware_devices: pv_eagle_free_hardware_devices_type;
  _pv_sample_rate: pv_sample_rate_type

  _pv_set_sdk: pv_set_sdk_type;
  _pv_get_error_stack: pv_get_error_stack_type;
  _pv_free_error_stack: pv_free_error_stack_type;

  // em default functions
  addFunction: typeof addFunction;
  ccall: typeof ccall;
  cwrap: typeof cwrap;
}

type EagleBaseWasmOutput = {
  module: EagleModule;

  sampleRate: number;
  version: string;

  messageStackAddressAddressAddress: number;
  messageStackDepthAddress: number;
};

type EagleProfilerWasmOutput = EagleBaseWasmOutput & {
  frameLength: number;
  profileSize: number;

  objectAddress: number;
  percentageAddress: number;
  profileAddress: number;

  pv_eagle_profiler_enroll: pv_eagle_profiler_enroll_type;
  pv_eagle_profiler_flush: pv_eagle_profiler_flush_type;
  pv_eagle_profiler_reset: pv_eagle_profiler_reset_type;
  pv_eagle_profiler_delete: pv_eagle_profiler_delete_type;
};

type EagleWasmOutput = EagleBaseWasmOutput & {
  minProcessSamples: number;

  objectAddress: number;
  scoresAddressAddress: number;

  pv_eagle_process: pv_eagle_process_type;
  pv_eagle_scores_delete: pv_eagle_scores_delete_type;
  pv_eagle_delete: pv_eagle_delete_type;
};

const PV_STATUS_SUCCESS = 10000;

class EagleBase {
  protected _module?: EagleModule;

  protected readonly _functionMutex: Mutex;

  protected readonly _messageStackAddressAddressAddress: number;
  protected readonly _messageStackDepthAddress: number;

  protected readonly _sampleRate: number;
  protected readonly _version: string;

  protected static _wasmSimd: string;
  protected static _wasmSimdLib: string;
  protected static _wasmPThread: string;
  protected static _wasmPThreadLib: string;

  protected static _sdk: string = 'web';

  protected static _eagleMutex = new Mutex();

  protected constructor(handleWasm: EagleBaseWasmOutput) {
    this._module = handleWasm.module;

    this._sampleRate = handleWasm.sampleRate;
    this._version = handleWasm.version;

    this._messageStackAddressAddressAddress = handleWasm.messageStackAddressAddressAddress;
    this._messageStackDepthAddress = handleWasm.messageStackDepthAddress;

    this._functionMutex = new Mutex();
  }

  /**
   * Audio sample rate required by Eagle.
   */
  get sampleRate(): number {
    return this._sampleRate;
  }

  /**
   * Version of Eagle.
   */
  get version(): string {
    return this._version;
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
   * Set base64 SIMD wasm file in text format.
   * @param wasmSimdLib Base64'd wasm file in text format.
   */
  public static setWasmSimdLib(wasmSimdLib: string): void {
    if (this._wasmSimdLib === undefined) {
      this._wasmSimdLib = wasmSimdLib;
    }
  }

  /**
   * Set base64 wasm file with SIMD and pthread feature.
   * @param wasmPThread Base64'd wasm file to use to initialize wasm.
   */
  public static setWasmPThread(wasmPThread: string): void {
    if (this._wasmPThread === undefined) {
      this._wasmPThread = wasmPThread;
    }
  }

  /**
   * Set base64 SIMD and thread wasm file in text format.
   * @param wasmPThreadLib Base64'd wasm file in text format.
   */
  public static setWasmPThreadLib(wasmPThreadLib: string): void {
    if (this._wasmPThreadLib === undefined) {
      this._wasmPThreadLib = wasmPThreadLib;
    }
  }

  public static setSdk(sdk: string): void {
    EagleBase._sdk = sdk;
  }

  protected static async _initBaseWasm(
    wasmBase64: string,
    wasmLibBase64: string,
    createModuleFunc: any,
  ): Promise<EagleBaseWasmOutput> {
    const blob = new Blob(
      [base64ToUint8Array(wasmLibBase64)],
      { type: 'application/javascript' }
    );
    const module: EagleModule = await createModuleFunc({
      mainScriptUrlOrBlob: blob,
      wasmBinary: base64ToUint8Array(wasmBase64),
    });

    const sampleRate = module._pv_sample_rate();
    const versionAddress = module._pv_eagle_version();
    const version = arrayBufferToStringAtIndex(
      module.HEAPU8,
      versionAddress,
    );

    const sdkEncoded = new TextEncoder().encode(this._sdk);
    const sdkAddress = module._malloc((sdkEncoded.length + 1) * Uint8Array.BYTES_PER_ELEMENT);
    if (!sdkAddress) {
      throw new EagleErrors.EagleOutOfMemoryError('malloc failed: Cannot allocate memory');
    }
    module.HEAPU8.set(sdkEncoded, sdkAddress);
    module.HEAPU8[sdkAddress + sdkEncoded.length] = 0;
    module._pv_set_sdk(sdkAddress);
    module._pv_free(sdkAddress);

    const messageStackDepthAddress = module._malloc(Int32Array.BYTES_PER_ELEMENT);
    if (!messageStackDepthAddress) {
      throw new EagleErrors.EagleOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }

    const messageStackAddressAddressAddress = module._malloc(Int32Array.BYTES_PER_ELEMENT);
    if (!messageStackAddressAddressAddress) {
      throw new EagleErrors.EagleOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }

    return {
      module: module,

      sampleRate: sampleRate,
      version: version,

      messageStackAddressAddressAddress: messageStackAddressAddressAddress,
      messageStackDepthAddress: messageStackDepthAddress,
    };
  }

  /**
   * Releases resources acquired by Eagle
   */
  public async release(): Promise<void> {
    if (!this._module) {
      return;
    }
    this._module._pv_free(this._messageStackAddressAddressAddress);
    this._module._pv_free(this._messageStackDepthAddress);
  }

  protected static async getMessageStack(
    pv_get_error_stack: pv_get_error_stack_type,
    pv_free_error_stack: pv_free_error_stack_type,
    messageStackAddressAddressAddress: number,
    messageStackDepthAddress: number,
    memoryBufferInt32: Int32Array,
    memoryBufferUint8: Uint8Array
  ): Promise<string[]> {
    const status = pv_get_error_stack(messageStackAddressAddressAddress, messageStackDepthAddress);
    if (status !== PvStatus.SUCCESS) {
      throw pvStatusToException(status, 'Unable to get Eagle error state');
    }

    const messageStackAddressAddress = memoryBufferInt32[messageStackAddressAddressAddress / Int32Array.BYTES_PER_ELEMENT];

    const messageStackDepth = memoryBufferInt32[messageStackDepthAddress / Int32Array.BYTES_PER_ELEMENT];
    const messageStack: string[] = [];
    for (let i = 0; i < messageStackDepth; i++) {
      const messageStackAddress = memoryBufferInt32[
        (messageStackAddressAddress / Int32Array.BYTES_PER_ELEMENT) + i
      ];
      const message = arrayBufferToStringAtIndex(memoryBufferUint8, messageStackAddress);
      messageStack.push(message);
    }

    pv_free_error_stack(messageStackAddressAddress);

    return messageStack;
  }

  protected static wrapAsyncFunction(module: EagleModule, functionName: string, numArgs: number): (...args: any[]) => any {
    // @ts-ignore
    return module.cwrap(
      functionName,
      "number",
      Array(numArgs).fill("number"),
      { async: true }
    );
  }
}

/**
 * JavaScript/WebAssembly binding for the profiler of the Eagle Speaker Recognition engine.
 * It enrolls a speaker given a set of utterances and then constructs a profile for the enrolled speaker.
 */
export class EagleProfiler extends EagleBase {
  private readonly _pv_eagle_profiler_enroll: pv_eagle_profiler_enroll_type;
  private readonly _pv_eagle_profiler_flush: pv_eagle_profiler_flush_type;
  private readonly _pv_eagle_profiler_reset: pv_eagle_profiler_reset_type;
  private readonly _pv_eagle_profiler_delete: pv_eagle_profiler_delete_type;

  private readonly _objectAddress: number;
  private readonly _percentageAddress: number;

  private readonly _frameLength: number;
  private readonly _profileSize: number;

  private constructor(handleWasm: EagleProfilerWasmOutput) {
    super(handleWasm);

    this._frameLength = handleWasm.frameLength;
    this._profileSize = handleWasm.profileSize;

    this._pv_eagle_profiler_enroll = handleWasm.pv_eagle_profiler_enroll;
    this._pv_eagle_profiler_flush = handleWasm.pv_eagle_profiler_flush;
    this._pv_eagle_profiler_reset = handleWasm.pv_eagle_profiler_reset;
    this._pv_eagle_profiler_delete = handleWasm.pv_eagle_profiler_delete;

    this._objectAddress = handleWasm.objectAddress;
    this._percentageAddress = handleWasm.percentageAddress;
  }

  /**
   * The length of the input pcm required by `.enroll()`.
   */
  get frameLength(): number {
    return this._frameLength;
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
   * @param options Optional configuration arguments.
   * @param options.device String representation of the device (e.g., CPU or GPU) to use. If set to `best`, the most
   * suitable device is selected automatically. If set to `gpu`, the engine uses the first available GPU device. To select a specific
   * GPU device, set this argument to `gpu:${GPU_INDEX}`, where `${GPU_INDEX}` is the index of the target GPU. If set to
   * `cpu`, the engine will run on the CPU with the default number of threads. To specify the number of threads, set this
   * argument to `cpu:${NUM_THREADS}`, where `${NUM_THREADS}` is the desired number of threads.
   * @param options.minEnrollmentChunks Minimum number of chunks to be processed before enroll returns 100%
   * @param options.voiceThreshold Sensitivity threshold for detecting voice.
   *
   * @return An instance of the Eagle Profiler.
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
      throw new EagleErrors.EagleInvalidArgumentError('Invalid AccessKey');
    }

    let {
      device = "best",
      minEnrollmentChunks = 1, // eslint-disable-line
      voiceThreshold = 0.3, // eslint-disable-line
    } = options;

    const isSimd = await simd();
    if (!isSimd) {
      throw new EagleErrors.EagleRuntimeError('Browser not supported.');
    }

    const isWorkerScope =
      typeof WorkerGlobalScope !== 'undefined' &&
      self instanceof WorkerGlobalScope;
    if (
      !isWorkerScope &&
      (device === 'best' || (device.startsWith('cpu') && device !== 'cpu:1'))
    ) {
      // eslint-disable-next-line no-console
      console.warn('Multi-threading is not supported on main thread.');
      device = 'cpu:1';
    }

    const sabDefined = typeof SharedArrayBuffer !== 'undefined'
      && (device !== "cpu:1");

    return new Promise<EagleProfiler>((resolve, reject) => {
      EagleProfiler._eagleMutex
        .runExclusive(async () => {
          const wasmOutput = await EagleProfiler._initProfilerWasm(
            accessKey.trim(),
            modelPath.trim(),
            device,
            minEnrollmentChunks,
            voiceThreshold,
            sabDefined ? this._wasmPThread : this._wasmSimd,
            sabDefined ? this._wasmPThreadLib : this._wasmSimdLib,
            sabDefined ? createModulePThread : createModuleSimd
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
   * @return The percentage of completeness of the speaker enrollment process.
   */
  public async enroll(pcm: Int16Array): Promise<number> {
    if (!(pcm instanceof Int16Array)) {
      throw new EagleErrors.EagleInvalidArgumentError(
        "The argument 'pcm' must be provided as an Int16Array"
      );
    }

    if (pcm.length !== this.frameLength) {
      throw new EagleErrors.EagleInvalidArgumentError(
        `'pcm' size must be equal to ${this.frameLength}`
      );
    }

    return new Promise<number>((resolve, reject) => {
      this._functionMutex
        .runExclusive(async () => {
          if (this._module === undefined) {
            throw new EagleErrors.EagleInvalidStateError(
              'Attempted to call `.enroll()` after release'
            );
          }

          const pcmAddress = this._module._malloc(
            pcm.length * Int16Array.BYTES_PER_ELEMENT
          );

          this._module.HEAP16.set(
            pcm,
            pcmAddress / Int16Array.BYTES_PER_ELEMENT
          );
          const status = await this._pv_eagle_profiler_enroll(
            this._objectAddress,
            pcmAddress,
            this._percentageAddress
          );
          this._module._pv_free(pcmAddress);

          if (status !== PV_STATUS_SUCCESS) {
            const messageStack = await EagleProfiler.getMessageStack(
              this._module._pv_get_error_stack,
              this._module._pv_free_error_stack,
              this._messageStackAddressAddressAddress,
              this._messageStackDepthAddress,
              this._module.HEAP32,
              this._module.HEAPU8
            );

            throw pvStatusToException(
              status,
              'EagleProfiler enroll failed',
              messageStack
            );
          }

          const percentage =
            this._module.HEAPF32[
              this._percentageAddress / Float32Array.BYTES_PER_ELEMENT
            ];

          return percentage;
        })
        .then((result: number) => {
          resolve(result);
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  }

  /**
   * Marks the end of the audio stream, flushes internal state of the object, and returns the percentage of enrollment
   * completed.
   *
   * @return The percentage of completeness of the speaker enrollment process.
   */
  public async flush(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this._functionMutex
        .runExclusive(async () => {
          if (this._module === undefined) {
            throw new EagleErrors.EagleInvalidStateError(
              'Attempted to call `.flush()` after release'
            );
          }

          const status = await this._pv_eagle_profiler_flush(
            this._objectAddress,
            this._percentageAddress
          );

          if (status !== PV_STATUS_SUCCESS) {
            const messageStack = await EagleProfiler.getMessageStack(
              this._module._pv_get_error_stack,
              this._module._pv_free_error_stack,
              this._messageStackAddressAddressAddress,
              this._messageStackDepthAddress,
              this._module.HEAP32,
              this._module.HEAPU8
            );

            throw pvStatusToException(
              status,
              'EagleProfiler flush failed',
              messageStack
            );
          }

          const percentage =
            this._module.HEAPF32[
              this._percentageAddress / Float32Array.BYTES_PER_ELEMENT
            ];

          return percentage;
        })
        .then((result: number) => {
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
   * @return An EagleProfile object.
   */
  public async export(): Promise<EagleProfile> {
    return new Promise<EagleProfile>((resolve, reject) => {
      this._functionMutex
        .runExclusive(async () => {
          if (this._module === undefined) {
            throw new EagleErrors.EagleInvalidStateError(
              'Attempted to call `.export()` after release'
            );
          }

          const profileAddress = this._module._malloc(
            Uint8Array.BYTES_PER_ELEMENT * this._profileSize
          );

          const status = this._module._pv_eagle_profiler_export(
            this._objectAddress,
            profileAddress
          );
          if (status !== PV_STATUS_SUCCESS) {
            this._module._pv_free(profileAddress);

            const messageStack = await EagleProfiler.getMessageStack(
              this._module._pv_get_error_stack,
              this._module._pv_free_error_stack,
              this._messageStackAddressAddressAddress,
              this._messageStackDepthAddress,
              this._module.HEAP32,
              this._module.HEAPU8
            );

            throw pvStatusToException(
              status,
              'EagleProfiler export failed',
              messageStack
            );
          }

          const profile = this._module.HEAPU8.slice(
            profileAddress,
            profileAddress + Uint8Array.BYTES_PER_ELEMENT * this._profileSize
          );
          this._module._pv_free(profileAddress);

          return { bytes: profile };
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
          if (this._module === undefined) {
            throw new EagleErrors.EagleInvalidStateError(
              'Attempted to call `.reset()` after release'
            );
          }

          const status = await this._pv_eagle_profiler_reset(
            this._objectAddress
          );
          if (status !== PV_STATUS_SUCCESS) {
            const messageStack = await EagleProfiler.getMessageStack(
              this._module._pv_get_error_stack,
              this._module._pv_free_error_stack,
              this._messageStackAddressAddressAddress,
              this._messageStackDepthAddress,
              this._module.HEAP32,
              this._module.HEAPU8
            );

            throw pvStatusToException(
              status,
              'EagleProfiler reset failed',
              messageStack
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
    if (!this._module) {
      return;
    }

    await super.release();
    await this._pv_eagle_profiler_delete(this._objectAddress);
    this._module = undefined;
  }

  private static async _initProfilerWasm(
    accessKey: string,
    modelPath: string,
    device: string,
    minEnrollmentChunks: number,
    voiceThreshold: number,
    wasmBase64: string,
    wasmLibBase64: string,
    createModuleFunc: any
  ): Promise<EagleProfilerWasmOutput> {
    const baseWasmOutput = await super._initBaseWasm(
      wasmBase64,
      wasmLibBase64,
      createModuleFunc
    );

    const pv_eagle_profiler_init: pv_eagle_profiler_init_type =
      this.wrapAsyncFunction(
        baseWasmOutput.module,
        'pv_eagle_profiler_init',
        6
      );
    const pv_eagle_profiler_enroll: pv_eagle_profiler_enroll_type =
      this.wrapAsyncFunction(
        baseWasmOutput.module,
        'pv_eagle_profiler_enroll',
        3
      );
    const pv_eagle_profiler_flush: pv_eagle_profiler_flush_type =
      this.wrapAsyncFunction(
        baseWasmOutput.module,
        'pv_eagle_profiler_flush',
        2
      );

    const pv_eagle_profiler_reset: pv_eagle_profiler_reset_type =
      this.wrapAsyncFunction(
        baseWasmOutput.module,
        'pv_eagle_profiler_reset',
        1
      );

    const pv_eagle_profiler_delete: pv_eagle_profiler_delete_type =
      this.wrapAsyncFunction(
        baseWasmOutput.module,
        'pv_eagle_profiler_delete',
        1
      );

    const objectAddressAddress = baseWasmOutput.module._malloc(
      Int32Array.BYTES_PER_ELEMENT
    );
    if (objectAddressAddress === 0) {
      throw new EagleErrors.EagleOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }

    const accessKeyAddress = baseWasmOutput.module._malloc(
      (accessKey.length + 1) * Uint8Array.BYTES_PER_ELEMENT
    );
    if (accessKeyAddress === 0) {
      throw new EagleErrors.EagleOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }
    for (let i = 0; i < accessKey.length; i++) {
      baseWasmOutput.module.HEAPU8[accessKeyAddress + i] =
        accessKey.charCodeAt(i);
    }
    baseWasmOutput.module.HEAPU8[accessKeyAddress + accessKey.length] = 0;

    const modelPathEncoded = new TextEncoder().encode(modelPath);
    const modelPathAddress = baseWasmOutput.module._malloc(
      (modelPathEncoded.length + 1) * Uint8Array.BYTES_PER_ELEMENT
    );
    if (modelPathAddress === 0) {
      throw new EagleErrors.EagleOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }
    baseWasmOutput.module.HEAPU8.set(modelPathEncoded, modelPathAddress);
    baseWasmOutput.module.HEAPU8[
      modelPathAddress + modelPathEncoded.length
    ] = 0;

    const deviceAddress = baseWasmOutput.module._malloc(
      (device.length + 1) * Uint8Array.BYTES_PER_ELEMENT
    );
    if (deviceAddress === 0) {
      throw new EagleErrors.EagleOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }
    for (let i = 0; i < device.length; i++) {
      baseWasmOutput.module.HEAPU8[deviceAddress + i] = device.charCodeAt(i);
    }
    baseWasmOutput.module.HEAPU8[deviceAddress + device.length] = 0;

    let status = await pv_eagle_profiler_init(
      accessKeyAddress,
      modelPathAddress,
      deviceAddress,
      minEnrollmentChunks,
      voiceThreshold,
      objectAddressAddress,
    );
    baseWasmOutput.module._pv_free(accessKeyAddress);
    baseWasmOutput.module._pv_free(modelPathAddress);
    baseWasmOutput.module._pv_free(deviceAddress);
    if (status !== PvStatus.SUCCESS) {
      const messageStack = await EagleProfiler.getMessageStack(
        baseWasmOutput.module._pv_get_error_stack,
        baseWasmOutput.module._pv_free_error_stack,
        baseWasmOutput.messageStackAddressAddressAddress,
        baseWasmOutput.messageStackDepthAddress,
        baseWasmOutput.module.HEAP32,
        baseWasmOutput.module.HEAPU8
      );

      throw pvStatusToException(status, 'Initialization failed', messageStack);
    }

    const objectAddress =
      baseWasmOutput.module.HEAP32[
        objectAddressAddress / Int32Array.BYTES_PER_ELEMENT
      ];
    baseWasmOutput.module._pv_free(objectAddressAddress);

    const frameLength =
      baseWasmOutput.module._pv_eagle_profiler_frame_length();
    if (status !== PV_STATUS_SUCCESS) {
      const messageStack = await EagleProfiler.getMessageStack(
        baseWasmOutput.module._pv_get_error_stack,
        baseWasmOutput.module._pv_free_error_stack,
        baseWasmOutput.messageStackAddressAddressAddress,
        baseWasmOutput.messageStackDepthAddress,
        baseWasmOutput.module.HEAP32,
        baseWasmOutput.module.HEAPU8
      );

      throw pvStatusToException(
        status,
        'EagleProfiler failed to get min enroll audio length',
        messageStack
      );
    }

    const profileSizeAddress = baseWasmOutput.module._malloc(
      Int32Array.BYTES_PER_ELEMENT
    );
    if (profileSizeAddress === 0) {
      throw new EagleErrors.EagleOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }

    status = baseWasmOutput.module._pv_eagle_profiler_export_size(
      objectAddress,
      profileSizeAddress
    );
    if (status !== PV_STATUS_SUCCESS) {
      const messageStack = await EagleProfiler.getMessageStack(
        baseWasmOutput.module._pv_get_error_stack,
        baseWasmOutput.module._pv_free_error_stack,
        baseWasmOutput.messageStackAddressAddressAddress,
        baseWasmOutput.messageStackDepthAddress,
        baseWasmOutput.module.HEAP32,
        baseWasmOutput.module.HEAPU8
      );

      throw pvStatusToException(
        status,
        'EagleProfiler failed to get export size',
        messageStack
      );
    }

    const profileSize =
      baseWasmOutput.module.HEAP32[
        profileSizeAddress / Int32Array.BYTES_PER_ELEMENT
      ];
    baseWasmOutput.module._pv_free(profileSizeAddress);

    const percentageAddress = baseWasmOutput.module._malloc(
      Int32Array.BYTES_PER_ELEMENT
    );
    if (percentageAddress === 0) {
      throw new EagleErrors.EagleOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }

    const profileAddress = baseWasmOutput.module._malloc(
      Uint8Array.BYTES_PER_ELEMENT * profileSize
    );
    if (profileAddress === 0) {
      throw new EagleErrors.EagleOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }

    return {
      ...baseWasmOutput,
      frameLength: frameLength,
      profileSize: profileSize,

      objectAddress: objectAddress,
      percentageAddress: percentageAddress,
      profileAddress: profileAddress,

      pv_eagle_profiler_enroll: pv_eagle_profiler_enroll,
      pv_eagle_profiler_flush: pv_eagle_profiler_flush,
      pv_eagle_profiler_reset: pv_eagle_profiler_reset,
      pv_eagle_profiler_delete: pv_eagle_profiler_delete,
    };
  }
}

/**
 * JavaScript/WebAssembly binding for Eagle Speaker Recognition engine.
 * It processes incoming audio in consecutive frames and emits a similarity score for each enrolled speaker.
 */
export class Eagle extends EagleBase {
  private readonly _pv_eagle_process: pv_eagle_process_type;
  private readonly _pv_eagle_scores_delete: pv_eagle_scores_delete_type;
  private readonly _pv_eagle_delete: pv_eagle_delete_type;

  private readonly _objectAddress: number;
  private readonly _scoresAddressAddress: number;

  private readonly _minProcessSamples: number;

  private constructor(handleWasm: EagleWasmOutput) {
    super(handleWasm);

    this._minProcessSamples = handleWasm.minProcessSamples;

    this._pv_eagle_process = handleWasm.pv_eagle_process;
    this._pv_eagle_scores_delete = handleWasm.pv_eagle_scores_delete;
    this._pv_eagle_delete = handleWasm.pv_eagle_delete;

    this._objectAddress = handleWasm.objectAddress;
    this._scoresAddressAddress = handleWasm.scoresAddressAddress;
  }

  /**
   * Number of audio samples per frame expected by Eagle (i.e. length of the array passed into `.process()`)
   */
  get minProcessSamples(): number {
    return this._minProcessSamples;
  }

  /**
   * Creates an instance of the Picovoice Eagle Speaker Recognition Engine.
   *
   * @param accessKey AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
   * @param model Eagle model options.
   * @param model.base64 The model in base64 string to initialize Eagle.
   * @param model.publicPath The model path relative to the public directory.
   * @param model.customWritePath Custom path to save the model in storage.
   * Set to a different name to use multiple models across `eagle` instances.
   * @param model.forceWrite Flag to overwrite the model in storage even if it exists.
   * @param model.version Version of the model file. Increment to update the model file in storage.
   * @param options Optional configuration arguments.
   * @param options.device String representation of the device (e.g., CPU or GPU) to use. If set to `best`, the most
   * suitable device is selected automatically. If set to `gpu`, the engine uses the first available GPU device. To select a specific
   * GPU device, set this argument to `gpu:${GPU_INDEX}`, where `${GPU_INDEX}` is the index of the target GPU. If set to
   * `cpu`, the engine will run on the CPU with the default number of threads. To specify the number of threads, set this
   * argument to `cpu:${NUM_THREADS}`, where `${NUM_THREADS}` is the desired number of threads.
   * @param options.voiceThreshold Sensitivity threshold for detecting voice.
   *
   * @return An instance of the Eagle engine.
   */
  public static async create(
    accessKey: string,
    model: EagleModel,
    options: EagleOptions = {}
  ): Promise<Eagle> {
    const customWritePath = model.customWritePath
      ? model.customWritePath
      : 'eagle_model';
    const modelPath = await loadModel({ ...model, customWritePath });

    return Eagle._init(
      accessKey,
      modelPath,
      options
    );
  }

  public static async _init(
    accessKey: string,
    modelPath: string,
    options: EagleOptions = {}
  ): Promise<Eagle> {
    if (!isAccessKeyValid(accessKey)) {
      throw new EagleErrors.EagleInvalidArgumentError('Invalid AccessKey');
    }

    let {
      device = "best",
      voiceThreshold = 0.3 // eslint-disable-line
    } = options;

    const isSimd = await simd();
    if (!isSimd) {
      throw new EagleErrors.EagleRuntimeError('Browser not supported.');
    }

    const isWorkerScope =
      typeof WorkerGlobalScope !== 'undefined' &&
      self instanceof WorkerGlobalScope;
    if (
      !isWorkerScope &&
      (device === 'best' || (device.startsWith('cpu') && device !== 'cpu:1'))
    ) {
      // eslint-disable-next-line no-console
      console.warn('Multi-threading is not supported on main thread.');
      device = 'cpu:1';
    }

    const sabDefined = typeof SharedArrayBuffer !== 'undefined'
      && (device !== "cpu:1");

    return new Promise<Eagle>((resolve, reject) => {
      Eagle._eagleMutex
        .runExclusive(async () => {
          const wasmOutput = await Eagle._initWasm(
            accessKey.trim(),
            modelPath.trim(),
            device,
            voiceThreshold,
            sabDefined ? this._wasmPThread : this._wasmSimd,
            sabDefined ? this._wasmPThreadLib : this._wasmSimdLib,
            sabDefined ? createModulePThread : createModuleSimd
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
   * Processes audio and returns a list of similarity scores for each speaker profile.
   *
   * @param pcm Array of audio samples. The minimum number of samples per frame can be attained by calling
   * `.minProcessSamples`. The incoming audio needs to have a sample rate equal to `.sampleRate` and be 16-bit
   * linearly-encoded. Eagle operates on single-channel audio.
   * @param speakerProfiles One or more Eagle speaker profiles. These can be constructed using `EagleProfiler`.
   *
   * @return A list of similarity scores for each speaker profile. A higher score indicates that the voice
   * belongs to the corresponding speaker. The range is [0, 1] with 1.0 representing a perfect match.
   */
  public async process(
    pcm: Int16Array,
    speakerProfiles: EagleProfile[] | EagleProfile,
  ): Promise<number[] | null> {
    if (!(pcm instanceof Int16Array)) {
      throw new EagleErrors.EagleInvalidArgumentError(
        "The argument 'pcm' must be provided as an Int16Array"
      );
    }

    if (pcm.length < this._minProcessSamples) {
      throw new EagleErrors.EagleInvalidArgumentError(
        `Length of input sample (${pcm.length}) is not greater than minimum sample length (${this._minProcessSamples})`
      );
    }

    const profiles = !Array.isArray(speakerProfiles) ? [speakerProfiles] : speakerProfiles;

    if (!profiles || profiles.length === 0) {
      throw new EagleErrors.EagleInvalidArgumentError(
        'No speaker profiles provided'
      );
    }

    return new Promise<number[] | null>((resolve, reject) => {
      this._functionMutex
        .runExclusive(async () => {
          if (this._module === undefined) {
            throw new EagleErrors.EagleInvalidStateError(
              'Attempted to call `.process` after release'
            );
          }

          const pcmAddress = this._module._malloc(
            pcm.length * Int16Array.BYTES_PER_ELEMENT
          );

          this._module.HEAP16.set(
            pcm,
            pcmAddress / Int16Array.BYTES_PER_ELEMENT
          );

          const numSpeakers = profiles.length;
          const profilesAddressAddress = this._module._malloc(
            numSpeakers * Int32Array.BYTES_PER_ELEMENT
          );
          if (profilesAddressAddress === 0) {
            throw new EagleErrors.EagleOutOfMemoryError(
              'malloc failed: Cannot allocate memory'
            );
          }
          const profilesAddressList: number[] = [];
          for (const profile of profiles) {
            const profileAddress = this._module._malloc(
              profile.bytes.length * Uint8Array.BYTES_PER_ELEMENT
            );
            if (profileAddress === 0) {
              throw new EagleErrors.EagleOutOfMemoryError(
                'malloc failed: Cannot allocate memory'
              );
            }
            this._module.HEAPU8.set(profile.bytes, profileAddress);
            profilesAddressList.push(profileAddress);
          }
          this._module.HEAP32.set(
            new Int32Array(profilesAddressList),
            profilesAddressAddress / Int32Array.BYTES_PER_ELEMENT
          );

          const status = await this._pv_eagle_process(
            this._objectAddress,
            pcmAddress,
            pcm.length,
            profilesAddressAddress,
            profiles.length,
            this._scoresAddressAddress
          );

          for (let i = 0; i < profiles.length; i++) {
            this._module._pv_free(profilesAddressList[i]);
          }
          this._module._pv_free(profilesAddressAddress);
          this._module._pv_free(pcmAddress);

          if (status !== PV_STATUS_SUCCESS) {
            const messageStack = await Eagle.getMessageStack(
              this._module._pv_get_error_stack,
              this._module._pv_free_error_stack,
              this._messageStackAddressAddressAddress,
              this._messageStackDepthAddress,
              this._module.HEAP32,
              this._module.HEAPU8
            );

            throw pvStatusToException(
              status,
              'Eagle process failed',
              messageStack
            );
          }

          const scoresAddress = this._module.HEAP32[this._scoresAddressAddress / Int32Array.BYTES_PER_ELEMENT];

          if (scoresAddress) {
            const scores: number[] = [];
            for (let i = 0; i < profiles.length; i++) {
              scores[i] = this._module.HEAPF32[(scoresAddress / Float32Array.BYTES_PER_ELEMENT) + i];
            }
            this._pv_eagle_scores_delete(scoresAddress);
            this._module.HEAP32[this._scoresAddressAddress / Int32Array.BYTES_PER_ELEMENT] = 0;

            return scores;
          } else {
            return null;
          }
        })
        .then((result: number[] | null) => {
          resolve(result);
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
    if (!this._module) {
      return;
    }

    await super.release();
    await this._pv_eagle_delete(this._objectAddress);
    this._module = undefined;
  }

  /**
   * Lists all available devices that Eagle can use for inference.
   * Each entry in the list can be the used as the `device` argument for the `.create` method.
   *
   * @returns List of all available devices that Eagle can use for inference.
   */
  public static async listAvailableDevices(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      Eagle._eagleMutex
        .runExclusive(async () => {
          const isSimd = await simd();
          if (!isSimd) {
            throw new EagleErrors.EagleRuntimeError('Unsupported Browser');
          }

          const blob = new Blob([base64ToUint8Array(this._wasmSimdLib)], {
            type: 'application/javascript',
          });
          const module: EagleModule = await createModuleSimd({
            mainScriptUrlOrBlob: blob,
            wasmBinary: base64ToUint8Array(this._wasmSimd),
          });

          const hardwareDevicesAddressAddress = module._malloc(
            Int32Array.BYTES_PER_ELEMENT
          );
          if (hardwareDevicesAddressAddress === 0) {
            throw new EagleErrors.EagleOutOfMemoryError(
              'malloc failed: Cannot allocate memory for hardwareDevices'
            );
          }

          const numHardwareDevicesAddress = module._malloc(
            Int32Array.BYTES_PER_ELEMENT
          );
          if (numHardwareDevicesAddress === 0) {
            throw new EagleErrors.EagleOutOfMemoryError(
              'malloc failed: Cannot allocate memory for numHardwareDevices'
            );
          }

          const status: PvStatus = module._pv_eagle_list_hardware_devices(
            hardwareDevicesAddressAddress,
            numHardwareDevicesAddress
          );

          const messageStackDepthAddress = module._malloc(
            Int32Array.BYTES_PER_ELEMENT
          );
          if (!messageStackDepthAddress) {
            throw new EagleErrors.EagleOutOfMemoryError(
              'malloc failed: Cannot allocate memory for messageStackDepth'
            );
          }

          const messageStackAddressAddressAddress = module._malloc(
            Int32Array.BYTES_PER_ELEMENT
          );
          if (!messageStackAddressAddressAddress) {
            throw new EagleErrors.EagleOutOfMemoryError(
              'malloc failed: Cannot allocate memory messageStack'
            );
          }

          if (status !== PvStatus.SUCCESS) {
            const messageStack = await Eagle.getMessageStack(
              module._pv_get_error_stack,
              module._pv_free_error_stack,
              messageStackAddressAddressAddress,
              messageStackDepthAddress,
              module.HEAP32,
              module.HEAPU8
            );
            module._pv_free(messageStackAddressAddressAddress);
            module._pv_free(messageStackDepthAddress);

            throw pvStatusToException(
              status,
              'List devices failed',
              messageStack
            );
          }
          module._pv_free(messageStackAddressAddressAddress);
          module._pv_free(messageStackDepthAddress);

          const numHardwareDevices: number =
            module.HEAP32[
              numHardwareDevicesAddress / Int32Array.BYTES_PER_ELEMENT
            ];
          module._pv_free(numHardwareDevicesAddress);

          const hardwareDevicesAddress =
            module.HEAP32[
              hardwareDevicesAddressAddress / Int32Array.BYTES_PER_ELEMENT
            ];

          const hardwareDevices: string[] = [];
          for (let i = 0; i < numHardwareDevices; i++) {
            const deviceAddress =
              module.HEAP32[
                hardwareDevicesAddress / Int32Array.BYTES_PER_ELEMENT + i
              ];
            hardwareDevices.push(
              arrayBufferToStringAtIndex(module.HEAPU8, deviceAddress)
            );
          }
          module._pv_eagle_free_hardware_devices(
            hardwareDevicesAddress,
            numHardwareDevices
          );
          module._pv_free(hardwareDevicesAddressAddress);

          return hardwareDevices;
        })
        .then((result: string[]) => {
          resolve(result);
        })
        .catch((error: any) => {
          reject(error);
        });
    });
  }

  private static async _initWasm(
    accessKey: string,
    modelPath: string,
    device: string,
    voiceThreshold: number,
    wasmBase64: string,
    wasmLibBase64: string,
    createModuleFunc: any
  ): Promise<EagleWasmOutput> {
    const baseWasmOutput = await super._initBaseWasm(
      wasmBase64,
      wasmLibBase64,
      createModuleFunc
    );

    const pv_eagle_init: pv_eagle_init_type = this.wrapAsyncFunction(
      baseWasmOutput.module,
      'pv_eagle_init',
      5
    );
    const pv_eagle_process: pv_eagle_process_type = this.wrapAsyncFunction(
      baseWasmOutput.module,
      'pv_eagle_process',
      5
    );
    const pv_eagle_scores_delete: pv_eagle_scores_delete_type = this.wrapAsyncFunction(
      baseWasmOutput.module,
      'pv_eagle_scores_delete',
      1
    );
    const pv_eagle_delete: pv_eagle_delete_type = this.wrapAsyncFunction(
      baseWasmOutput.module,
      'pv_eagle_delete',
      1
    );

    const objectAddressAddress = baseWasmOutput.module._malloc(
      Int32Array.BYTES_PER_ELEMENT
    );
    if (objectAddressAddress === 0) {
      throw new EagleErrors.EagleOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }

    const accessKeyAddress = baseWasmOutput.module._malloc(
      (accessKey.length + 1) * Uint8Array.BYTES_PER_ELEMENT
    );
    if (accessKeyAddress === 0) {
      throw new EagleErrors.EagleOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }
    for (let i = 0; i < accessKey.length; i++) {
      baseWasmOutput.module.HEAPU8[accessKeyAddress + i] =
        accessKey.charCodeAt(i);
    }
    baseWasmOutput.module.HEAPU8[accessKeyAddress + accessKey.length] = 0;

    const modelPathEncoded = new TextEncoder().encode(modelPath);
    const modelPathAddress = baseWasmOutput.module._malloc(
      (modelPathEncoded.length + 1) * Uint8Array.BYTES_PER_ELEMENT
    );
    if (modelPathAddress === 0) {
      throw new EagleErrors.EagleOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }
    baseWasmOutput.module.HEAPU8.set(modelPathEncoded, modelPathAddress);
    baseWasmOutput.module.HEAPU8[
      modelPathAddress + modelPathEncoded.length
    ] = 0;

    const deviceAddress = baseWasmOutput.module._malloc(
      (device.length + 1) * Uint8Array.BYTES_PER_ELEMENT
    );
    if (deviceAddress === 0) {
      throw new EagleErrors.EagleOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }
    for (let i = 0; i < device.length; i++) {
      baseWasmOutput.module.HEAPU8[deviceAddress + i] = device.charCodeAt(i);
    }
    baseWasmOutput.module.HEAPU8[deviceAddress + device.length] = 0;

    let status = await pv_eagle_init(
      accessKeyAddress,
      modelPathAddress,
      deviceAddress,
      voiceThreshold,
      objectAddressAddress
    );
    baseWasmOutput.module._pv_free(accessKeyAddress);
    baseWasmOutput.module._pv_free(modelPathAddress);
    baseWasmOutput.module._pv_free(deviceAddress);

    if (status !== PV_STATUS_SUCCESS) {
      const messageStack = await Eagle.getMessageStack(
        baseWasmOutput.module._pv_get_error_stack,
        baseWasmOutput.module._pv_free_error_stack,
        baseWasmOutput.messageStackAddressAddressAddress,
        baseWasmOutput.messageStackDepthAddress,
        baseWasmOutput.module.HEAP32,
        baseWasmOutput.module.HEAPU8
      );

      throw pvStatusToException(status, 'Eagle init failed', messageStack);
    }

    const objectAddress =
      baseWasmOutput.module.HEAP32[
        objectAddressAddress / Int32Array.BYTES_PER_ELEMENT
      ];
    baseWasmOutput.module._pv_free(objectAddressAddress);

    const scoresAddressAddress = baseWasmOutput.module._malloc(Int32Array.BYTES_PER_ELEMENT);
    if (scoresAddressAddress === 0) {
      throw new EagleErrors.EagleOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }

    const minProcessSamplesAddress = baseWasmOutput.module._malloc(
      Int32Array.BYTES_PER_ELEMENT
    );
    if (minProcessSamplesAddress === 0) {
      throw new EagleErrors.EagleOutOfMemoryError(
        'malloc failed: Cannot allocate memory'
      );
    }

    status =
      baseWasmOutput.module._pv_eagle_process_min_audio_length_samples(
        objectAddress,
        minProcessSamplesAddress
      );
    if (status !== PV_STATUS_SUCCESS) {
      const messageStack = await EagleProfiler.getMessageStack(
        baseWasmOutput.module._pv_get_error_stack,
        baseWasmOutput.module._pv_free_error_stack,
        baseWasmOutput.messageStackAddressAddressAddress,
        baseWasmOutput.messageStackDepthAddress,
        baseWasmOutput.module.HEAP32,
        baseWasmOutput.module.HEAPU8
      );

      throw pvStatusToException(
        status,
        'EagleProfiler failed to get min process audio length',
        messageStack
      );
    }

    const minProcessSamples =
      baseWasmOutput.module.HEAP32[
        minProcessSamplesAddress / Int32Array.BYTES_PER_ELEMENT
      ];
    baseWasmOutput.module._pv_free(minProcessSamplesAddress);

    return {
      ...baseWasmOutput,
      minProcessSamples: minProcessSamples,
      objectAddress: objectAddress,
      scoresAddressAddress: scoresAddressAddress,

      pv_eagle_process: pv_eagle_process,
      pv_eagle_scores_delete: pv_eagle_scores_delete,
      pv_eagle_delete: pv_eagle_delete,
    };
  }
}
