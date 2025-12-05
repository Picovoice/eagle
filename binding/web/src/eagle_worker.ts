/*
  Copyright 2023-2025 Picovoice Inc.

  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.

  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

import PvWorker from 'web-worker:./eagle_worker_handler.ts';

import {
  EagleModel,
  EagleOptions,
  EagleWorkerProcessResponse,
  EagleWorkerInitResponse,
  EagleWorkerReleaseResponse,
  EagleWorkerResetResponse,
  EagleProfile,
  PvStatus,
} from './types';
import { loadModel } from '@picovoice/web-utils';
import { pvStatusToException } from "./eagle_errors";

export class EagleWorker {
  private readonly _worker: Worker;
  private readonly _frameLength: number;
  private readonly _sampleRate: number;
  private readonly _version: string;

  private static _wasmSimd: string;
  private static _wasmSimdLib: string;
  private static _wasmPThread: string;
  private static _wasmPThreadLib: string;

  private static _sdk: string = 'web';

  private constructor(
    worker: Worker,
    frameLength: number,
    sampleRate: number,
    version: string
  ) {
    this._worker = worker;
    this._frameLength = frameLength;
    this._sampleRate = sampleRate;
    this._version = version;
  }

  /**
   * Number of audio samples per frame expected by Eagle (i.e. length of the array passed into `.process()`)
   */
  get frameLength(): number {
    return this._frameLength;
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
   * @param wasmSimd Base64'd wasm SIMD file to use to initialize wasm.
   */
  public static setWasmSimd(wasmSimd: string): void {
    if (this._wasmSimd === undefined) {
      this._wasmSimd = wasmSimd;
    }
  }

  /**
   * Set base64 wasm file with SIMD feature in text format.
   * @param wasmSimdLib Base64'd wasm SIMD file in text format.
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
    EagleWorker._sdk = sdk;
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
   * @param speakerProfiles One or more Eagle speaker profiles. These can be constructed using `EagleProfiler`.
   * @param options Optional configuration arguments.
   * @param options.device String representation of the device (e.g., CPU or GPU) to use. If set to `best`, the most
   * suitable device is selected automatically. If set to `gpu`, the engine uses the first available GPU device. To select a specific
   * GPU device, set this argument to `gpu:${GPU_INDEX}`, where `${GPU_INDEX}` is the index of the target GPU. If set to
   * `cpu`, the engine will run on the CPU with the default number of threads. To specify the number of threads, set this
   * argument to `cpu:${NUM_THREADS}`, where `${NUM_THREADS}` is the desired number of threads.
   *
   * @return An instance of the Eagle engine.
   */
  public static async create(
    accessKey: string,
    model: EagleModel,
    speakerProfiles: EagleProfile[] | EagleProfile,
    options: EagleOptions = {}
  ): Promise<EagleWorker> {
    const customWritePath = model.customWritePath
      ? model.customWritePath
      : 'eagle_model';
    const modelPath = await loadModel({ ...model, customWritePath });

    const worker = new PvWorker();
    const returnPromise: Promise<EagleWorker> = new Promise(
      (resolve, reject) => {
        // @ts-ignore - block from GC
        this.worker = worker;
        worker.onmessage = (
          event: MessageEvent<EagleWorkerInitResponse>
        ): void => {
          switch (event.data.command) {
            case 'ok':
              resolve(
                new EagleWorker(
                  worker,
                  event.data.frameLength,
                  event.data.sampleRate,
                  event.data.version
                )
              );
              break;
            case 'failed':
            case 'error':
              reject(
                pvStatusToException(
                  event.data.status,
                  event.data.shortMessage,
                  event.data.messageStack
                )
              );
              break;
            default:
              reject(
                pvStatusToException(
                  PvStatus.RUNTIME_ERROR,
                  // @ts-ignore
                  `Unrecognized command: ${event.data.command}`
                )
              );
          }
        };
      }
    );

    worker.postMessage({
      command: 'init',
      accessKey: accessKey,
      modelPath: modelPath,
      speakerProfiles: !Array.isArray(speakerProfiles)
        ? [speakerProfiles]
        : speakerProfiles,
      options: options,
      wasmSimd: this._wasmSimd,
      wasmSimdLib: this._wasmSimdLib,
      wasmPThread: this._wasmPThread,
      wasmPThreadLib: this._wasmPThreadLib,
      sdk: this._sdk,
    });

    return returnPromise;
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
  public process(pcm: Int16Array): Promise<number[]> {
    const returnPromise: Promise<number[]> = new Promise((resolve, reject) => {
      this._worker.onmessage = (
        event: MessageEvent<EagleWorkerProcessResponse>
      ): void => {
        switch (event.data.command) {
          case 'ok':
            resolve(event.data.scores);
            break;
          case 'failed':
          case 'error':
            reject(
              pvStatusToException(
                event.data.status,
                event.data.shortMessage,
                event.data.messageStack
              )
            );
            break;
          default:
            reject(
              pvStatusToException(
                PvStatus.RUNTIME_ERROR,
                // @ts-ignore
                `Unrecognized command: ${event.data.command}`
              )
            );
        }
      };
    });
    this._worker.postMessage({
      command: 'process',
      inputFrame: pcm,
    });

    return returnPromise;
  }

  /**
   * Resets the internal state of the engine.
   * It is best to call before processing a new sequence of audio (e.g. a new voice interaction).
   * This ensures that the accuracy of the engine is not affected by a change in audio context.
   */
  public async reset(): Promise<void> {
    const returnPromise: Promise<void> = new Promise((resolve, reject) => {
      this._worker.onmessage = (
        event: MessageEvent<EagleWorkerResetResponse>
      ): void => {
        switch (event.data.command) {
          case 'ok':
            resolve();
            break;
          case 'failed':
          case 'error':
            reject(
              pvStatusToException(
                event.data.status,
                event.data.shortMessage,
                event.data.messageStack
              )
            );
            break;
          default:
            reject(
              pvStatusToException(
                PvStatus.RUNTIME_ERROR,
                // @ts-ignore
                `Unrecognized command: ${event.data.command}`
              )
            );
        }
      };
    });
    this._worker.postMessage({
      command: 'reset',
    });

    return returnPromise;
  }

  /**
   * Releases resources acquired by Eagle
   */
  public release(): Promise<void> {
    const returnPromise: Promise<void> = new Promise((resolve, reject) => {
      this._worker.onmessage = (
        event: MessageEvent<EagleWorkerReleaseResponse>
      ): void => {
        switch (event.data.command) {
          case 'ok':
            resolve();
            break;
          case 'failed':
          case 'error':
            reject(
              pvStatusToException(
                event.data.status,
                event.data.shortMessage,
                event.data.messageStack
              )
            );
            break;
          default:
            reject(
              pvStatusToException(
                PvStatus.RUNTIME_ERROR,
                // @ts-ignore
                `Unrecognized command: ${event.data.command}`
              )
            );
        }
      };
    });

    this._worker.postMessage({
      command: 'release',
    });

    return returnPromise;
  }

  /**
   * Terminates the active worker. Stops all requests being handled by worker.
   */
  public terminate(): void {
    this._worker.terminate();
  }
}
