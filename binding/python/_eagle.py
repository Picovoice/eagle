#
# Copyright 2023-2025 Picovoice Inc.
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
from typing import Sequence


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


class EagleProfiler(object):
    """
    Python binding for the profiler of the Eagle speaker recognition engine.
    It enrolls a speaker given a set of utterances and then constructs a profile for the enrolled speaker.
    """

    class CEagleProfiler(Structure):
        pass

    def __init__(
            self,
            access_key: str,
            model_path: str,
            device: str,
            min_enrollment_chunks: int,
            voice_threshold: float,
            library_path: str) -> None:
        """
        Constructor.

        :param access_key: AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
        :param model_path: Absolute path to file containing model parameters (.pv file).
        :param device: String representation of the device (e.g., CPU or GPU) to use. If set to `best`, the most
        suitable device is selected automatically. If set to `gpu`, the engine uses the first available GPU device.
        To select a specific GPU device, set this argument to `gpu:${GPU_INDEX}`, where `${GPU_INDEX}` is the index
        of the target GPU. If set to`cpu`, the engine will run on the CPU with the default number of threads. To
        specify the number of threads, set this argument to `cpu:${NUM_THREADS}`, where `${NUM_THREADS}` is the
        desired number of threads.
        :param library_path: Absolute path to Eagle's dynamic library.
        """

        if not isinstance(access_key, str) or len(access_key) == 0:
            raise EagleInvalidArgumentError("`access_key` should be a non-empty string.")

        if not os.path.exists(model_path):
            raise EagleIOError("Could not find model file at `%s`." % model_path)

        if not isinstance(device, str) or len(device) == 0:
            raise EagleInvalidArgumentError("`device` should be a non-empty string.")

        if min_enrollment_chunks < 1:
            raise EagleInvalidArgumentError("`min_enrollment_chunks` should be at least 1")

        if voice_threshold < 0.0 or voice_threshold > 1.0:
            raise EagleInvalidArgumentError("`voice_threshold` should be between 0 and 1")

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
            c_char_p,
            c_int32,
            c_float,
            POINTER(POINTER(self.CEagleProfiler)),
        ]
        init_func.restype = PicovoiceStatuses

        status = init_func(
            access_key.encode("utf-8"),
            model_path.encode("utf-8"),
            device.encode("utf-8"),
            min_enrollment_chunks,
            voice_threshold,
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

        self._delete_func = library.pv_eagle_profiler_delete
        self._delete_func.argtypes = [POINTER(self.CEagleProfiler)]
        self._delete_func.restype = None

        self._enroll_func = library.pv_eagle_profiler_enroll
        self._enroll_func.argtypes = [
            POINTER(self.CEagleProfiler),
            POINTER(c_int16),
            POINTER(c_float),
        ]
        self._enroll_func.restype = PicovoiceStatuses

        self._flush_func = library.pv_eagle_profiler_flush
        self._flush_func.argtypes = [
            POINTER(self.CEagleProfiler),
            POINTER(c_float),
        ]
        self._flush_func.restype = PicovoiceStatuses

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

        self._frame_length = library.pv_eagle_profiler_frame_length()

        version_func = library.pv_eagle_version
        version_func.argtypes = []
        version_func.restype = c_char_p
        self._version = version_func().decode("utf-8")

    def enroll(self, pcm: Sequence[int]) -> float:
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
        :return: The percentage of completeness of the speaker enrollment process.
        """

        if len(pcm) != self.frame_length:
            raise EagleInvalidArgumentError(
                "Length of input frame %d does not match required frame length %d" % (len(pcm), self.frame_length)
            )

        frame_type = c_int16 * self._frame_length
        c_pcm = frame_type(*pcm)

        percentage = c_float()
        status = self._enroll_func(
            self._eagle_profiler,
            c_pcm,
            byref(percentage))
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status](
                message="Enrollment failed",
                message_stack=self._get_error_stack(),
            )

        return percentage.value

    def flush(self) -> float:
        """
        Marks the end of the audio stream, flushes internal state of the object,
        and returns the percentage of enrollment completed.
        :return: The percentage of completeness of the speaker enrollment process.
        """

        percentage = c_float()
        status = self._flush_func(
            self._eagle_profiler,
            byref(percentage))
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status](
                message="Enrollment failed",
                message_stack=self._get_error_stack(),
            )

        return percentage.value

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
    def frame_length(self) -> int:
        """
        Number of audio samples per frame expected by EagleProfiler (i.e. length of the array passed into `.enroll()`)
        """

        return self._frame_length

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
            device: str,
            voice_threshold: float,
            library_path: str) -> None:
        """
        Constructor.

        :param access_key: AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
        :param model_path: Absolute path to file containing model parameters (.pv file).
        :param device: String representation of the device (e.g., CPU or GPU) to use. If set to `best`, the most
        suitable device is selected automatically. If set to `gpu`, the engine uses the first available GPU device.
        To select a specific GPU device, set this argument to `gpu:${GPU_INDEX}`, where `${GPU_INDEX}` is the index
        of the target GPU. If set to`cpu`, the engine will run on the CPU with the default number of threads. To
        specify the number of threads, set this argument to `cpu:${NUM_THREADS}`, where `${NUM_THREADS}` is the
        desired number of threads.
        :param library_path: Absolute path to Eagle's dynamic library.
        :param speaker_profiles: A list of EagleProfile objects. This can be constructed using `EagleProfiler`.
        """

        if len(access_key) == 0:
            raise EagleInvalidArgumentError("`access_key` should be a non-empty string.")

        if not os.path.exists(model_path):
            raise EagleIOError("Could not find model file at `%s`." % model_path)

        if not isinstance(device, str) or len(device) == 0:
            raise EagleInvalidArgumentError("`device` should be a non-empty string.")

        if voice_threshold < 0.0 or voice_threshold > 1.0:
            raise EagleInvalidArgumentError("`voice_threshold` should be between 0 and 1")

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
            c_char_p,
            c_float,
            POINTER(POINTER(self.CEagle)),
        ]
        init_func.restype = PicovoiceStatuses

        status = init_func(
            access_key.encode("utf-8"),
            model_path.encode("utf-8"),
            device.encode("utf-8"),
            voice_threshold,
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

        process_min_audio_length_samples_func = library.pv_eagle_process_min_audio_length_samples
        process_min_audio_length_samples_func.argtypes = [
            POINTER(self.CEagle),
            POINTER(c_int32),
        ]
        process_min_audio_length_samples_func.restype = PicovoiceStatuses

        min_process_samples = c_int32()
        status = process_min_audio_length_samples_func(self._eagle, byref(min_process_samples))
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status](
                message="Failed to get min audio length sample",
                message_stack=self._get_error_stack(),
            )
        self._min_process_samples = min_process_samples.value

        self._process_func = library.pv_eagle_process
        self._process_func.argtypes = [
            POINTER(self.CEagle),
            POINTER(c_int16),
            c_int32,
            POINTER(c_void_p),
            c_int32,
            POINTER(POINTER(c_float)),
        ]
        self._process_func.restype = PicovoiceStatuses

        self._scores_delete_func = library.pv_eagle_scores_delete
        self._scores_delete_func.argtypes = [POINTER(c_float)]

        self._sample_rate = library.pv_sample_rate()

        version_func = library.pv_eagle_version
        version_func.argtypes = []
        version_func.restype = c_char_p
        self._version = version_func().decode("utf-8")

    def process(self, pcm: Sequence[int], speaker_profiles: Sequence[EagleProfile]) -> Sequence[float]:
        """
        Processes a frame of audio and returns a list of similarity scores for each speaker profile.

        :param pcm: A frame of audio samples. The number of samples per frame can be attained by calling
        `.frame_length`. The incoming audio needs to have a sample rate equal to `.sample_rate` and be 16-bit
        linearly-encoded. Eagle operates on single-channel audio.
        :return: A list of similarity scores for each speaker profile. A higher score indicates that the voice
        belongs to the corresponding speaker. The range is [0, 1] with 1.0 representing a perfect match.
        """

        if len(speaker_profiles) == 0:
            raise EagleInvalidArgumentError("Eagle requires at least one speaker profile.")

        profile_bytes = (c_void_p * len(speaker_profiles))()
        for i, profile in enumerate(speaker_profiles):
            profile_bytes[i] = profile.handle

        frame_type = c_int16 * len(pcm)
        pcm = frame_type(*pcm)

        scores = POINTER(c_float)()
        status = self._process_func(
            self._eagle,
            pcm,
            len(pcm),
            profile_bytes,
            len(speaker_profiles),
            byref(scores))
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status](
                message="Process failed",
                message_stack=self._get_error_stack(),
            )

        if not scores:
            return None

        result = [float(scores[i]) for i in range(len(speaker_profiles))]
        self._scores_delete_func(scores)

        # noinspection PyTypeChecker
        return result

    def delete(self) -> None:
        """
        Releases resources acquired by Eagle.
        """

        self._delete_func(self._eagle)

    @property
    def min_process_samples(self) -> int:
        """
        The minimum length of the input pcm required by `.process()`.
        """

        return self._min_process_samples

    @property
    def sample_rate(self) -> int:
        """
        Audio sample rate accepted by Eagle.
        """

        return self._sample_rate

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


def list_hardware_devices(library_path: str) -> Sequence[str]:
    dll_dir_obj = None
    if hasattr(os, "add_dll_directory"):
        dll_dir_obj = os.add_dll_directory(os.path.dirname(library_path))

    library = cdll.LoadLibrary(library_path)

    if dll_dir_obj is not None:
        dll_dir_obj.close()

    list_hardware_devices_func = library.pv_eagle_list_hardware_devices
    list_hardware_devices_func.argtypes = [POINTER(POINTER(c_char_p)), POINTER(c_int32)]
    list_hardware_devices_func.restype = PicovoiceStatuses
    c_hardware_devices = POINTER(c_char_p)()
    c_num_hardware_devices = c_int32()
    status = list_hardware_devices_func(byref(c_hardware_devices), byref(c_num_hardware_devices))
    if status is not PicovoiceStatuses.SUCCESS:
        raise _PICOVOICE_STATUS_TO_EXCEPTION[status](message='`pv_eagle_list_hardware_devices` failed.')
    res = [c_hardware_devices[i].decode() for i in range(c_num_hardware_devices.value)]

    free_hardware_devices_func = library.pv_eagle_free_hardware_devices
    free_hardware_devices_func.argtypes = [POINTER(c_char_p), c_int32]
    free_hardware_devices_func.restype = None
    free_hardware_devices_func(c_hardware_devices, c_num_hardware_devices.value)

    return res


__all__ = [
    "Eagle",
    "EagleProfile",
    "EagleProfiler",
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
    "list_hardware_devices"
]
