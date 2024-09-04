# Eagle Binding for Python

## Eagle Speaker Recognition Engine


Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

Eagle is an on-device speaker recognition engine. Eagle is:

- Private; All voice processing runs locally.
- Cross-Platform:
    - Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64)
    - Android and iOS
    - Chrome, Safari, Firefox, and Edge
    - Raspberry Pi (3, 4, 5)

## Compatibility

- Python 3.8 or higher
- Runs on Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64), and Raspberry Pi (3, 4, 5).

## Installation

```console
pip3 install pveagle
```

## AccessKey

Eagle requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Eagle
SDKs. You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

## Usage

Eagle has two distinct steps: Enrollment and Recognition. In the enrollment step, Eagle analyzes a series of
utterances from a particular speaker to learn their unique voiceprint. This step produces an `EagleProfile` object,
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
least `eagle_profiler.min_enroll_samples` to ensure sufficient data for enrollment. The percentage value
obtained from this process indicates the progress of enrollment, while the feedback value can be utilized to determine
the status of the enrollment process.

```python
def get_next_enroll_audio_data(num_samples):
    pass


percentage = 0.0
while percentage < 100.0:
    percentage, feedback = eagle_profiler.enroll(get_next_enroll_audio_data(eagle_profiler.min_enroll_samples))
    print(feedback.name)
```

After the percentage reaches 100%, the enrollment process is considered complete. While it is possible to continue
providing additional audio data to the profiler to improve the accuracy of the voiceprint, it is not necessary to do so.
Moreover, if the audio data submitted is unsuitable for enrollment, the feedback value will indicate the reason, and the
enrollment progress will remain unchanged.

```python
speaker_profile = eagle_profiler.export()
```

The `eagle_profiler.export()` function produces an `EagleProfile` object, which can be converted into a binary form
using the `EagleProfile.to_bytes()` method. This binary representation can be saved and subsequently retrieved using
the `EagleProfile.from_bytes()` method.

To reset the profiler and enroll a new speaker, the `eagle_profiler.reset()` method can be used. This method clears all
previously stored data, making it possible to start a new enrollment session with a different speaker.

Finally, when done be sure to explicitly release the resources:

```python
eagle_profiler.delete()
```

### Speaker Recognition

Create an instance of the engine with one or more speaker profiles from the `EagleProfiler`:

```python
eagle = pveagle.create_recognizer(access_key, speaker_profile)
```

When initialized, `eagle.sample_rate` specifies the valid sample rate for Eagle. The expected length of a frame, or the
number of audio samples in an input array, is defined by `eagle.frame_length`.

Like the profiler, Eagle is designed to work with single-channel audio that is encoded using 16-bit linear PCM.

```python
def get_next_audio_frame():
    pass


while True:
    scores = eagle.process(get_next_audio_frame())
```

The `scores` array contains floating-point numbers that indicate the similarity between the input audio frame and the
enrolled speakers. Each value in the array corresponds to a specific enrolled speaker, maintaining the same order as the
speaker profiles provided during initialization. The values in the array range from 0.0 to 1.0, where higher values
indicate a stronger degree of similarity.

Finally, when done be sure to explicitly release the resources:

```python
eagle.delete()
```

## Demos
[pveagledemo](https://pypi.org/project/pveagledemo/) provides command-line utilities for processing real-time
audio (i.e. microphone) and files using Eagle.
