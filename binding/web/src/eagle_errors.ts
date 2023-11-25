//
// Copyright 2023 Picovoice Inc.
//
// You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
// file accompanying this source.
//
// Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
// an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//

import { PvError } from '@picovoice/web-utils';
import { PvStatus } from './types';

class EagleError extends Error {
  private readonly _status: PvStatus;
  private readonly _shortMessage: string;
  private readonly _messageStack: string[];

  constructor(
    status: PvStatus,
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(EagleError.errorToString(message, messageStack, pvError));
    this._status = status;
    this.name = 'EagleError';
    this._shortMessage = message;
    this._messageStack = messageStack;
  }

  get status(): PvStatus {
    return this._status;
  }

  get shortMessage(): string {
    return this._shortMessage;
  }

  get messageStack(): string[] {
    return this._messageStack;
  }

  private static errorToString(
    initial: string,
    messageStack: string[],
    pvError: PvError | null = null
  ): string {
    let msg = initial;

    if (pvError) {
      const pvErrorMessage = pvError.getErrorString();
      if (pvErrorMessage.length > 0) {
        msg += `\nDetails: ${pvErrorMessage}`;
      }
    }

    if (messageStack.length > 0) {
      msg += `: ${messageStack.reduce(
        (acc, value, index) => acc + '\n  [' + index + '] ' + value,
        ''
      )}`;
    }

    return msg;
  }
}

class EagleOutOfMemoryError extends EagleError {
  constructor(
    message: string,
    messageStack?: string[],
    pvError: PvError | null = null
  ) {
    super(PvStatus.OUT_OF_MEMORY, message, messageStack, pvError);
    this.name = 'EagleOutOfMemoryError';
  }
}

class EagleIOError extends EagleError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.IO_ERROR, message, messageStack, pvError);
    this.name = 'EagleIOError';
  }
}

class EagleInvalidArgumentError extends EagleError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.INVALID_ARGUMENT, message, messageStack, pvError);
    this.name = 'EagleInvalidArgumentError';
  }
}

class EagleStopIterationError extends EagleError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.STOP_ITERATION, message, messageStack, pvError);
    this.name = 'EagleStopIterationError';
  }
}

class EagleKeyError extends EagleError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.KEY_ERROR, message, messageStack, pvError);
    this.name = 'EagleKeyError';
  }
}

class EagleInvalidStateError extends EagleError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.INVALID_STATE, message, messageStack, pvError);
    this.name = 'EagleInvalidStateError';
  }
}

class EagleRuntimeError extends EagleError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.RUNTIME_ERROR, message, messageStack, pvError);
    this.name = 'EagleRuntimeError';
  }
}

class EagleActivationError extends EagleError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.ACTIVATION_ERROR, message, messageStack, pvError);
    this.name = 'EagleActivationError';
  }
}

class EagleActivationLimitReachedError extends EagleError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.ACTIVATION_LIMIT_REACHED, message, messageStack, pvError);
    this.name = 'EagleActivationLimitReachedError';
  }
}

class EagleActivationThrottledError extends EagleError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.ACTIVATION_THROTTLED, message, messageStack, pvError);
    this.name = 'EagleActivationThrottledError';
  }
}

class EagleActivationRefusedError extends EagleError {
  constructor(
    message: string,
    messageStack: string[] = [],
    pvError: PvError | null = null
  ) {
    super(PvStatus.ACTIVATION_REFUSED, message, messageStack, pvError);
    this.name = 'EagleActivationRefusedError';
  }
}

export {
  EagleError,
  EagleOutOfMemoryError,
  EagleIOError,
  EagleInvalidArgumentError,
  EagleStopIterationError,
  EagleKeyError,
  EagleInvalidStateError,
  EagleRuntimeError,
  EagleActivationError,
  EagleActivationLimitReachedError,
  EagleActivationThrottledError,
  EagleActivationRefusedError,
};

export function pvStatusToException(
  pvStatus: PvStatus,
  errorMessage: string,
  messageStack: string[] = [],
  pvError: PvError | null = null
): EagleError {
  switch (pvStatus) {
    case PvStatus.OUT_OF_MEMORY:
      return new EagleOutOfMemoryError(errorMessage, messageStack, pvError);
    case PvStatus.IO_ERROR:
      return new EagleIOError(errorMessage, messageStack, pvError);
    case PvStatus.INVALID_ARGUMENT:
      return new EagleInvalidArgumentError(errorMessage, messageStack, pvError);
    case PvStatus.STOP_ITERATION:
      return new EagleStopIterationError(errorMessage, messageStack, pvError);
    case PvStatus.KEY_ERROR:
      return new EagleKeyError(errorMessage, messageStack, pvError);
    case PvStatus.INVALID_STATE:
      return new EagleInvalidStateError(errorMessage, messageStack, pvError);
    case PvStatus.RUNTIME_ERROR:
      return new EagleRuntimeError(errorMessage, messageStack, pvError);
    case PvStatus.ACTIVATION_ERROR:
      return new EagleActivationError(errorMessage, messageStack, pvError);
    case PvStatus.ACTIVATION_LIMIT_REACHED:
      return new EagleActivationLimitReachedError(
        errorMessage,
        messageStack,
        pvError
      );
    case PvStatus.ACTIVATION_THROTTLED:
      return new EagleActivationThrottledError(
        errorMessage,
        messageStack,
        pvError
      );
    case PvStatus.ACTIVATION_REFUSED:
      return new EagleActivationRefusedError(
        errorMessage,
        messageStack,
        pvError
      );
    default:
      // eslint-disable-next-line no-console
      console.warn(`Unmapped error code: ${pvStatus}`);
      return new EagleError(pvStatus, errorMessage);
  }
}
