/*
  Copyright 2023 Picovoice Inc.

  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
  file accompanying this source.

  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
  specific language governing permissions and limitations under the License.
*/

import PvWorker from 'web-worker:./eagle_profiler_worker_handler.ts';

import {
  EagleModel,
  EagleProfile,
  EagleProfilerEnrollResult,
  EagleProfilerWorkerEnrollResponse,
  EagleProfilerWorkerExportResponse,
  EagleProfilerWorkerInitResponse,
  EagleProfilerWorkerReleaseResponse,
  EagleProfilerWorkerResetResponse,
} from './types';
import { loadModel } from '@picovoice/web-utils';
import { pvStatusToException } from "./eagle_errors";

export class EagleProfilerWorker {
  private readonly _worker: Worker;
  private readonly _minEnrollSamples: number;
  private readonly _sampleRate: number;
  private readonly _version: string;

  private static _wasm: string;
  private static _wasmSimd: string;
  private static _sdk: string = "web";

  private constructor(
    worker: Worker,
    minEnrollSamples: number,
    sampleRate: number,
    version: string
  ) {
    this._worker = worker;
    this._minEnrollSamples = minEnrollSamples;
    this._sampleRate = sampleRate;
    this._version = version;
  }

  /**
   * The minimum length of the input pcm required by `.enroll()`.
   */
  get minEnrollSamples(): number {
    return this._minEnrollSamples;
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

  public static setSdk(sdk: string): void {
    EagleProfilerWorker._sdk = sdk;
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
  ): Promise<EagleProfilerWorker> {
    const customWritePath = model.customWritePath
      ? model.customWritePath
      : 'eagle_model';
    const modelPath = await loadModel({ ...model, customWritePath });

    const worker = new PvWorker();
    const returnPromise: Promise<EagleProfilerWorker> = new Promise(
      (resolve, reject) => {
        // @ts-ignore - block from GC
        this.worker = worker;
        worker.onmessage = (
          event: MessageEvent<EagleProfilerWorkerInitResponse>
        ): void => {
          switch (event.data.command) {
            case 'ok':
              resolve(
                new EagleProfilerWorker(
                  worker,
                  event.data.minEnrollSamples,
                  event.data.sampleRate,
                  event.data.version
                )
              );
              break;
            case 'failed':
            case 'error':
              reject(pvStatusToException(event.data.status, event.data.shortMessage, event.data.messageStack));
              break;
            default:
              // @ts-ignore
              reject(pvStatusToException(PvStatus.RUNTIME_ERROR, `Unrecognized command: ${event.data.command}`));
          }
        };
      }
    );

    worker.postMessage({
      command: 'init',
      accessKey: accessKey,
      modelPath: modelPath,
      wasm: this._wasm,
      wasmSimd: this._wasmSimd,
      sdk: this._sdk,
    });

    return returnPromise;
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
  public enroll(pcm: Int16Array): Promise<EagleProfilerEnrollResult> {
    const returnPromise: Promise<EagleProfilerEnrollResult> = new Promise(
      (resolve, reject) => {
        this._worker.onmessage = (
          event: MessageEvent<EagleProfilerWorkerEnrollResponse>
        ): void => {
          switch (event.data.command) {
            case 'ok':
              resolve(event.data.result);
              break;
            case 'failed':
            case 'error':
              reject(pvStatusToException(event.data.status, event.data.shortMessage, event.data.messageStack));
              break;
            default:
              // @ts-ignore
              reject(pvStatusToException(PvStatus.RUNTIME_ERROR, `Unrecognized command: ${event.data.command}`));
          }
        };
      }
    );

    this._worker.postMessage({
      command: 'enroll',
      inputFrame: pcm,
    });

    return returnPromise;
  }

  /**
   * Exports the speaker profile of the current session.
   * Will throw error if the profile is not ready.
   *
   * @return An EagleProfile object.
   */
  public async export(): Promise<EagleProfile> {
    const returnPromise: Promise<EagleProfile> = new Promise(
      (resolve, reject) => {
        this._worker.onmessage = (
          event: MessageEvent<EagleProfilerWorkerExportResponse>
        ): void => {
          switch (event.data.command) {
            case 'ok':
              resolve(event.data.profile);
              break;
            case 'failed':
            case 'error':
              reject(pvStatusToException(event.data.status, event.data.shortMessage, event.data.messageStack));
              break;
            default:
              // @ts-ignore
              reject(pvStatusToException(PvStatus.RUNTIME_ERROR, `Unrecognized command: ${event.data.command}`));
          }
        };
      }
    );
    this._worker.postMessage({
      command: 'export',
    });

    return returnPromise;
  }

  /**
   * Resets the internal state of Eagle Profiler.
   * It should be called before starting a new enrollment session.
   */
  public async reset(): Promise<void> {
    const returnPromise: Promise<void> = new Promise((resolve, reject) => {
      this._worker.onmessage = (
        event: MessageEvent<EagleProfilerWorkerResetResponse>
      ): void => {
        switch (event.data.command) {
          case 'ok':
            resolve();
            break;
          case 'failed':
          case 'error':
            reject(pvStatusToException(event.data.status, event.data.shortMessage, event.data.messageStack));
            break;
          default:
            // @ts-ignore
            reject(pvStatusToException(PvStatus.RUNTIME_ERROR, `Unrecognized command: ${event.data.command}`));
        }
      };
    });
    this._worker.postMessage({
      command: 'reset',
    });

    return returnPromise;
  }

  /**
   * Releases resources acquired by Eagle Profiler
   */
  public release(): Promise<void> {
    const returnPromise: Promise<void> = new Promise((resolve, reject) => {
      this._worker.onmessage = (
        event: MessageEvent<EagleProfilerWorkerReleaseResponse>
      ): void => {
        switch (event.data.command) {
          case 'ok':
            resolve();
            break;
          case 'failed':
          case 'error':
            reject(pvStatusToException(event.data.status, event.data.shortMessage, event.data.messageStack));
            break;
          default:
            // @ts-ignore
            reject(pvStatusToException(PvStatus.RUNTIME_ERROR, `Unrecognized command: ${event.data.command}`));
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
