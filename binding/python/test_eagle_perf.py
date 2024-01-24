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
from time import perf_counter
from typing import Sequence

from _eagle import Eagle, EagleProfiler
from _util import default_library_path, default_model_path


class EaglePerformanceTestCase(unittest.TestCase):
    ENROLL_PATHS = [
        os.path.join(os.path.dirname(__file__), "../../resources/audio_samples/speaker_1_utt_1.wav"),
        os.path.join(os.path.dirname(__file__), "../../resources/audio_samples/speaker_1_utt_2.wav"),
    ]
    TEST_PATH = os.path.join(os.path.dirname(__file__), "../../resources/audio_samples/speaker_1_test_utt.wav")
    access_key: str

    num_test_iterations: int
    recognizer_performance_threshold_sec: float
    profiler_performance_threshold_sec: float

    @staticmethod
    def load_wav_resource(path: str) -> Sequence[int]:
        with wave.open(path, "rb") as f:
            buffer = f.readframes(f.getnframes())
            return struct.unpack("%dh" % f.getnframes(), buffer)

    def test_performance_profiler(self) -> None:
        eagle_profiler = EagleProfiler(
            access_key=self.access_key,
            model_path=default_model_path("../.."),
            library_path=default_library_path("../.."),
        )

        pcm = self.load_wav_resource(self.TEST_PATH)

        perf_results = list()
        for i in range(self.num_test_iterations + 1):
            start = perf_counter()
            _ = eagle_profiler.enroll(pcm)
            if i > 0:
                perf_results.append(perf_counter() - start)

        eagle_profiler.delete()

        avg_perf = sum(perf_results) / self.num_test_iterations
        print("Average profiler performance: %s seconds" % avg_perf)
        self.assertLess(avg_perf, self.profiler_performance_threshold_sec)

    def test_performance_recognizer(self) -> None:
        # create profile
        eagle_profiler = EagleProfiler(
            access_key=self.access_key,
            model_path=default_model_path("../.."),
            library_path=default_library_path("../.."),
        )

        for path in self.ENROLL_PATHS:
            pcm = self.load_wav_resource(path)
            _ = eagle_profiler.enroll(pcm)

        profile = eagle_profiler.export()

        eagle = Eagle(
            access_key=self.access_key,
            model_path=default_model_path("../.."),
            library_path=default_library_path("../.."),
            speaker_profiles=[profile],
        )

        pcm = self.load_wav_resource(self.TEST_PATH)

        num_frames = len(pcm) // eagle.frame_length

        perf_results = list()
        for i in range(self.num_test_iterations + 1):
            for n in range(num_frames):
                start = perf_counter()
                _ = eagle.process(pcm=pcm[n * eagle.frame_length: (n + 1) * eagle.frame_length])
                perf_results.append(perf_counter() - start)

        eagle.delete()

        avg_perf = sum(perf_results) / self.num_test_iterations
        print("Average recognizer performance: %s seconds" % avg_perf)
        self.assertLess(avg_perf, self.recognizer_performance_threshold_sec)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--access-key", required=True)
    parser.add_argument("--num-test-iterations", type=int, required=True)
    parser.add_argument("--recognizer-performance-threshold-sec", type=float, required=True)
    parser.add_argument("--profiler-performance-threshold-sec", type=float, required=True)
    args = parser.parse_args()

    EaglePerformanceTestCase.access_key = args.access_key
    EaglePerformanceTestCase.num_test_iterations = args.num_test_iterations
    EaglePerformanceTestCase.profiler_performance_threshold_sec = args.profiler_performance_threshold_sec
    EaglePerformanceTestCase.recognizer_performance_threshold_sec = args.recognizer_performance_threshold_sec

    unittest.main(argv=sys.argv[:1])
