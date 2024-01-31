#
#    Copyright 2023 Picovoice Inc.
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
from typing import Sequence

from _eagle import Eagle, EagleError, EagleProfiler, EagleProfilerEnrollFeedback
from _util import default_library_path, default_model_path


class EagleTestCase(unittest.TestCase):
    ENROLL_PATHS = [
        os.path.join(os.path.dirname(__file__), "../../resources/audio_samples/speaker_1_utt_1.wav"),
        os.path.join(os.path.dirname(__file__), "../../resources/audio_samples/speaker_1_utt_2.wav"),
    ]
    TEST_PATH = os.path.join(os.path.dirname(__file__), "../../resources/audio_samples/speaker_1_test_utt.wav")
    IMPOSTER_PATH = os.path.join(os.path.dirname(__file__), "../../resources/audio_samples/speaker_2_test_utt.wav")
    access_key: str
    eagle: Eagle
    eagle_profiler: EagleProfiler

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
            library_path=default_library_path("../.."),
        )

        for path in cls.ENROLL_PATHS:
            pcm = cls.load_wav_resource(path)
            _ = cls.eagle_profiler.enroll(pcm)

        profile = cls.eagle_profiler.export()

        cls.eagle = Eagle(
            access_key=cls.access_key,
            model_path=default_model_path("../.."),
            library_path=default_library_path("../.."),
            speaker_profiles=[profile],
        )

    @classmethod
    def tearDownClass(cls) -> None:
        cls.eagle.delete()
        cls.eagle_profiler.delete()

    def test_eagle_enrollment(self) -> None:
        percentage = 0.0
        for path in self.ENROLL_PATHS:
            pcm = self.load_wav_resource(path)
            percentage, error = self.eagle_profiler.enroll(pcm)
            self.assertEqual(error, EagleProfilerEnrollFeedback.AUDIO_OK)

        self.assertGreater(percentage, 0)
        profile = self.eagle_profiler.export()
        self.assertGreater(profile.size, 0)

    def test_eagle_process(self) -> None:
        pcm = self.load_wav_resource(self.TEST_PATH)
        num_frames = len(pcm) // self.eagle.frame_length
        scores = []
        for i in range(num_frames):
            score = self.eagle.process(pcm=pcm[i * self.eagle.frame_length: (i + 1) * self.eagle.frame_length])
            scores.append(score[0])

        self.assertGreater(max(scores), 0.5)
        self.eagle.reset()

    def test_eagle_process_imposter(self) -> None:
        pcm = self.load_wav_resource(self.IMPOSTER_PATH)
        num_frames = len(pcm) // self.eagle.frame_length
        scores = []
        for i in range(num_frames):
            score = self.eagle.process(pcm=pcm[i * self.eagle.frame_length: (i + 1) * self.eagle.frame_length])
            scores.append(score[0])

        self.assertLess(max(scores), 0.5)
        self.eagle.reset()

    def test_version(self) -> None:
        eagle_version = self.eagle.version
        self.assertIsInstance(eagle_version, str)
        self.assertGreater(len(eagle_version), 0)

        eagle_profile_version = self.eagle_profiler.version
        self.assertIsInstance(eagle_profile_version, str)
        self.assertGreater(len(eagle_profile_version), 0)

    def test_frame_length(self) -> None:
        self.assertGreater(self.eagle.frame_length, 0)

    def test_message_stack(self):
        relative_path = "../.."
        profile = self.eagle_profiler.export()

        error = None
        try:
            eagle = Eagle(
                access_key="invalid",
                model_path=default_model_path(relative_path),
                library_path=default_library_path(relative_path),
                speaker_profiles=[profile],
            )
            self.assertIsNone(eagle)
        except EagleError as e:
            error = e.message_stack

        self.assertIsNotNone(error)
        self.assertGreater(len(error), 0)

        try:
            eagle = Eagle(
                access_key="invalid",
                model_path=default_model_path(relative_path),
                library_path=default_library_path(relative_path),
                speaker_profiles=[profile],
            )
            self.assertIsNone(eagle)
        except EagleError as e:
            self.assertEqual(len(error), len(e.message_stack))
            self.assertListEqual(list(error), list(e.message_stack))

    def test_enroll_export_message_stack(self):
        relative_path = "../.."

        profiler = EagleProfiler(
            access_key=self.access_key,
            model_path=default_model_path(relative_path),
            library_path=default_library_path(relative_path),
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
        relative_path = "../.."
        profile = self.eagle_profiler.export()

        eagle = Eagle(
            access_key=self.access_key,
            model_path=default_model_path(relative_path),
            library_path=default_library_path(relative_path),
            speaker_profiles=[profile],
        )
        test_pcm = [0] * eagle.frame_length

        address = eagle._eagle
        eagle._eagle = None

        try:
            res = eagle.process(test_pcm)
            self.assertEqual(len(res), -1)
        except EagleError as e:
            self.assertGreater(len(e.message_stack), 0)
            self.assertLess(len(e.message_stack), 8)

        eagle._eagle = address


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--access-key", required=True)
    args = parser.parse_args()

    EagleTestCase.access_key = args.access_key
    unittest.main(argv=sys.argv[:1])
