# Eagle Speaker Recognition Demos

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

## Eagle

Eagle is an on-device speaker recognition engine. Eagle is:

- Private; All voice processing runs locally.
- Cross-Platform:
    - Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64)
    - Android and iOS
    - Chrome, Safari, Firefox, and Edge
    - Raspberry Pi (3, 4, 5)

## Compatibility

- Python 3.8+
- Runs on Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64), and Raspberry Pi (3, 4, 5).

## Installation

```console
pip3 install pveagledemo
```

## AccessKey

Eagle requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Eagle
SDKs. You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

## Overview

Eagle consists of two distinct steps: Enrollment and Recognition. In the enrollment step, Eagle analyzes a series of
utterances from a particular speaker to learn their unique voiceprint. This step results in an `EagleProfile` object,
which can be stored and utilized during inference. During the Recognition step, Eagle compares the incoming frames of
audio to the voiceprints of all enrolled speakers in real-time to determine the similarity between them.

## Microphone Demo

The microphone demo captures audio input from a microphone that is connected. To run the demo, use the following command
in the terminal:

```console
eagle_demo_mic {enroll, test} --access_key ${ACCESS_KEY} ...
```

Replace `${ACCESS_KEY}` with yours obtained from Picovoice Console.

The commands `enroll` and `test` are used to create a speaker profile and perform speaker recognition, respectively.
Detailed explanations of these commands will be provided in their respective sections.

Furthermore, the demo offers optional arguments, which can be accessed by utilizing the `--help` argument. By doing so,
you will receive a comprehensive listing of the available arguments along with their corresponding descriptions.

```console
eagle_demo_mic --help
```

### Speaker Enrollment

If the demo is executed in the enrollment mode by using the `enroll` command, it will initiate the enrollment process
using the audio captured from the microphone. It will display the progress percentage in the terminal until it reaches
100%. Once completed, it will save the profile of the enrolled speaker to the disk.

```console
eagle_demo_mic enroll --access_key ${ACCESS_KEY} --output_profile_path ${OUTPUT_PROFILE_PATH}
``````

Replace `${OUTPUT_PROFILE_PATH}` with the absolute path where the generated profile should be written.

### Speaker Recognition

Once the speaker profile for all speakers are created, the demo can be run in the `test` mode by running the following
command:

```console
eagle_demo_mic test --access_key ${ACCESS_KEY} --input_profile_paths ${INPUT_PROFILE_PATH_1 ...}
```

In this mode, you can include multiple speaker profiles by specifying them with the `--input_profile_paths` option.
Eagle will assess and provide a distinct score for each profile, which will be displayed in the terminal.

## File Demo

Similar to the mic demo, the file demo can be run in two modes: `enroll` and `test`

```console
eagle_demo_file {enroll,test} --access_key ${ACCESS_KEY} ...
```

Replace `${ACCESS_KEY}` with yours obtained from Picovoice Console.

The commands `enroll` and `test` are used to create a speaker profile and perform speaker recognition, respectively, and
will be discussed in detail in their respective sections.

To view the optional arguments for the demo, use the `--help` argument. This will display a list of available arguments
and their descriptions.

```console
eagle_demo_file --help
```

### Speaker Enrollment

To run the demo in `enroll` mode, you need two additional input arguments along with the AccessKey.

```console
eagle_demo_file enroll --access_key ${ACCESS_KEY} \
  --output_profile_path ${OUTPUT_PROFILE_PATH} --enroll_audio_paths ${ENROLL_AUDIO_PATH_1 ...} 
```

In this command, `{ENROLL_AUDIO_PATH_1 ...}` represents the absolute paths to the enroll audio files. If multiple files
are provided, Eagle will process all of them. Once the specified files are processed, the demo will generate a profile at
`${OUTPUT_PROFILE_PATH}`.

### Speaker Recognition

The file demo requires a test audio and one or more speaker profiles that were created during the enrollment step.

To run the demo, use the following command in the console:

```console
eagle_demo_file test --access_key ${ACCESS_KEY} \
  --input_profile_paths ${INPUT_PROFILE_PATH_1 ...} --test_audio_path ${TEST_AUDIO_PATH}
```

The demo will display the result for each enrolled speaker in the terminal.

Optionally, you can also generate a `.csv` file for further analysis by including the `--csv_output_path` parameter:

```console
eagle_demo_file test --access_key ${ACCESS_KEY} \
  --input_profile_paths ${INPUT_PROFILE_PATH_1 ...} --test_audio_path ${TEST_AUDIO_PATH} \
  --csv_output_path ${CSV_OUTPUT_PATH}
```
