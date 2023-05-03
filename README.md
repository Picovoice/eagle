# Eagle

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

[![Twitter URL](https://img.shields.io/twitter/url?label=%40AiPicovoice&style=social&url=https%3A%2F%2Ftwitter.com%2FAiPicovoice)](https://twitter.com/AiPicovoice)
[![YouTube Channel Views](https://img.shields.io/youtube/channel/views/UCAdi9sTCXLosG1XeqDwLx7w?label=YouTube&style=social)](https://www.youtube.com/channel/UCAdi9sTCXLosG1XeqDwLx7w)

Eagle is an on-device speaker recognition engine. Eagle is:

- Private; All voice processing runs locally.
- Cross-Platform:
  - Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64)
  - Android and iOS
  - Chrome, Safari, Firefox, and Edge
  - Raspberry Pi (4, 3) and NVIDIA Jetson Nano

## Table of Contents

- [Eagle](#eagle)
  - [Table of Contents](#table-of-contents)
  - [AccessKey](#accesskey)
  - [Demos](#demos)
  - [SDKs](#sdks)
  - [Releases](#releases)

## AccessKey

AccessKey is your authentication and authorization token for deploying Picovoice SDKs, including Eagle. Anyone who is
using Picovoice needs to have a valid AccessKey. You must keep your AccessKey secret. You would need internet
connectivity to validate your AccessKey with Picovoice license servers even though the noise suppression is running 100%
offline.

AccessKey also verifies that your usage is within the limits of your account. Everyone who signs up for
[Picovoice Console](https://console.picovoice.ai/) receives the `Free Tier` usage rights described
[here](https://picovoice.ai/pricing/). If you wish to increase your limits, you can purchase a subscription plan.

## Demos

### Python

## SDKs

### Python

Install the Python SDK:

```console
pip3 install pveagle
```

#### Speaker Enrollment

Create an instance of the profiler:

```python
import pveagle

# AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
access_key = "${ACCESS_KEY}"
eagle_profiler = pveagle.create_profiler(access_key)
```

Create a new speaker profile:

```python
def get_next_enroll_audio_data():
    pass

percentage = 0.0
while percentage < 100.0:
    percentage, error = eagle_profiler.enroll(get_next_enroll_audio_data())
```

Export the speaker profile once enrollment is complete:

```python
speaker_profile = eagle_profiler.export()
```

Release the resources acquired by the profiler:

```python
eagle_profiler.delete()
```

#### Speaker Recognition

Create an instance of the engine using the speaker profile exported before:

```python
eagle = pveagle.create(access_key, speaker_profile)
```

Process incoming audio frames:

```python
def get_next_audio_frame():
    pass

while True:
    score = eagle.process(get_next_audio_frame())
```

Finally, when done be sure to explicitly release the resources:

```python
eagle.delete()
```

## Releases

### v1.0.0 - May x, 2023

- Initial release.

## FAQ

You can find the FAQ [here](https://picovoice.ai/docs/faq/picovoice/).