#
# Copyright 2023 Picovoice Inc.
#
# You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
# file accompanying this source.
#
# Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
# an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.
#

import os
from ctypes import *
from enum import Enum
from typing import Sequence, Tuple


class EagleError(Exception):
    def __init__(self, message: str = "", message_stack: Sequence[str] = None):
        super().__init__(message)

        self._message = message
        self._message_stack = list() if message_stack is None else message_stack

    def __str__(self):
        message = self._message
        if len(self._message_stack) > 0:
            message += ":"
            for i in range(len(self._message_stack)):
                message += "\n  [%d] %s" % (i, self._message_stack[i])
        return message

    @property
    def message(self) -> str:
        return self._message

    @property
    def message_stack(self) -> Sequence[str]:
        return self._message_stack


class EagleMemoryError(EagleError):
    pass


class EagleIOError(EagleError):
    pass


class EagleInvalidArgumentError(EagleError):
    pass


class EagleStopIterationError(EagleError):
    pass


class EagleKeyError(EagleError):
    pass


class EagleInvalidStateError(EagleError):
    pass


class EagleRuntimeError(EagleError):
    pass


class EagleActivationError(EagleError):
    pass


class EagleActivationLimitError(EagleError):
    pass


class EagleActivationThrottledError(EagleError):
    pass


class EagleActivationRefusedError(EagleError):
    pass


class PicovoiceStatuses(Enum):
    SUCCESS = 0
    OUT_OF_MEMORY = 1
    IO_ERROR = 2
    INVALID_ARGUMENT = 3
    STOP_ITERATION = 4
    KEY_ERROR = 5
    INVALID_STATE = 6
    RUNTIME_ERROR = 7
    ACTIVATION_ERROR = 8
    ACTIVATION_LIMIT_REACHED = 9
    ACTIVATION_THROTTLED = 10
    ACTIVATION_REFUSED = 11


_PICOVOICE_STATUS_TO_EXCEPTION = {
    PicovoiceStatuses.OUT_OF_MEMORY: EagleMemoryError,
    PicovoiceStatuses.IO_ERROR: EagleIOError,
    PicovoiceStatuses.INVALID_ARGUMENT: EagleInvalidArgumentError,
    PicovoiceStatuses.STOP_ITERATION: EagleStopIterationError,
    PicovoiceStatuses.KEY_ERROR: EagleKeyError,
    PicovoiceStatuses.INVALID_STATE: EagleInvalidStateError,
    PicovoiceStatuses.RUNTIME_ERROR: EagleRuntimeError,
    PicovoiceStatuses.ACTIVATION_ERROR: EagleActivationError,
    PicovoiceStatuses.ACTIVATION_LIMIT_REACHED: EagleActivationLimitError,
    PicovoiceStatuses.ACTIVATION_THROTTLED: EagleActivationThrottledError,
    PicovoiceStatuses.ACTIVATION_REFUSED: EagleActivationRefusedError,
}


class EagleProfile(object):
    """
    Python representation of an Eagle speaker profile.
    """

    def __init__(self, handle: c_void_p, size: int) -> None:
        self._handle = handle
        self._size = size

    @property
    def handle(self) -> c_void_p:
        return self._handle

    @property
    def size(self) -> int:
        """
        Size of the profile in bytes.
        """

        return self._size

    def to_bytes(self) -> bytes:
        """
        Converts the profile to a bytes object.

        :return: the profile as a bytes object.
        """

        return self._to_bytes(self.handle, self.size)

    @classmethod
    def from_bytes(cls, profile: bytes) -> "EagleProfile":
        """
        Creates an instance of EagleProfile from a bytes object.

        :param profile: The profile as a bytes object.
        :return: An instance of EagleProfile.
        """

        byte_ptr = (c_byte * len(profile)).from_buffer_copy(profile)
        handle = cast(byte_ptr, c_void_p)
        return cls(handle=handle, size=len(profile))

    @staticmethod
    def _to_bytes(ptr: c_void_p, size: int) -> bytes:
        # noinspection PyTypeChecker
        return bytes(cast(ptr, POINTER(c_byte * size)).contents)


class EagleProfilerEnrollFeedback(Enum):
    """
    Enumeration of possible enrollment feedback codes.
    """

    AUDIO_OK = 0
    AUDIO_TOO_SHORT = 1
    UNKNOWN_SPEAKER = 2
    NO_VOICE_FOUND = 3
    QUALITY_ISSUE = 4


class EagleProfiler(object):
    """
    Python binding for the profiler of the Eagle speaker recognition engine.
    It enrolls a speaker given a set of utterances and then constructs a profile for the enrolled speaker.
    """

    class CEagleProfiler(Structure):
        pass

    def __init__(self, access_key: str, model_path: str, library_path: str) -> None:
        """
        Constructor.

        :param access_key: AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
        :param model_path: Absolute path to file containing model parameters (.pv file).
        :param library_path: Absolute path to Eagle's dynamic library.
        """

        if not isinstance(access_key, str) or len(access_key) == 0:
            raise EagleInvalidArgumentError("`access_key` should be a non-empty string.")

        if not os.path.exists(model_path):
            raise EagleIOError("Could not find model file at `%s`." % model_path)

        if not os.path.exists(library_path):
            raise EagleIOError("Could not find Eagle's dynamic library at `%s`." % library_path)

        library = cdll.LoadLibrary(library_path)

        set_sdk_func = library.pv_set_sdk
        set_sdk_func.argtypes = [c_char_p]
        set_sdk_func.restype = None

        set_sdk_func("python".encode("utf-8"))

        self._get_error_stack_func = library.pv_get_error_stack
        self._get_error_stack_func.argtypes = [
            POINTER(POINTER(c_char_p)),
            POINTER(c_int)
        ]
        self._get_error_stack_func.restype = PicovoiceStatuses

        self._free_error_stack_func = library.pv_free_error_stack
        self._free_error_stack_func.argtypes = [POINTER(c_char_p)]
        self._free_error_stack_func.restype = None

        # noinspection PyArgumentList
        self._eagle_profiler = POINTER(self.CEagleProfiler)()

        init_func = library.pv_eagle_profiler_init
        init_func.argtypes = [
            c_char_p,
            c_char_p,
            POINTER(POINTER(self.CEagleProfiler)),
        ]
        init_func.restype = PicovoiceStatuses

        status = init_func(
            access_key.encode("utf-8"),
            model_path.encode("utf-8"),
            byref(self._eagle_profiler),
        )
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status](
                message="Profile initialization failed",
                message_stack=self._get_error_stack(),
            )

        speaker_profile_size_func = library.pv_eagle_profiler_export_size
        speaker_profile_size_func.argtypes = [
            POINTER(self.CEagleProfiler),
            POINTER(c_int32),
        ]
        speaker_profile_size_func.restype = PicovoiceStatuses

        profile_size = c_int32()
        status = speaker_profile_size_func(self._eagle_profiler, byref(profile_size))
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status](
                message="Failed to get profile size",
                message_stack=self._get_error_stack(),
            )
        self._profile_size = profile_size.value

        enroll_min_audio_length_sample_func = library.pv_eagle_profiler_enroll_min_audio_length_samples
        enroll_min_audio_length_sample_func.argtypes = [
            POINTER(self.CEagleProfiler),
            POINTER(c_int32),
        ]
        enroll_min_audio_length_sample_func.restype = PicovoiceStatuses

        min_enroll_samples = c_int32()
        status = enroll_min_audio_length_sample_func(self._eagle_profiler, byref(min_enroll_samples))
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status](
                message="Failed to get min audio length sample",
                message_stack=self._get_error_stack(),
            )
        self._min_enroll_samples = min_enroll_samples.value

        self._delete_func = library.pv_eagle_profiler_delete
        self._delete_func.argtypes = [POINTER(self.CEagleProfiler)]
        self._delete_func.restype = None

        self._enroll_func = library.pv_eagle_profiler_enroll
        self._enroll_func.argtypes = [
            POINTER(self.CEagleProfiler),
            POINTER(c_int16),
            c_int32,
            POINTER(c_int),
            POINTER(c_float),
        ]
        self._enroll_func.restype = PicovoiceStatuses

        self._reset_func = library.pv_eagle_profiler_reset
        self._reset_func.argtypes = [POINTER(self.CEagleProfiler)]
        self._reset_func.restype = PicovoiceStatuses

        self._export_func = library.pv_eagle_profiler_export
        self._export_func.argtypes = [
            POINTER(self.CEagleProfiler),
            c_void_p,
        ]
        self._export_func.restype = PicovoiceStatuses

        self._sample_rate = library.pv_sample_rate()

        self._frame_length = library.pv_eagle_frame_length()

        version_func = library.pv_eagle_version
        version_func.argtypes = []
        version_func.restype = c_char_p
        self._version = version_func().decode("utf-8")

    def enroll(self, pcm: Sequence[int]) -> Tuple[float, EagleProfilerEnrollFeedback]:
        """
        Enrolls a speaker. This function should be called multiple times with different utterances of the same speaker
        until `percentage` reaches `100.0`. Any further enrollment can be used to improve the speaker voice profile.
        The minimum number of required samples can be obtained by calling `.min_enroll_samples`.
        The audio data used for enrollment should satisfy the following requirements:
            - only one speaker should be present in the audio
            - the speaker should be speaking in a normal voice
            - the audio should contain no speech from other speakers and no other sounds (e.g. music)
            - it should be captured in a quiet environment with no background noise

        :param pcm: Audio data. The audio needs to have a sample rate equal to `.sample_rate` and be
        16-bit linearly-encoded. EagleProfiler operates on single-channel audio.
        :return: The percentage of completeness of the speaker enrollment process along with the feedback code
        corresponding to the last enrollment attempt:
            - `AUDIO_OK`: The audio is good for enrollment.
            - `AUDIO_TOO_SHORT`: Audio length is insufficient for enrollment,
            i.e. it is shorter than`.min_enroll_samples`.
            - `UNKNOWN_SPEAKER`: There is another speaker in the audio that is different from the speaker
            being enrolled. Too much background noise may cause this error as well.
            - `NO_VOICE_FOUND`: The audio does not contain any voice, i.e. it is silent or
            has a low signal-to-noise ratio.
            - `QUALITY_ISSUE`: The audio quality is too low for enrollment due to a bad microphone
            or recording environment.
        """

        frame_type = c_int16 * len(pcm)
        c_pcm = frame_type(*pcm)

        feedback_code = c_int()
        percentage = c_float()
        status = self._enroll_func(
            self._eagle_profiler,
            c_pcm,
            len(c_pcm),
            byref(feedback_code),
            byref(percentage))
        feedback = EagleProfilerEnrollFeedback(feedback_code.value)
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status](
                message="Enrollment failed",
                message_stack=self._get_error_stack(),
            )

        return percentage.value, feedback

    def export(self) -> EagleProfile:
        """
        Exports the speaker profile of the current session.
        Will raise an exception if the profile is not ready.

        :return: An immutable EagleProfile object.
        """

        profile = (c_byte * self._profile_size)()
        status = self._export_func(
            self._eagle_profiler,
            byref(profile),
        )
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status](
                message="Export failed",
                message_stack=self._get_error_stack(),
            )

        return EagleProfile(cast(profile, c_void_p), self._profile_size)

    def reset(self) -> None:
        """
        Resets the internal state of Eagle Profiler.
        It should be called before starting a new enrollment session.
        """

        status = self._reset_func(self._eagle_profiler)
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status](
                message="Profile reset failed",
                message_stack=self._get_error_stack(),
            )

    def delete(self) -> None:
        """
        Releases resources acquired by Eagle Profiler.
        """

        self._delete_func(self._eagle_profiler)

    @property
    def min_enroll_samples(self) -> int:
        """
        The minimum length of the input pcm required by `.enroll()`.
        """

        return self._min_enroll_samples

    @property
    def sample_rate(self) -> int:
        """
        Audio sample rate accepted by `.enroll()`.
        """

        return self._sample_rate

    @property
    def version(self) -> str:
        """
        Version of Eagle Profiler.
        """

        return self._version

    def _get_error_stack(self) -> Sequence[str]:
        message_stack_ref = POINTER(c_char_p)()
        message_stack_depth = c_int()
        status = self._get_error_stack_func(byref(message_stack_ref), byref(message_stack_depth))
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status](message="Unable to get Eagle error state")

        message_stack = list()
        for i in range(message_stack_depth.value):
            message_stack.append(message_stack_ref[i].decode("utf-8"))

        self._free_error_stack_func(message_stack_ref)

        return message_stack


class Eagle(object):
    """
    Python binding for Eagle speaker recognition engine.
    It processes incoming audio in consecutive frames and emits a similarity score for each enrolled speaker.
    """

    class CEagle(Structure):
        pass

    def __init__(
            self,
            access_key: str,
            model_path: str,
            library_path: str,
            speaker_profiles: Sequence[EagleProfile]) -> None:
        """
        Constructor.

        :param access_key: AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
        :param model_path: Absolute path to file containing model parameters (.pv file).
        :param library_path: Absolute path to Eagle's dynamic library.
        :param speaker_profiles: A list of EagleProfile objects. This can be constructed using `EagleProfiler`.
        """

        if len(access_key) == 0:
            raise EagleInvalidArgumentError("`access_key` should be a non-empty string.")

        if not os.path.exists(model_path):
            raise EagleIOError("Could not find model file at `%s`." % model_path)

        if not os.path.exists(library_path):
            raise EagleIOError("Could not find Eagle's dynamic library at `%s`." % library_path)

        if len(speaker_profiles) == 0:
            raise EagleInvalidArgumentError("Eagle requires at least one speaker profile.")

        library = cdll.LoadLibrary(library_path)

        set_sdk_func = library.pv_set_sdk
        set_sdk_func.argtypes = [c_char_p]
        set_sdk_func.restype = None

        set_sdk_func("python".encode("utf-8"))

        self._get_error_stack_func = library.pv_get_error_stack
        self._get_error_stack_func.argtypes = [
            POINTER(POINTER(c_char_p)),
            POINTER(c_int),
        ]
        self._get_error_stack_func.restype = PicovoiceStatuses

        self._free_error_stack_func = library.pv_free_error_stack
        self._free_error_stack_func.argtypes = [POINTER(c_char_p)]
        self._free_error_stack_func.restype = None

        # noinspection PyArgumentList
        self._eagle = POINTER(self.CEagle)()

        init_func = library.pv_eagle_init
        init_func.argtypes = [
            c_char_p,
            c_char_p,
            c_int32,
            POINTER(c_void_p),
            POINTER(POINTER(self.CEagle)),
        ]
        init_func.restype = PicovoiceStatuses

        profile_bytes = (c_void_p * len(speaker_profiles))()
        for i, profile in enumerate(speaker_profiles):
            profile_bytes[i] = profile.handle

        status = init_func(
            access_key.encode("utf-8"),
            model_path.encode("utf-8"),
            len(speaker_profiles),
            profile_bytes,
            byref(self._eagle),
        )
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status](
                message="Initialization failed",
                message_stack=self._get_error_stack(),
            )

        self._delete_func = library.pv_eagle_delete
        self._delete_func.argtypes = [POINTER(self.CEagle)]
        self._delete_func.restype = None

        self._process_func = library.pv_eagle_process
        self._process_func.argtypes = [
            POINTER(self.CEagle),
            POINTER(c_int16),
            POINTER(c_float),
        ]
        self._process_func.restype = PicovoiceStatuses

        self._scores = (c_float * len(speaker_profiles))()

        self._reset_func = library.pv_eagle_reset
        self._reset_func.argtypes = [POINTER(self.CEagle)]
        self._reset_func.restype = PicovoiceStatuses

        self._sample_rate = library.pv_sample_rate()

        self._frame_length = library.pv_eagle_frame_length()

        version_func = library.pv_eagle_version
        version_func.argtypes = []
        version_func.restype = c_char_p
        self._version = version_func().decode("utf-8")

    def process(self, pcm: Sequence[int]) -> Sequence[float]:
        """
        Processes a frame of audio and returns a list of similarity scores for each speaker profile.

        :param pcm: A frame of audio samples. The number of samples per frame can be attained by calling
        `.frame_length`. The incoming audio needs to have a sample rate equal to `.sample_rate` and be 16-bit
        linearly-encoded. Eagle operates on single-channel audio.
        :return: A list of similarity scores for each speaker profile. A higher score indicates that the voice
        belongs to the corresponding speaker. The range is [0, 1] with 1.0 representing a perfect match.
        """

        if len(pcm) != self.frame_length:
            raise EagleInvalidArgumentError(
                "Length of input frame %d does not match required frame length %d" % (len(pcm), self.frame_length)
            )

        frame_type = c_int16 * self.frame_length
        pcm = frame_type(*pcm)

        status = self._process_func(self._eagle, pcm, self._scores)
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status](
                message="Process failed",
                message_stack=self._get_error_stack(),
            )

        # noinspection PyTypeChecker
        return [float(score) for score in self._scores]

    def reset(self) -> None:
        """
        Resets the internal state of the Eagle engine. It is best to call before processing a new sequence of audio
        (e.g. a new voice interaction). This ensures that the accuracy of the engine is not affected by a change
        in audio context.
        """

        status = self._reset_func(self._eagle)
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status](
                message="Reset failed",
                message_stack=self._get_error_stack(),
            )

    def delete(self) -> None:
        """
        Releases resources acquired by Eagle.
        """

        self._delete_func(self._eagle)

    @property
    def sample_rate(self) -> int:
        """
        Audio sample rate accepted by Eagle.
        """

        return self._sample_rate

    @property
    def frame_length(self) -> int:
        """
        Number of audio samples per frame expected by Eagle (i.e. length of the array passed into `.process()`)
        """

        return self._frame_length

    @property
    def version(self) -> str:
        """
        Version of Eagle.
        """

        return self._version

    def _get_error_stack(self) -> Sequence[str]:
        message_stack_ref = POINTER(c_char_p)()
        message_stack_depth = c_int()
        status = self._get_error_stack_func(byref(message_stack_ref), byref(message_stack_depth))
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status](message="Unable to get Eagle error state")

        message_stack = list()
        for i in range(message_stack_depth.value):
            message_stack.append(message_stack_ref[i].decode("utf-8"))

        self._free_error_stack_func(message_stack_ref)

        return message_stack


__all__ = [
    "Eagle",
    "EagleProfile",
    "EagleProfiler",
    "EagleProfilerEnrollFeedback",
    "EagleActivationError",
    "EagleActivationLimitError",
    "EagleActivationRefusedError",
    "EagleActivationThrottledError",
    "EagleError",
    "EagleInvalidArgumentError",
    "EagleInvalidStateError",
    "EagleIOError",
    "EagleKeyError",
    "EagleMemoryError",
    "EagleRuntimeError",
    "EagleStopIterationError",
]
