# Eagle Speaker Recognition Demos

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

## Eagle

Eagle is an on-device speaker recognition engine. Eagle is:

- Private; All voice processing runs locally.
- Cross-Platform:
    - Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64)
    - Android and iOS
    - Chrome, Safari, Firefox, and Edge
    - Raspberry Pi (4, 3) and NVIDIA Jetson Nano

## Compatibility

- Python 3.5+
- Runs on Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64), Raspberry Pi (4, 3), and NVIDIA Jetson Nano.

## Installation

```console
pip3 install pveagledemo
```

## AccessKey

Eagle requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Eagle
SDKs. You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

## Usage

### Microphone Demo

The microphone demo records audio input from a connected microphone. If a speaker profile isn't provided to the demo, it
performs an enrollment step to create a new speaker profile. Once this is complete, it proceeds to a recognition step to
identify the speaker.

```console
eagle_demo_mic.py --access_key ${ACCESS_KEY}
```

Alternatively, if a speaker profile is provided to the demo, it skips the enrollment step and directly performs the
recognition step to identify the speaker.

```console
eagle_demo_mic.py --access_key ${ACCESS_KEY} --profile_input_path ${PROFILE_INPUT_PATH}
```

Replace `${ACCESS_KEY}` with yours obtained from Picovoice Console and `${PROFILE_INPUT_PATH}` with a path to a stored
speaker profile.

The mic demo has optional arguments that can be viewed by using the `--help` argument. This will provide a list of the
available arguments and their descriptions.

```console
eagle_demo_mic.py --help
```

### File Demo

This file demo can be run in two modes: with and without a speaker profile.

If `enrollment_audio_paths` are pass to the demo, it does an enrollment step to create a speaker profile. Then, it does
a recognition step to identify the speaker. If no `enrollment_audio_paths` are passed to the demo, it bypasses the
enrollment step and goes directly to the recognition step to identify the speaker. The demo prints the result of the
recognition step to the console.

```console
eagle_demo_file.py --access_key ${ACCESS_KEY} --test_audio_paths ${TEST_AUDIO_PATHS} --enroll_audio_paths ${ENROLL_AUDIO_PATHS}
```

It is also possible to pass a speaker profile to the demo. In this case, the demo does a recognition step to identify
the speaker. The demo prints the result of the recognition step to the console.

```console
eagle_demo_file.py --access_key ${ACCESS_KEY} --test_audio_paths ${TEST_AUDIO_PATHS} --profile_input_path ${PROFILE_INPUT_PATH}
```

Replace `${ACCESS_KEY}` with yours obtained from Picovoice Console, `${TEST_AUDIO_PATHS}` with a path to a compatible
(single-channel, 16 kHz, 16-bit PCM) `.wav` file you wish to recognize, and `${ENROLL_AUDIO_PATHS}` with a path to a
compatible (single-channel, 16 kHz, 16-bit PCM) `.wav` file you wish to use for enrollment.

To see the list of all the arguments run the following in the terminal:

```console
eagle_demo_file.py --help
```
