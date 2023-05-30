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

## Overview

Eagle consists of two distinct steps: Enrollment and Recognition. In the enrollment step, Eagle analyzes a series of
utterances from a particular speaker to learn their unique voiceprint. This step results in a `Profile` object,
which can be stored and utilized during inference. During the Recognition step, Eagle compares the incoming frames of
audio to the voiceprints of all enrolled speakers in real-time to determine the similarity between them.

# Microphone Demo

The microphone demo records audio input from a connected microphone. It has two modes, `enroll` and `test`,
which can be selected based on the input arguments.

**Note**: the following commands are run from the root of the repo.

## Build

Use CMake to build the Eagle microphone demo target:

```console
cmake -S demo/c/ -B demo/c/build && cmake --build demo/c/build --target eagle_demo_mic
```

## Usage

Running the executable without any command-line arguments prints the usage info to the console:

```console
Usage: ./demo/c/build/eagle_demo_mic [-s] [-e OUTPUT_PROFILE_PATH | -t INPUT_PROFILE_PATH] [-l LIBRARY_PATH -m MODEL_PATH -a ACCESS_KEY -d AUDIO_DEVICE_INDEX]
```

To list the available audio input devices:

```console
./demo/c/build/eagle_demo_mic -s
```

### Speaker Enrollment

To run the Eagle microphone demo in the enrollment mode, pass the `-e` argument with the path to the output file
where the speaker profile will be stored:

```console
./demo/c/build/eagle_demo_mic -l ${LIBRARY_PATH} -m ${MODEL_PATH} -a ${ACCESS_KEY} -d ${AUDIO_DEVICE_INDEX} -e ${OUTPUT_PROFILE_PATH}
```

Replace `${LIBRARY_PATH}` with path to appropriate library available under [lib](../../lib), `${MODEL_PATH}` with path
to the model file available under [lib/common](../../lib/common), `${ACCESS_KEY}` with AccessKey
obtained from [Picovoice Console](https://console.picovoice.ai/), `${AUDIO_DEVICE_INDEX}` with the index of the
audio device you wish to capture audio with. An `${AUDIO_DEVICE_INDEX}` of -1 will provide you with your system's
default recording device. Lastly, `${OUTPUT_PROFILE_PATH}` with the path to the output file where the speaker profile
will be stored.

### Speaker Recognition

To run the Eagle microphone demo in the test mode, pass the `-t` argument with the path to the input file
where the speaker profile is stored:

```console
./demo/c/build/eagle_demo_mic -l ${LIBRARY_PATH} -m ${MODEL_PATH} -a ${ACCESS_KEY} -d ${AUDIO_DEVICE_INDEX} -t ${INPUT_PROFILE_PATH}
```

All arguments are the same as the enrollment mode, except `${INPUT_PROFILE_PATH}` should be the path to the speaker
profile file.

# File Demo

Similar to the mic demo, the file demo can be run in two modes: `enroll` and `test`, which can be selected based on the
input arguments.

This demo expects a single-channel WAV file with a sampling rate of 16000 and 16-bit linear PCM encoding.

**Note**: the following commands are run from the root of the repo.

## Build

Use CMake to build the Eagle file demo target:

```console
cmake -S demo/c/ -B demo/c/build && cmake --build demo/c/build --target eagle_demo_file
```

## Usage

Running the executable without any command-line arguments prints the usage info to the console:

```console
Usage: ./demo/c/build/eagle_demo_file [-e OUTPUT_PROFILE_PATH | -t INPUT_PROFILE_PATH] [-l LIBRARY_PATH -m MODEL_PATH -a ACCESS_KEY WAV_AUDIO_PATH_1 WAV_AUDIO_PATH_2 ...]
```

### Speaker Enrollment

To run the Eagle file demo in the enrollment mode, pass the `-e` argument with the path to the output file
where the speaker profile will be stored:

```console
./demo/c/build/eagle_demo_file -l ${LIBRARY_PATH} -m ${MODEL_PATH} -a ${ACCESS_KEY} -e ${OUTPUT_PROFILE_PATH} ${WAV_AUDIO_PATH_1} ${WAV_AUDIO_PATH_2} ...
```

Replace `${LIBRARY_PATH}` with the path to the appropriate Eagle library available under [lib](../../lib), 
`${MODEL_PATH}` with the path to the model file available under [lib/common](../../lib/common), `${ACCESS_KEY}` with a
Picovoice AccessKey obtained from the [Picovoice Console](https://console.picovoice.ai/), `${OUTPUT_PROFILE_PATH}` with the
path to the output file where the speaker profile will be stored, and `${WAV_AUDIO_PATH_1} ${WAV_AUDIO_PATH_2} ...` with
the paths to the WAV files that will be used to enroll the speaker.

### Speaker Recognition

To run the Eagle file demo in the test mode, pass the `-t` argument with the path to the input file
where the speaker profile is stored:

```console
./demo/c/build/eagle_demo_file -l ${LIBRARY_PATH} -m ${MODEL_PATH} -a ${ACCESS_KEY} -t ${INPUT_PROFILE_PATH} ${WAV_AUDIO_PATH_1} ${WAV_AUDIO_PATH_2} ...
```

All arguments are the same as the enrollment mode, except `${INPUT_PROFILE_PATH}` should be the path to the speaker
profile file. `${WAV_AUDIO_PATH_1} ${WAV_AUDIO_PATH_2} ...` should be the paths to the WAV files that will be used to
test the speaker.