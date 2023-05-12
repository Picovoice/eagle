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
import struct
import wave

import pveagle

SCORE_BAR_LENGTH = 30


def read_file(file_name, sample_rate):
    wav_file = wave.open(file_name, mode="rb")
    channels = wav_file.getnchannels()
    sample_width = wav_file.getsampwidth()
    num_frames = wav_file.getnframes()

    if wav_file.getframerate() != sample_rate:
        raise ValueError("Audio file should have a sample rate of %d. got %d" % (sample_rate, wav_file.getframerate()))
    if sample_width != 2:
        raise ValueError("Audio file should be 16-bit. got %d" % sample_width)
    if channels == 2:
        print("Eagle processes single-channel audio but stereo file is provided. Processing left channel only.")

    samples = wav_file.readframes(num_frames)
    wav_file.close()

    frames = struct.unpack('h' * num_frames * channels, samples)

    return frames[::channels]


def print_score_bar(iteration, score):
    bar_length = int(score * SCORE_BAR_LENGTH)
    empty_length = SCORE_BAR_LENGTH - bar_length
    print("[frame: %3d, score: %3.2f]|%s%s|" % (iteration, score, '#' * bar_length, ' ' * empty_length))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--access_key',
        required=True,
        help='AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)')
    parser.add_argument(
        '--test_audio_paths',
        required=True,
        nargs='+',
        help='Absolute path to test audio files')
    parser.add_argument(
        '--profile_output_path',
        default=None,
        help='If provided, creates a profile file at the given path')
    parser.add_argument(
        '--library_path',
        help='Absolute path to dynamic library. Default: using the library provided by `pveagle`')
    parser.add_argument(
        '--model_path',
        help='Absolute path to Koala model. Default: using the model provided by `pveagle`')

    enroll = parser.add_mutually_exclusive_group(required=True)
    enroll.add_argument(
        '--enroll_audio_paths',
        default=None,
        nargs='+',
        help='Absolute path to enrollment audio files')
    enroll.add_argument(
        '--profile_input_path',
        default=None,
        help='If provided, Eagle will load the profile from this path and skip enrollment')
    args = parser.parse_args()

    for audio_path in args.test_audio_paths:
        if not audio_path.lower().endswith('.wav'):
            raise ValueError('Given argument --test_audio_paths must have WAV file extension')

    speaker_profile = None
    if args.profile_input_path is not None:
        with open(args.profile_input_path, 'rb') as f:
            speaker_profile = pveagle.EagleProfile.from_bytes(f.read())

    else:
        for audio_path in args.enroll_audio_paths:
            if not audio_path.lower().endswith('.wav'):
                raise ValueError('Given argument --enroll_audio_paths must have WAV file extension')

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

        try:
            for audio_path in args.enroll_audio_paths:
                audio = read_file(audio_path, eagle_profiler.sample_rate)
                enroll_percentage, error = eagle_profiler.enroll(audio)
                if error is pveagle.EagleProfilerEnrollmentErrors.NO_ERROR:
                    print('Enrolled audio file %s (Enrollment percentage: %.2f%%)' % (audio_path, enroll_percentage))
                else:
                    print('Failed to enroll audio file %s (Error: %s)' % (audio_path, error.name))

            speaker_profile = eagle_profiler.export()
            if args.profile_output_path is not None:
                with open(args.profile_output_path, 'wb') as f:
                    f.write(speaker_profile.to_bytes())
                print('Speaker profile is saved to %s' % args.profile_output_path)
        except pveagle.EagleActivationLimitError:
            print('AccessKey has reached its processing limit')
        finally:
            eagle_profiler.delete()

    if speaker_profile is None:
        print('No speaker profile is provided. Exiting...')
        return

    eagle = None
    try:
        eagle = pveagle.create(
            access_key=args.access_key,
            model_path=args.model_path,
            library_path=args.library_path,
            speaker_profiles=[speaker_profile])

        print('Eagle version: %s' % eagle.version)

        for audio_path in args.test_audio_paths:
            audio = read_file(audio_path, eagle.sample_rate)
            num_frames = len(audio) // eagle.frame_length

            for i in range(num_frames):
                frame = audio[i * eagle.frame_length:(i + 1) * eagle.frame_length]
                score = eagle.process(frame)
                print_score_bar(i, score[0])

            eagle.reset()

    except pveagle.EagleActivationLimitError:
        print('AccessKey has reached its processing limit.')
    except pveagle.EagleError as e:
        print("Failed to initialize Eagle")
        raise e
    finally:
        if eagle is not None:
            eagle.delete()


if __name__ == '__main__':
    main()
