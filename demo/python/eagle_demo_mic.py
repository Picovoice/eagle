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
import contextlib
import struct
import threading
import time
import wave

import pveagle
from pvrecorder import PvRecorder

PV_RECORDER_FRAME_LENGTH = 512


class EnrollmentAnimation(threading.Thread):
    def __init__(self, sleep_time_sec=0.1):
        self._sleep_time_sec = sleep_time_sec
        self._frames = [
            " .  ",
            " .. ",
            " ...",
            "  ..",
            "   .",
            "    "
        ]
        self._done = False
        self._percentage = 0
        self._feedback = ''
        super().__init__()

    def run(self):
        self._done = False
        while not self._done:
            for frame in self._frames:
                print('\033[2K\033[1G\r[%3d%%]' % self._percentage + self._feedback + frame, end='', flush=True)
                if self._done:
                    break
                time.sleep(self._sleep_time_sec)

    def stop(self):
        self._done = True

    @property
    def percentage(self):
        return self._percentage

    @property
    def feedback(self):
        return self._feedback

    @percentage.setter
    def percentage(self, value):
        self._percentage = value

    @feedback.setter
    def feedback(self, value):
        self._feedback = value


def print_result(scores):
    result = '\rscores -> '
    for i, score in enumerate(scores):
        result += 'speaker[%d]: %.2f, ' % (i, score)
    print(result, end='', flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--access_key',
        help='AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)')
    parser.add_argument(
        '--library_path',
        help='Absolute path to dynamic library. Default: using the library provided by `pveagle`')
    parser.add_argument(
        '--model_path',
        help='Absolute path to Koala model. Default: using the model provided by `pveagle`')
    parser.add_argument('--audio_device_index', type=int, default=-1, help='Index of input audio device')
    parser.add_argument(
        '--output_audio_path',
        help='If provided, all enrollment audio data will be saved to the given .wav file')
    parser.add_argument(
        '--show_audio_devices',
        action='store_true',
        help='List available audio input devices and exit')

    subparsers = parser.add_subparsers(dest='command', required=True)

    enroll = subparsers.add_parser('enroll', help='Enroll a new speaker profile')
    enroll.add_argument(
        '--output_profile_path',
        required=True,
        help='Absolute path to output file for the created profile')

    test = subparsers.add_parser('test', help='Evaluate Eagle''s performance using the provided speaker profiles.')
    test.add_argument(
        '--input_profile_paths',
        required=True,
        nargs='+',
        help='Absolute path(s) to speaker profile(s)')

    args = parser.parse_args()

    if args.show_audio_devices:
        for index, name in enumerate(PvRecorder.get_audio_devices()):
            print('Device #%d: %s' % (index, name))
        return

    if args.command == 'enroll':
        if args.access_key is None:
            raise ValueError('Missing required argument --access_key')

        try:
            eagle_profiler = pveagle.create_profiler(
                access_key=args.access_key,
                model_path=args.model_path,
                library_path=args.library_path)
        except pveagle.EagleInvalidArgumentError as e:
            print("One or more arguments provided to Eagle is invalid: ", args)
            print("If all other arguments seem valid, ensure that '%s' is a valid AccessKey" % args.access_key)
            raise
        except pveagle.EagleError as e:
            print("Failed to initialize Eagle: %s" % e)
            raise

        recorder = PvRecorder(device_index=args.audio_device_index, frame_length=PV_RECORDER_FRAME_LENGTH)
        print("Recording audio from '%s'" % recorder.selected_device)
        num_enroll_frames = eagle_profiler.min_enroll_audio_len_samples // PV_RECORDER_FRAME_LENGTH
        sample_rate = eagle_profiler.sample_rate
        enrollment_animation = EnrollmentAnimation()
        print('Please keep speaking until the enrollment percentage reaches 100%')
        try:
            with contextlib.ExitStack() as file_stack:
                if args.output_audio_path is not None:
                    enroll_audio_file = file_stack.enter_context(wave.open(args.output_audio_path, 'wb'))
                    enroll_audio_file.setnchannels(1)
                    enroll_audio_file.setsampwidth(2)
                    enroll_audio_file.setframerate(sample_rate)

                enroll_percentage = 0.0
                enrollment_animation.start()
                while enroll_percentage < 100.0:
                    enroll_pcm = list()
                    recorder.start()
                    for _ in range(num_enroll_frames):
                        input_frame = recorder.read()
                        if args.output_audio_path is not None:
                            enroll_audio_file.writeframes(struct.pack('%dh' % len(input_frame), *input_frame))
                        enroll_pcm.extend(input_frame)
                    recorder.stop()

                    enroll_percentage, error = eagle_profiler.enroll(enroll_pcm)
                    enrollment_animation.percentage = enroll_percentage
                    if error is pveagle.EagleProfilerEnrollmentFeedbacks.NO_ERROR:
                        enrollment_animation.feedback = ''
                    else:
                        enrollment_animation.feedback = ' - %s' % error.name

            speaker_profile = eagle_profiler.export()
            with open(args.output_profile_path, 'wb') as f:
                f.write(speaker_profile.to_bytes())
            print('\nSpeaker profile is saved to %s' % args.output_profile_path)

        except pveagle.EagleActivationLimitError:
            print('AccessKey has reached its processing limit')
        except pveagle.EagleError as e:
            print('Failed to enroll speaker: %s' % e)
        finally:
            enrollment_animation.stop()
            recorder.stop()
            recorder.delete()
            eagle_profiler.delete()

    elif args.command == 'test':

        if args.access_key is None:
            raise ValueError('Missing required argument --access_key')

        profiles = list()
        for profile_path in args.input_profile_paths:
            with open(profile_path, 'rb') as f:
                profile = pveagle.EagleProfile.from_bytes(f.read())
            profiles.append(profile)

        eagle = None
        recorder = None
        try:
            eagle = pveagle.create(
                access_key=args.access_key,
                model_path=args.model_path,
                library_path=args.library_path,
                speaker_profiles=profiles)

            recorder = PvRecorder(device_index=args.audio_device_index, frame_length=eagle.frame_length)
            recorder.start()

            with contextlib.ExitStack() as file_stack:
                if args.output_audio_path is not None:
                    test_audio_file = file_stack.enter_context(wave.open(args.output_audio_path, 'wb'))
                    test_audio_file.setnchannels(1)
                    test_audio_file.setsampwidth(2)
                    test_audio_file.setframerate(eagle.sample_rate)

                print('Listening for audio... (press Ctrl+C to stop)')
                while True:
                    pcm = recorder.read()
                    if args.output_audio_path is not None:
                        test_audio_file.writeframes(struct.pack('%dh' % len(pcm), *pcm))
                    scores = eagle.process(pcm)
                    print_result(scores)

        except KeyboardInterrupt:
            print('Stopping...')
        except pveagle.EagleActivationLimitError:
            print('AccessKey has reached its processing limit')
        finally:
            if eagle is not None:
                eagle.delete()
            if recorder is not None:
                recorder.stop()
                recorder.delete()


if __name__ == '__main__':
    main()
