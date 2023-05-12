# C Demos

## Compatibility

You need a C99-compatible compiler to build these demos.

## AccessKey

Eagle requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Eagle 
SDKs. You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.


## Requirements

- The demo requires [CMake](https://cmake.org/) version 3.4 or higher.
- **For Windows Only**: [MinGW](https://www.mingw-w64.org/) is required to build the demo.

# Microphone Demo

The microphone demo records audio input from a connected microphone. If a speaker profile isn't provided to the demo, it
performs an enrollment step to create a new speaker profile. Once this is complete, it proceeds to a recognition step to
identify the speaker.

**Note**: the following commands are run from the root of the repo.

## Build

Use CMake to build the Koala microphone demo target:

```console
cmake -S demo/c/ -B demo/c/build && cmake --build demo/c/build --target eagle_demo_mic
```

## Usage

Running the executable without any command-line arguments prints the usage info to the console:

```console
Usage: eagle_demo_mic [-s] [-l LIBRARY_PATH -m MODEL_PATH -a ACCESS_KEY -d AUDIO_DEVICE_INDEX -i PROFILE_INPUT_PATH -o PROFILE_OUTPUT_PATH]
```

To list the available audio input devices:

```console
./demo/c/build/eagle_demo_mic -s
```

To run the Eagle microphone demo:

```console
./demo/c/build/eagle_demo_mic -l ${LIBRARY_PATH} -m ${MODEL_PATH} -a ${ACCESS_KEY} -d ${AUDIO_DEVICE_INDEX}
```

Replace `${LIBRARY_PATH}` with path to appropriate library available under [lib](../../lib), `${MODEL_PATH}` with path
to the model file available under [lib/common](../../lib/common), `${ACCESS_KEY}` with AccessKey
obtained from [Picovoice Console](https://console.picovoice.ai/), `${AUDIO_DEVICE_INDEX}` with the index of the
audio device you wish to capture audio with. An `${AUDIO_DEVICE_INDEX}` of -1 will provide you with your system's
default recording device.

# File Demo

This file demo can be run in two modes: with and without a speaker profile.

If `enroll_audio_path` are pass to the demo, it does an enrollment step to create a speaker profile. Then, it does
a recognition step to identify the speaker. If no `enroll_audio_path` are passed to the demo, it bypasses the
enrollment step and goes directly to the recognition step to identify the speaker. The demo prints the result of the
recognition step to the console.

This demo expects a single-channel WAV file with a sampling rate of 16000 and 16-bit linear PCM encoding.

**Note**: the following commands are run from the root of the repo.

## Build

Use CMake to build the Koala file demo target:

```console
cmake -S demo/c/ -B demo/c/build && cmake --build demo/c/build --target eagle_demo_file
```

## Usage

Run the demo:

```console
Usage: eagle_demo_file [-l LIBRARY_PATH -m MODEL_PATH -a ACCESS_KEY -e ENROLL_AUDIO_PATH -t TEST_AUDIO_PATH -i PROFILE_INPUT_PATH -o PROFILE_OUTPUT_PATH]
```

Replace `${LIBRARY_PATH}` with the path to the appropriate Eagle library available
under [lib](../../lib), `${MODEL_PATH}` with the path to the model file available under [lib/common](../../lib/common),
`${ACCESS_KEY}` with a Picovoice AccessKey obtained from
the [Picovoice Console](https://console.picovoice.ai/), `${ENROLL_AUDIO_PATH}` with a path to a single-channel WAV file 
that will be used to create a speaker profile, `${TEST_AUDIO_PATH}` with a path to a single-channel WAV file that will 
be used to test the speaker profile.