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
    pass


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
    PicovoiceStatuses.ACTIVATION_REFUSED: EagleActivationRefusedError
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
        Returns the profile as a byte array.
        """

        return self._to_bytes(self.handle, self.size)

    @classmethod
    def from_bytes(cls, profile: bytes) -> 'EagleProfile':
        """
        Creates an instance of EagleProfile from a byte array.
        """

        byte_ptr = (c_byte * len(profile)).from_buffer_copy(profile)
        handle = cast(byte_ptr, c_void_p)
        return cls(handle=handle, size=len(profile))

    @staticmethod
    def _to_bytes(ptr: c_void_p, size: int) -> bytes:
        # noinspection PyTypeChecker
        return bytes(cast(ptr, POINTER(c_byte * size)).contents)


class EagleProfilerEnrollmentFeedback(Enum):
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
    Python binding for the profiler of Eagle Speaker Recognition engine.
    """

    class CEagleProfiler(Structure):
        pass

    def __init__(
            self,
            access_key: str,
            model_path: str,
            library_path: str) -> None:
        """
        Constructor.

        :param access_key: AccessKey obtained from Picovoice Console (https://picovoice.ai/console/)
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

        self._eagle_profiler = POINTER(self.CEagleProfiler)()

        eagle_profiler_init_func = library.pv_eagle_profiler_init
        eagle_profiler_init_func.argtypes = [
            c_char_p,
            c_char_p,
            POINTER(POINTER(self.CEagleProfiler))]
        eagle_profiler_init_func.restype = PicovoiceStatuses

        status = eagle_profiler_init_func(
            access_key.encode('utf-8'),
            model_path.encode('utf-8'),
            byref(self._eagle_profiler))
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status]()

        eagle_profiler_speaker_profile_size_func = library.pv_eagle_profiler_export_size
        eagle_profiler_speaker_profile_size_func.argtypes = [
            POINTER(self.CEagleProfiler),
            POINTER(c_int32)]
        eagle_profiler_speaker_profile_size_func.restype = PicovoiceStatuses

        profile_size = c_int32()
        status = eagle_profiler_speaker_profile_size_func(self._eagle_profiler, byref(profile_size))
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status]()
        self._profile_size = profile_size.value

        pv_eagle_profiler_enrollment_min_audio_length_sample_func = \
            library.pv_eagle_profiler_enrollment_min_audio_length_samples
        pv_eagle_profiler_enrollment_min_audio_length_sample_func.argtypes = [
            POINTER(self.CEagleProfiler),
            POINTER(c_int32)]
        pv_eagle_profiler_enrollment_min_audio_length_sample_func.restype = PicovoiceStatuses

        min_enroll_audio_len_samples = c_int32()
        status = pv_eagle_profiler_enrollment_min_audio_length_sample_func(
            self._eagle_profiler,
            byref(min_enroll_audio_len_samples))
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status]()
        self._min_enroll_audio_len_samples = min_enroll_audio_len_samples.value

        self._eagle_profiler_delete_func = library.pv_eagle_profiler_delete
        self._eagle_profiler_delete_func.argtypes = [POINTER(self.CEagleProfiler)]
        self._eagle_profiler_delete_func.restype = None

        self._eagle_profiler_enroll_func = library.pv_eagle_profiler_enroll
        self._eagle_profiler_enroll_func.argtypes = [
            POINTER(self.CEagleProfiler),
            POINTER(c_int16),
            c_int32,
            POINTER(c_int),
            POINTER(c_float)]
        self._eagle_profiler_enroll_func.restype = PicovoiceStatuses

        self._eagle_profiler_reset_func = library.pv_eagle_profiler_reset
        self._eagle_profiler_reset_func.argtypes = [POINTER(self.CEagleProfiler)]
        self._eagle_profiler_reset_func.restype = PicovoiceStatuses

        self._eagle_profiler_export_func = library.pv_eagle_profiler_export
        self._eagle_profiler_export_func.argtypes = [
            POINTER(self.CEagleProfiler),
            c_void_p]
        self._eagle_profiler_export_func.restype = PicovoiceStatuses

        self._sample_rate = library.pv_sample_rate()

        self._frame_length = library.pv_eagle_frame_length()

        version_func = library.pv_eagle_version
        version_func.argtypes = []
        version_func.restype = c_char_p
        self._version = version_func().decode('utf-8')

    def enroll(self, pcm: Sequence[int]) -> Tuple[float, EagleProfilerEnrollmentFeedback]:
        """
        Enrolls a speaker. This function should be called multiple times with different utterances of the same speaker
        until `percentage` reaches `100.0`. Any further enrollment can be used to improve the speaker voice profile.
        The minimum number of required samples can be obtained by calling `.min_enroll_audio_len_samples()`.
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
            i.e. it is shorter than`.min_enroll_audio_len_samples()`.
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
        status = self._eagle_profiler_enroll_func(
            self._eagle_profiler,
            c_pcm,
            len(c_pcm),
            byref(feedback_code),
            byref(percentage))
        feedback = EagleProfilerEnrollmentFeedback(feedback_code.value)
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status]()

        return percentage.value, feedback

    def export(self) -> EagleProfile:
        """
        Exports the speaker profile of the current session.
        Will raise an exception if the profile is not ready.

        :return: An immutable EagleProfile object.
        """

        profile = (c_byte * self._profile_size)()
        status = self._eagle_profiler_export_func(
            self._eagle_profiler,
            byref(profile)
        )
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status]()

        return EagleProfile(cast(profile, c_void_p), self._profile_size)

    def reset(self) -> None:
        """
        Resets the internal state of Eagle Profiler.
        It should be called before starting a new enrollment session.
        """

        status = self._eagle_profiler_reset_func(self._eagle_profiler)
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status]()

    def delete(self) -> None:
        """
        Releases resources acquired by Eagle Profiler.
        """

        self._eagle_profiler_delete_func(self._eagle_profiler)

    @property
    def min_enroll_audio_len_samples(self) -> int:
        """
        the minimum number of samples in an audio data required for enrollment.
        """

        return self._min_enroll_audio_len_samples

    @property
    def sample_rate(self) -> int:
        """
        Audio sample rate accepted by `.enroll`.
        """

        return self._sample_rate

    @property
    def version(self) -> str:
        """
        Version of Eagle Profiler.
        """

        return self._version


class Eagle(object):
    """
    Python binding for Eagle Speaker Recognition engine.
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

        :param access_key: AccessKey obtained from Picovoice Console (https://picovoice.ai/console/)
        :param model_path: Absolute path to file containing model parameters (.pv file).
        :param library_path: Absolute path to Eagle's dynamic library.
        :param speaker_profiles: A list of EagleProfile objects. This can be constructed using `EagleProfiler`.
        """

        if not isinstance(access_key, str) or len(access_key) == 0:
            raise EagleInvalidArgumentError("`access_key` should be a non-empty string.")

        if not os.path.exists(model_path):
            raise EagleIOError("Could not find model file at `%s`." % model_path)

        if speaker_profiles is None or len(speaker_profiles) == 0:
            raise EagleInvalidArgumentError("Eagle requires at least one speaker profile.")

        if not os.path.exists(library_path):
            raise EagleIOError("Could not find Eagle's dynamic library at `%s`." % library_path)

        library = cdll.LoadLibrary(library_path)

        self._eagle = POINTER(self.CEagle)()

        eagle_init_func = library.pv_eagle_init
        eagle_init_func.argtypes = [
            c_char_p,
            c_char_p,
            c_int32,
            POINTER(c_void_p),
            POINTER(POINTER(self.CEagle))]
        eagle_init_func.restype = PicovoiceStatuses

        profile_bytes = (c_void_p * len(speaker_profiles))()
        for i, profile in enumerate(speaker_profiles):
            profile_bytes[i] = profile.handle

        status = eagle_init_func(
            access_key.encode('utf-8'),
            model_path.encode('utf-8'),
            len(speaker_profiles),
            profile_bytes,
            byref(self._eagle))
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status]()

        self._eagle_delete_func = library.pv_eagle_delete
        self._eagle_delete_func.argtypes = [POINTER(self.CEagle)]
        self._eagle_delete_func.restype = None

        self._eagle_process_func = library.pv_eagle_process
        self._eagle_process_func.argtypes = [
            POINTER(self.CEagle),
            POINTER(c_int16),
            POINTER(c_float)]
        self._eagle_process_func.restype = PicovoiceStatuses

        self._scores = (c_float * len(speaker_profiles))()

        self._eagle_reset_func = library.pv_eagle_reset
        self._eagle_reset_func.argtypes = [POINTER(self.CEagle)]
        self._eagle_reset_func.restype = PicovoiceStatuses

        self._sample_rate = library.pv_sample_rate()

        self._frame_length = library.pv_eagle_frame_length()

        version_func = library.pv_eagle_version
        version_func.argtypes = []
        version_func.restype = c_char_p
        self._version = version_func().decode('utf-8')

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
                "Length of input frame %d does not match required frame length %d" % (len(pcm), self.frame_length))

        frame_type = c_int16 * self.frame_length
        pcm = frame_type(*pcm)

        status = self._eagle_process_func(self._eagle, pcm, self._scores)
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status]()

        # noinspection PyTypeChecker
        return [float(score) for score in self._scores]

    def reset(self) -> None:
        """
        Resets the internal state of the engine.
        It must be called before processing a new sequence of audio frames.
        """

        status = self._eagle_reset_func(self._eagle)
        if status is not PicovoiceStatuses.SUCCESS:
            raise _PICOVOICE_STATUS_TO_EXCEPTION[status]()

    def delete(self) -> None:
        """
        Releases resources acquired by Eagle.
        """

        self._eagle_delete_func(self._eagle)

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


__all__ = [
    'Eagle',
    'EagleProfile',
    'EagleProfiler',
    'EagleProfilerEnrollmentFeedback',
    'EagleActivationError',
    'EagleActivationLimitError',
    'EagleActivationRefusedError',
    'EagleActivationThrottledError',
    'EagleError',
    'EagleInvalidArgumentError',
    'EagleInvalidStateError',
    'EagleIOError',
    'EagleKeyError',
    'EagleMemoryError',
    'EagleRuntimeError',
    'EagleStopIterationError',
]
