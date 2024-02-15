//
// Copyright 2024 Picovoice Inc.
//
// You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
// file accompanying this source.
//
// Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
// an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//
'use strict';

import PvStatus from './pv_status_t';

export class EagleError extends Error {
  private readonly _message: string;
  private readonly _messageStack: string[];

  constructor(message: string, messageStack: string[] = []) {
    super(EagleError.errorToString(message, messageStack));
    this._message = message;
    this._messageStack = messageStack;
  }

  get message(): string {
    return this._message;
  }

  get messageStack(): string[] {
    return this._messageStack;
  }

  private static errorToString(
    initial: string,
    messageStack: string[]
  ): string {
    let msg = initial;

    if (messageStack.length > 0) {
      msg += `: ${messageStack.reduce((acc, value, index) =>
        acc + '\n  [' + index + '] ' + value, '')}`;
    }

    return msg;
  }
}

export class EagleOutOfMemoryError extends EagleError {}
export class EagleIOError extends EagleError {}
export class EagleInvalidArgumentError extends EagleError {}
export class EagleStopIterationError extends EagleError {}
export class EagleKeyError extends EagleError {}
export class EagleInvalidStateError extends EagleError {}
export class EagleRuntimeError extends EagleError {}
export class EagleActivationError extends EagleError {}
export class EagleActivationLimitReachedError extends EagleError {}
export class EagleActivationThrottledError extends EagleError {}
export class EagleActivationRefusedError extends EagleError {}

export function pvStatusToException(
  pvStatus: PvStatus,
  errorMessage: string,
  messageStack: string[] = []
): EagleError {
  switch (pvStatus) {
    case PvStatus.OUT_OF_MEMORY:
      throw new EagleOutOfMemoryError(errorMessage, messageStack);
    case PvStatus.IO_ERROR:
      throw new EagleIOError(errorMessage, messageStack);
    case PvStatus.INVALID_ARGUMENT:
      throw new EagleInvalidArgumentError(errorMessage, messageStack);
    case PvStatus.STOP_ITERATION:
      throw new EagleStopIterationError(errorMessage, messageStack);
    case PvStatus.KEY_ERROR:
      throw new EagleKeyError(errorMessage, messageStack);
    case PvStatus.INVALID_STATE:
      throw new EagleInvalidStateError(errorMessage, messageStack);
    case PvStatus.RUNTIME_ERROR:
      throw new EagleRuntimeError(errorMessage, messageStack);
    case PvStatus.ACTIVATION_ERROR:
      throw new EagleActivationError(errorMessage, messageStack);
    case PvStatus.ACTIVATION_LIMIT_REACHED:
      throw new EagleActivationLimitReachedError(errorMessage, messageStack);
    case PvStatus.ACTIVATION_THROTTLED:
      throw new EagleActivationThrottledError(errorMessage, messageStack);
    case PvStatus.ACTIVATION_REFUSED:
      throw new EagleActivationRefusedError(errorMessage, messageStack);
    default:
      // eslint-disable-next-line no-console
      console.warn(`Unmapped error code: ${pvStatus}`);
      throw new EagleError(errorMessage, messageStack);
  }
}
