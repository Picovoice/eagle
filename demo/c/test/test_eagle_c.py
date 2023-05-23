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

import os.path
import subprocess
import sys
import unittest


class EagleCTestCase(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls._access_key = sys.argv[1]
        cls._platform = sys.argv[2]
        cls._arch = "" if len(sys.argv) != 4 else sys.argv[3]
        cls._root_dir = os.path.join(os.path.dirname(__file__), "../../..")

    @staticmethod
    def _get_lib_ext(platform):
        if platform == "windows":
            return "dll"
        elif platform == "mac":
            return "dylib"
        else:
            return "so"

    def _get_model_path(self):
        return os.path.join(self._root_dir, 'lib/common/eagle_params.pv')

    def _get_library_file(self):
        return os.path.join(
            self._root_dir,
            "lib",
            self._platform,
            self._arch,
            "libpv_eagle." + self._get_lib_ext(self._platform)
        )

    def _get_audio_file(self, audio_file_names):
        return [os.path.join(self._root_dir, 'resources/audio_samples', audio_file_name)
                for audio_file_name in audio_file_names]

    def run_eagle(self, audio_file_name, is_enroll=False):
        args = [
            os.path.join(os.path.dirname(__file__), "../build/eagle_demo_file"),
            "-a", self._access_key,
            "-l", self._get_library_file(),
            "-m", self._get_model_path(),
            "-e" if is_enroll else "-t", "tmp_profile.egl",
            *self._get_audio_file(audio_file_name),
        ]
        process = subprocess.Popen(args, stderr=subprocess.PIPE, stdout=subprocess.PIPE, encoding='utf-8')
        stdout, stderr = process.communicate()
        self.assertEqual(process.poll(), 0)
        self.assertEqual(stderr, '')
        self.assertTrue("real time factor" in stdout)

    def test_eagle_enroll(self):
        self.run_eagle(["speaker_1_utt_1.wav", "speaker_1_utt_2.wav"], is_enroll=True)

    def test_eagle_test(self):
        self.run_eagle(["speaker_1_test_utt.wav"], is_enroll=False)


if __name__ == '__main__':
    if len(sys.argv) < 3 or len(sys.argv) > 4:
        print("usage: test_eagle_c.py ${AccessKey} ${Platform} [${Arch}]")
        exit(1)
    unittest.main(argv=sys.argv[:1])
