# Eagle Speaker Recognition Engine

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

Eagle is an on-device speaker recognition engine. Eagle is:

- Private; All voice processing runs locally.
- Cross-Platform:
    - Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64)
    - Android and iOS
    - Chrome, Safari, Firefox, and Edge
    - Raspberry Pi (4, 3) and NVIDIA Jetson Nano

## Compatibility

- Python 3.5 or higher
- Runs on Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64), Raspberry Pi (4, 3), and NVIDIA Jetson Nano.

## Installation

```console
pip3 install pveagle
```

## AccessKey

Eagle requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Eagle
SDKs. You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

## Usage

Eagle consists of two distinct steps: Profiling and Recognition. In the Profiling step, Eagle analyzes a series of
utterances from a particular speaker to learn their unique voiceprint. This step results in an `EagleProfile` object,
which can be stored and utilized during inference. During the Recognition step, Eagle compares the incoming frames of
audio to the voiceprints of all enrolled speakers in real-time to determine the similarity between them.

### Speaker Enrollment

Create an instance of the profiler:

```python
import pveagle

# AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
access_key = "${ACCESS_KEY}"
eagle_profiler = pveagle.create_profiler(access_key)
```

`EagleProfiler` is responsible for processing and enrolling PCM audio data, with the valid audio sample rate determined
by `eagle_profiler.sample_rate`. The audio data must be 16-bit linearly-encoded and single-channel.

When passing samples to `eagle_profiler.enroll`, the number of samples must be at
least `eagle_profiler.min_enroll_audio_length` to ensure sufficient data for enrollment. The resulting percentage value
indicates the progress of the enrollment process, while the error value returns an error code if any issues arise due to
the quality of the audio data.

```python
def get_next_enroll_audio_data():
    pass


percentage = 0.0
while percentage < 100.0:
    percentage, error = eagle_profiler.enroll(get_next_enroll_audio_data())
    print(error.name)
```

After the percentage reaches 100%, the enrollment process is considered complete. While it is possible to continue
providing additional audio data to the profiler to improve the accuracy of the voiceprint, it is not necessary to do so.
At the conclusion of the enrollment process, the `eagle_profiler.export()` method can be called to obtain the speaker's
profile. This method generates a `speaker_profile` object that is essential for initializing the Eagle engine.
Additionally, the `speaker_profile` object can be serialized using the `speaker_profile.to_bytes()` function and stored
for later use.

```python
speaker_profile = eagle_profiler.export()
```

To reset the profiler and enroll a new speaker, the `eagle_profiler.reset()` method can be used. This method clears all
previously stored data, making it possible to start a new profiling session with a different speaker.

Finally, when done be sure to explicitly release the resources:

```python
eagle_profiler.delete()
```

### Speaker Recognition

Create an instance of the engine:

```python
eagle = pveagle.create(access_key, speaker_profile)
```

When initialized, `eagle.sample_rate` specifies the valid sample rate for Eagle. The expected length of a frame, or the
number of audio samples in an input array, is defined by `eagle.frame_length`.

Like the profiler, Eagle is designed to work with single-channel audio that is encoded using 16-bit linear PCM.

```python
def get_next_audio_frame():
    pass


while True:
    score = eagle.process(get_next_audio_frame())
```

The return value `score` represents the degree of similarity between the input audio frame and the enrolled speakers.
This value is a floating-point number ranging from 0 to 1, with higher values indicating a greater degree of similarity.

Finally, when done be sure to explicitly release the resources:

```python
eagle.delete()
```

## Demos

[pveagledemo](https://pypi.org/project/pveagledemo/) provides command-line utilities for processing real-time
audio (i.e. microphone) and files using Eagle.