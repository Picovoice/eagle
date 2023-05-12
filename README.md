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
      - [Python](#python-demos)
      - [Android](#android-demo)
      - [iOS](#ios-demo)
      - [C](#c-demos)
      - [Web](#web-demo)
    - [SDKs](#sdks)
      - [Python](#python)
      - [Android](#android)
      - [iOS](#ios)
      - [C](#c)
      - [Web](#web)
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

Install the demo package:

```console
pip3 install pveagledemo
```

```console
eagle_demo_mic --access_key ${ACCESS_KEY}
```

```console
eagle_demo_file \
    --access_key ${ACCESS_KEY} \
    --test_audio_paths ${TEST_AUDIO_PATHS} \
    --enroll_audio_paths ${ENROLL_AUDIO_PATHS}
```

Replace `${ACCESS_KEY}` with yours obtained from Picovoice Console.

### Android

### iOS

### C

Build the demo:

```console
cmake -S demo/c/ -B demo/c/build && cmake --build demo/c/build --target eagle_demo_mic
```

To list the available audio input devices:

```console
./demo/c/build/eagle_demo_mic -s
```

To run the demo:

```console
./demo/c/build/eagle_demo_mic -l ${LIBRARY_PATH} -m ${MODEL_PATH} -a ${ACCESS_KEY}
```

Replace `${LIBRARY_PATH}` with path to appropriate library available under [lib](./lib), `${MODEL_PATH}` with path
to the model file available under [lib/common](./lib/common), `${ACCESS_KEY}` with AccessKey
obtained from [Picovoice Console](https://console.picovoice.ai/).

For more information about C demos go to [demo/c](./demo/c).

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

### Android

### iOS

### C

[include/pv_eagle.h](./include/pv_eagle.h) header file contains relevant information.

Build an instance of the profiler:

```c
const char *access_key = "${ACCESS_KEY}";
const char *model_path = "${MODEL_PATH}";

pv_eagle_profiler_t *eagle_profiler = NULL;
pv_status_t status = pv_eagle_profiler_init_func(
            access_key,
            model_path,
            &eagle_profiler);
    if (status != PV_STATUS_SUCCESS) {
        // error handling logic
    }
```

Replace `${ACCESS_KEY}` with the AccessKey obtained from Picovoice Console, and `${MODEL_PATH}` with the path to the
model file available under [lib/common](./lib/common).

Now the `eagle_profiler` can be used to create a new speaker profile:

```c
extern const int16_t *get_next_enroll_audio_frame(void);
extern const int32_t get_next_enroll_audio_num_samples(void);

float enroll_percentage = 0.0f;
pv_eagle_profiler_enrollment_error_t error = PV_EAGLE_PROFILER_ENROLLMENT_ERROR_NONE;

while (enroll_percentage < 100.0f) {
  status = pv_eagle_profiler_enroll(
          eagle_profiler,
          get_next_enroll_audio_frame(),
          get_next_enroll_audio_num_samples(),
          &error,
          &enroll_percentage);
  if (status != PV_STATUS_SUCCESS) {
      // error handling logic
  }
}

int32_t profile_size_bytes = 0;
status = pv_eagle_profiler_speaker_profile_size(eagle_profiler, &profile_size_bytes);
void *speaker_profile = malloc(profile_size_bytes);
status = pv_eagle_profiler_export(
        eagle_profiler,
        speaker_profile);
if (status != PV_STATUS_SUCCESS) {
    // error handling logic
}
```

Once the speaker profile is exported, the resources acquired by the profiler can be released:

```c
pv_eagle_profiler_delete(eagle_profiler);
```

Create an instance of the engine using the speaker profile exported before:

```c
pv_eagle_t *eagle = NULL;
pv_status_t status = pv_eagle_init(
        access_key,
        model_path,
        1,
        (const void *const *) &speaker_profile,
        &eagle);
if (status != PV_STATUS_SUCCESS) {
    // error handling logic
}
```

Now the `eagle` can be used to process incoming audio frames:

```c
extern const int16_t *get_next_audio_frame(void);
const int32_t frame_length = pv_eagle_frame_length();

float score = 0.f;
while (true) {
    const int16_t *pcm = get_next_audio_frame();
    const pv_status_t status = pv_eagle_process(eagle, pcm, &score);
    if (status != PV_STATUS_SUCCESS) {
        // error handling logic
    }
}
```

Finally, when done be sure to release the acquired resources:

```c
pv_eagle_delete(handle);
```

## Releases

### v1.0.0 - May x, 2023

- Initial release.

## FAQ

You can find the FAQ [here](https://picovoice.ai/docs/faq/picovoice/).