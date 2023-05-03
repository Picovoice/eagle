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
import wave

import pveagle
from pvrecorder import PvRecorder

SCORE_BAR_LENGTH = 30
PV_RECORDER_FRAME_LENGTH = 512


def print_score_bar(score):
    bar_length = int(score * SCORE_BAR_LENGTH)
    empty_length = SCORE_BAR_LENGTH - bar_length
    print("\r[score: %3.2f]|%s%s|" % (score, '#' * bar_length, ' ' * empty_length), end='', flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--access_key',
        required=True,
        help='AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)')
    parser.add_argument(
        '--profile_output_path',
        default=None,
        help='If provided, creates a profile file at the given path')
    parser.add_argument(
        '--profile_input_path',
        default=None,
        help='If provided, Eagle will be created using the profile file at the given path and skip enrollment')
    parser.add_argument(
        '--library_path',
        help='Absolute path to dynamic library. Default: using the library provided by `pveagle`')
    parser.add_argument(
        '--model_path',
        help='Absolute path to Koala model. Default: using the model provided by `pveagle`')
    parser.add_argument(
        '--enroll_audio_path',
        help='If provided, all enrollment audio data will be saved to the given .wav file')
    parser.add_argument(
        '--test_audio_path',
        help='If provided, all test audio data will be saved to the given .wav file')

    parser.add_argument('--audio_device_index', type=int, default=-1, help='Index of input audio device')
    parser.add_argument('--show_audio_devices', action='store_true', help='Only list available devices and exit')
    args = parser.parse_args()

    if args.show_audio_devices:
        for index, name in enumerate(PvRecorder.get_audio_devices()):
            print('Device #%d: %s' % (index, name))
        return

    speaker_profile = None
    if args.profile_input_path is not None:
        with open(args.profile_input_path, 'rb') as f:
            speaker_profile = pveagle.EagleProfile.from_bytes(f.read())
    else:
        try:
            eagle_profiler = pveagle.create_profiler(
                access_key=args.access_key,
                model_path=args.model_path,
                library_path=args.library_path)
        except pveagle.EagleInvalidArgumentError as e:
            print("One or more arguments provided to Eagle is invalid: ", args)
            print("If all other arguments seem valid, ensure that '%s' is a valid AccessKey" % args.access_key)
            raise e
        except pveagle.EagleError as e:
            print("Failed to initialize Eagle")
            raise e

        recorder = PvRecorder(device_index=args.audio_device_index, frame_length=PV_RECORDER_FRAME_LENGTH)
        print("Recording audio from '%s'" % recorder.selected_device)
        num_enroll_frames = eagle_profiler.min_enroll_audio_length // PV_RECORDER_FRAME_LENGTH
        sample_rate = eagle_profiler.sample_rate
        try:
            print('Please keep speaking until the enrollment percentage reaches 100%')

            with contextlib.ExitStack() as file_stack:
                if args.enroll_audio_path is not None:
                    enroll_audio_file = file_stack.enter_context(wave.open(args.enroll_audio_path, 'wb'))
                    enroll_audio_file.setnchannels(1)
                    enroll_audio_file.setsampwidth(2)
                    enroll_audio_file.setframerate(sample_rate)

                enroll_percentage = 0.0
                while enroll_percentage < 100.0:
                    enroll_pcm = list()
                    recorder.start()
                    for _ in range(num_enroll_frames):
                        input_frame = recorder.read()
                        if args.enroll_audio_path is not None:
                            enroll_audio_file.writeframes(struct.pack('%dh' % len(input_frame), *input_frame))
                        enroll_pcm.extend(input_frame)
                    recorder.stop()
                    try:
                        enroll_percentage, error = eagle_profiler.enroll(enroll_pcm)
                        if error is pveagle.EagleProfilerEnrollmentErrors.NO_ERROR:
                            print('\r[%3d%%]' % enroll_percentage + ' ' * 10, end='', flush=True)
                        else:
                            print('\r[%3d%%] Error: %s' % (enroll_percentage, error.name), end='', flush=True)

                    except pveagle.EagleInvalidArgumentError as e:
                        print(' ' + str(e))

            speaker_profile = eagle_profiler.export()
            if args.profile_output_path is not None:
                with open(args.profile_output_path, 'wb') as f:
                    f.write(speaker_profile.to_bytes())
                print('\nSpeaker profile is saved to %s' % args.profile_output_path)

        except pveagle.EagleActivationLimitError:
            print('AccessKey has reached its processing limit')
        finally:
            recorder.stop()
            recorder.delete()
            eagle_profiler.delete()

    if speaker_profile is None:
        print('No speaker profile is provided. Exiting...')
        return

    eagle = None
    recorder = None
    try:
        eagle = pveagle.create(
            access_key=args.access_key,
            model_path=args.model_path,
            library_path=args.library_path,
            speaker_profiles=[speaker_profile])

        recorder = PvRecorder(device_index=args.audio_device_index, frame_length=eagle.frame_length)
        recorder.start()

        with contextlib.ExitStack() as file_stack:
            if args.test_audio_path is not None:
                test_audio_file = file_stack.enter_context(wave.open(args.test_audio_path, 'wb'))
                test_audio_file.setnchannels(1)
                test_audio_file.setsampwidth(2)
                test_audio_file.setframerate(eagle.sample_rate)

            while True:
                pcm = recorder.read()
                if args.test_audio_path is not None:
                    test_audio_file.writeframes(struct.pack('%dh' % len(pcm), *pcm))
                scores = eagle.process(pcm)
                print_score_bar(scores[0])

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
