#
#    Copyright 2023-2026 Picovoice Inc.
#
#    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
#    file accompanying this source.
#
#    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
#    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
#    specific language governing permissions and limitations under the License.
#

import argparse
import os
import struct
import sys
import unittest
import wave
from typing import (
    Optional,
    Sequence
)

from _eagle import (
    Eagle,
    EagleError,
    EagleProfile,
    EagleProfiler,
    list_hardware_devices
)

from _util import (
    default_library_path,
    default_model_path
)


class EagleTestCase(unittest.TestCase):
    ENROLL_PATHS = [
        os.path.join(os.path.dirname(__file__), "../../resources/audio_samples/speaker_1_utt_1.wav"),
        os.path.join(os.path.dirname(__file__), "../../resources/audio_samples/speaker_1_utt_2.wav"),
    ]
    TEST_PATH = os.path.join(os.path.dirname(__file__), "../../resources/audio_samples/speaker_1_test_utt.wav")
    IMPOSTER_PATH = os.path.join(os.path.dirname(__file__), "../../resources/audio_samples/speaker_2_test_utt.wav")
    access_key: str
    device: str
    eagle: Eagle
    eagle_profiler: EagleProfiler
    profile: EagleProfile

    @staticmethod
    def load_wav_resource(path: str) -> Sequence[int]:
        with wave.open(path, "rb") as f:
            buffer = f.readframes(f.getnframes())
            return struct.unpack("%dh" % f.getnframes(), buffer)

    @classmethod
    def setUpClass(cls) -> None:
        cls.eagle_profiler = EagleProfiler(
            access_key=cls.access_key,
            model_path=default_model_path("../.."),
            device=cls.device,
            library_path=default_library_path("../.."),
            min_enrollment_chunks=1,
            voice_threshold=0.3
        )

        fl = cls.eagle_profiler.frame_length
        for path in cls.ENROLL_PATHS:
            pcm = cls.load_wav_resource(path)
            for i in range(len(pcm) // fl):
                _ = cls.eagle_profiler.enroll(pcm[i * fl:(i + 1) * fl])
            _ = cls.eagle_profiler.flush()

        cls.profile = cls.eagle_profiler.export()
        cls.eagle_profiler.reset()

        cls.eagle = Eagle(
            access_key=cls.access_key,
            model_path=default_model_path("../.."),
            device=cls.device,
            library_path=default_library_path("../.."),
            voice_threshold=0.3
        )

    @classmethod
    def tearDownClass(cls) -> None:
        cls.eagle.delete()
        cls.eagle_profiler.delete()

    def test_eagle_enrollment(self) -> None:
        fl = self.eagle_profiler.frame_length
        percentage = 0.0
        for path in self.ENROLL_PATHS:
            pcm = self.load_wav_resource(path)
            for i in range(len(pcm) // fl):
                _ = self.eagle_profiler.enroll(pcm[i * fl:(i + 1) * fl])
            percentage = self.eagle_profiler.flush()

        self.assertGreater(percentage, 0)
        profile = self.eagle_profiler.export()
        self.eagle_profiler.reset()
        self.assertGreater(profile.size, 0)

    def test_eagle_process(self) -> None:
        pcm = self.load_wav_resource(self.TEST_PATH)
        scores = self.eagle.process(pcm=pcm, speaker_profiles=[self.profile])

        self.assertGreater(scores[0], 0.5)

    def test_eagle_process_imposter(self) -> None:
        pcm = self.load_wav_resource(self.IMPOSTER_PATH)
        scores = self.eagle.process(pcm=pcm, speaker_profiles=[self.profile])

        self.assertLess(scores[0], 0.5)

    def test_version(self) -> None:
        eagle_version = self.eagle.version
        self.assertIsInstance(eagle_version, str)
        self.assertGreater(len(eagle_version), 0)

        eagle_profile_version = self.eagle_profiler.version
        self.assertIsInstance(eagle_profile_version, str)
        self.assertGreater(len(eagle_profile_version), 0)

    def test_frame_length(self) -> None:
        self.assertGreater(self.eagle_profiler.frame_length, 0)

    def test_message_stack(self):
        error = None
        try:
            eagle = Eagle(
                access_key="invalid",
                model_path=default_model_path("../.."),
                device=self.device,
                library_path=default_library_path("../.."),
                voice_threshold=0.3
            )
            self.assertIsNone(eagle)
        except EagleError as e:
            error = e.message_stack

        self.assertIsNotNone(error)
        self.assertGreater(len(error), 0)

        try:
            eagle = Eagle(
                access_key="invalid",
                model_path=default_model_path("../.."),
                device=self.device,
                library_path=default_library_path("../.."),
                voice_threshold=0.3
            )
            self.assertIsNone(eagle)
        except EagleError as e:
            self.assertEqual(len(error), len(e.message_stack))
            self.assertListEqual(list(error), list(e.message_stack))

    def test_enroll_export_message_stack(self):
        profiler = EagleProfiler(
            access_key=self.access_key,
            model_path=default_model_path("../.."),
            device=self.device,
            library_path=default_library_path("../.."),
            min_enrollment_chunks=1,
            voice_threshold=0.3
        )
        test_pcm = [0] * 512

        address = profiler._eagle_profiler
        profiler._eagle_profiler = None

        try:
            res, _ = profiler.enroll(test_pcm)
            self.assertEqual(res, -1)
        except EagleError as e:
            self.assertGreater(len(e.message_stack), 0)
            self.assertLess(len(e.message_stack), 8)

        try:
            res = profiler.export()
            self.assertISNone(res)
        except EagleError as e:
            self.assertGreater(len(e.message_stack), 0)
            self.assertLess(len(e.message_stack), 8)

        profiler._eagle_profiler = address

    def test_process_message_stack(self):
        eagle = Eagle(
            access_key=self.access_key,
            model_path=default_model_path("../.."),
            device=self.device,
            library_path=default_library_path("../.."),
            voice_threshold=0.3
        )
        test_pcm = [0] * eagle.min_process_samples

        address = eagle._eagle
        eagle._eagle = None

        try:
            res = eagle.process(test_pcm, speaker_profiles=[self.profile])
            self.assertEqual(len(res), -1)
        except EagleError as e:
            self.assertGreater(len(e.message_stack), 0)
            self.assertLess(len(e.message_stack), 8)

        eagle._eagle = address

    def test_available_devices(self) -> None:
        res = list_hardware_devices(library_path=default_library_path("../.."))
        self.assertGreater(len(res), 0)
        for x in res:
            self.assertIsInstance(x, str)
            self.assertGreater(len(x), 0)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--access-key", required=True)
    parser.add_argument("--device", required=True)
    args = parser.parse_args()

    EagleTestCase.access_key = args.access_key
    EagleTestCase.device = args.device
    unittest.main(argv=sys.argv[:1])
