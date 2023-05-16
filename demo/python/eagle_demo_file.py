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
import csv
import struct
import wave

import pveagle

FEEDBACK_TO_DESCRIPTIVE_MSG = {
    pveagle.EagleProfilerEnrollmentFeedback.AUDIO_OK: 'Good audio',
    pveagle.EagleProfilerEnrollmentFeedback.AUDIO_TOO_SHORT: 'Insufficient audio length',
    pveagle.EagleProfilerEnrollmentFeedback.UNKNOWN_SPEAKER: 'Different speaker in audio',
    pveagle.EagleProfilerEnrollmentFeedback.NO_VOICE_FOUND: 'No voice found in audio',
    pveagle.EagleProfilerEnrollmentFeedback.QUALITY_ISSUE: 'Low audio quality due to bad microphone or environment'
}


def read_file(file_name, sample_rate):
    with wave.open(file_name, mode="rb") as wav_file:
        channels = wav_file.getnchannels()
        sample_width = wav_file.getsampwidth()
        num_frames = wav_file.getnframes()

        if wav_file.getframerate() != sample_rate:
            raise ValueError(
                "Audio file should have a sample rate of %d. got %d" % (sample_rate, wav_file.getframerate()))
        if sample_width != 2:
            raise ValueError("Audio file should be 16-bit. got %d" % sample_width)
        if channels == 2:
            print("Eagle processes single-channel audio but stereo file is provided. Processing left channel only.")

        samples = wav_file.readframes(num_frames)

    frames = struct.unpack('h' * num_frames * channels, samples)

    return frames[::channels]


def print_result(time, scores):
    result = 'time: %4.2f sec | scores -> ' % time
    result += ', '.join('speaker[%d]: %.3f, ' % (i, score) for i, score in enumerate(scores))
    print(result)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--access_key',
        required=True,
        help='AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)')
    parser.add_argument(
        '--library_path',
        help='Absolute path to dynamic library. Default: using the library provided by `pveagle`')
    parser.add_argument(
        '--model_path',
        help='Absolute path to Eagle model. Default: using the model provided by `pveagle`')
    subparsers = parser.add_subparsers(dest='command', required=True)

    enroll = subparsers.add_parser('enroll')
    enroll.add_argument(
        '--enroll_audio_paths',
        required=True,
        nargs='+',
        help='Absolute path(s) to enrollment audio files')
    enroll.add_argument(
        '--output_profile_path',
        required=True,
        help='Absolute path to save the speaker profile')

    test = subparsers.add_parser('test')
    test.add_argument(
        '--input_profile_paths',
        required=True,
        nargs='+',
        help='Absolute path(s) to speaker profile(s)')
    test.add_argument(
        '--test_audio_path',
        required=True,
        help='Absolute path to test audio file')
    test.add_argument(
        '--csv_output_path',
        help='Optional if provided the test result will be saved to the given path in CSV format instead of printing '
             'to the terminal')

    args = parser.parse_args()

    if args.command == 'enroll':
        for audio_path in args.enroll_audio_paths:
            if not audio_path.lower().endswith('.wav'):
                raise ValueError('Given argument --enroll_audio_paths must have WAV file extension')

        try:
            eagle_profiler = pveagle.create_profiler(
                access_key=args.access_key,
                model_path=args.model_path,
                library_path=args.library_path)
        except pveagle.EagleInvalidArgumentError:
            print("One or more arguments provided to Eagle is invalid: ", args)
            print("If all other arguments seem valid, ensure that '%s' is a valid AccessKey" % args.access_key)
            raise
        except pveagle.EagleError as e:
            print("Failed to initialize EagleProfiler: ", e)
            raise

        print('Eagle version: %s' % eagle_profiler.version)

        try:
            for audio_path in args.enroll_audio_paths:
                audio = read_file(audio_path, eagle_profiler.sample_rate)
                enroll_percentage, feedback = eagle_profiler.enroll(audio)
                print('Enrolled audio file %s [Enrollment percentage: %.2f%% - Enrollment feedback: %s]'
                      % (audio_path, enroll_percentage, FEEDBACK_TO_DESCRIPTIVE_MSG[feedback]))

            speaker_profile = eagle_profiler.export()
            if args.output_profile_path is not None:
                with open(args.output_profile_path, 'wb') as f:
                    f.write(speaker_profile.to_bytes())
                print('Speaker profile is saved to %s' % args.output_profile_path)
        except pveagle.EagleActivationLimitError:
            print('AccessKey has reached its processing limit')
        except pveagle.EagleError as e:
            print('Failed to perform enrollment: ', e)
        finally:
            eagle_profiler.delete()

    elif args.command == 'test':
        speaker_profiles = []
        for input_profile_path in args.input_profile_paths:
            with open(input_profile_path, 'rb') as f:
                speaker_profiles.append(pveagle.EagleProfile.from_bytes(f.read()))

        eagle = None
        try:
            eagle = pveagle.create_recognizer(
                access_key=args.access_key,
                model_path=args.model_path,
                library_path=args.library_path,
                speaker_profiles=speaker_profiles)
        except pveagle.EagleActivationLimitError:
            print('AccessKey has reached its processing limit.')
        except pveagle.EagleError as e:
            print("Failed to initialize Eagle: ", e)
            raise

        print('Eagle version: %s' % eagle.version)

        output_result = None
        result_writer = None
        if args.csv_output_path is not None:
            output_result = open(args.csv_output_path, mode='w')
            result_writer = csv.writer(output_result, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)
            result_writer.writerow(['time', *['Speaker_%d' % i for i in range(len(speaker_profiles))]])
        try:
            audio = read_file(args.test_audio_path, eagle.sample_rate)
            num_frames = len(audio) // eagle.frame_length
            frame_to_second = eagle.frame_length / eagle.sample_rate
            for i in range(num_frames):
                frame = audio[i * eagle.frame_length:(i + 1) * eagle.frame_length]
                scores = eagle.process(frame)
                if output_result is not None:
                    result_writer.writerow([i, *scores])
                else:
                    print_result(i * frame_to_second, scores)

        except pveagle.EagleActivationLimitError:
            print('AccessKey has reached its processing limit.')
        except pveagle.EagleError as e:
            print("Failed to process audio: ", e)
            raise
        finally:
            eagle.delete()
            if output_result is not None:
                output_result.close()


if __name__ == '__main__':
    main()
