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

from typing import Optional, Sequence, Union

from ._eagle import Eagle, EagleProfile, EagleProfiler
from ._util import default_library_path, default_model_path


def create_recognizer(
        access_key: str,
        speaker_profiles: Union[Sequence[EagleProfile], EagleProfile],
        model_path: Optional[str] = None,
        library_path: Optional[str] = None) -> Eagle:
    """
    Factory method for the recognizer component of the Eagle speaker recognition engine.

    :param access_key: AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
    :param speaker_profiles: An instance of EagleProfile or a list of EagleProfile instances. Each profile corresponds
    to a speaker enrolled in the voice recognition system.
    :param library_path: Absolute path to Eagle's dynamic library. If not set it will be set to the default
    location.
    :param model_path: Absolute path to the file containing model parameters (.pv file).
    If not set it will be set to the default location.
    :return: An instance of Eagle speaker recognition object.
    """

    if model_path is None:
        model_path = default_model_path()

    if library_path is None:
        library_path = default_library_path()

    if isinstance(speaker_profiles, EagleProfile):
        speaker_profiles = [speaker_profiles]

    return Eagle(
        access_key=access_key,
        speaker_profiles=speaker_profiles,
        model_path=model_path,
        library_path=library_path)


def create_profiler(
        access_key: str,
        model_path: Optional[str] = None,
        library_path: Optional[str] = None) -> EagleProfiler:
    """
    Factory method for the profiler component of the Eagle speaker recognition engine.

    :param access_key: AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
    :param library_path: Absolute path to Eagle's dynamic library. If not set it will be set to the default
    location.
    :param model_path: Absolute path to the file containing model parameters (.pv file).
    If not set it will be set to the default location.
    :return: An instance of EagleProfiler object.
    """

    if model_path is None:
        model_path = default_model_path()

    if library_path is None:
        library_path = default_library_path()

    return EagleProfiler(
        access_key=access_key,
        model_path=model_path,
        library_path=library_path,
    )


__all__ = [
    "create_recognizer",
    "create_profiler"
]
