# Eagle

[![GitHub release](https://img.shields.io/github/v/tag/Picovoice/eagle.svg)](https://github.com/Picovoice/eagle/releases)
[![GitHub](https://img.shields.io/github/license/Picovoice/eagle)](https://github.com/Picovoice/eagle/)

[![PyPI](https://img.shields.io/pypi/v/pveagle)](https://pypi.org/project/pveagle/)
[![npm](https://img.shields.io/npm/v/@picovoice/eagle-web)](https://www.npmjs.com/package/@picovoice/eagle-web)
[![Maven Central](https://img.shields.io/maven-central/v/ai.picovoice/eagle-android?label=maven-central%20%5Bandroid%5D)](https://repo1.maven.org/maven2/ai/picovoice/eagle-android/)
<!-- markdown-link-check-disable -->
[![CocoaPods](https://img.shields.io/cocoapods/v/Eagle-iOS)](https://cocoapods.org/pods/Eagle-iOS)
<!-- markdown-link-check-enable -->

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

<!-- markdown-link-check-disable -->
[![Twitter URL](https://img.shields.io/twitter/url?label=%40AiPicovoice&style=social&url=https%3A%2F%2Ftwitter.com%2FAiPicovoice)](https://twitter.com/AiPicovoice)
<!-- markdown-link-check-enable -->
[![YouTube Channel Views](https://img.shields.io/youtube/channel/views/UCAdi9sTCXLosG1XeqDwLx7w?label=YouTube&style=social)](https://www.youtube.com/channel/UCAdi9sTCXLosG1XeqDwLx7w)

Eagle is an on-device speaker recognition engine. Eagle is:

- Private; All voice processing runs locally.
- Cross-Platform:
    - Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64)
    - Android and iOS
    - Chrome, Safari, Firefox, and Edge
    - Raspberry Pi (3, 4, 5) and NVIDIA Jetson Nano


## Table of Contents

- [Eagle](#eagle)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [AccessKey](#accesskey)
  - [Demos](#demos)
    - [Python Demos](#python-demos)
    - [Android Demo](#android-demo)
    - [iOS Demo](#ios-demo)
    - [C Demos](#c-demos)
    - [Web Demo](#web-demo)
    - [Node.js](#nodejs-demos)
  - [SDKs](#sdks)
    - [Python](#python)
    - [Android](#android)
    - [iOS](#ios)
    - [C](#c)
    - [Web](#web)
    - [Node.js](#nodejs)
  - [Releases](#releases)
  - [FAQ](#faq)

## Overview

Eagle consists of two distinct steps: Enrollment and Recognition. In the enrollment step, Eagle analyzes a series of
utterances from a particular speaker to learn their unique voiceprint. This step results in a `Profile`,
which can be stored and utilized in the next step. During the Recognition step, Eagle registers speakers using
the `Profile`s generated in the enrollment phase. Then, Eagle compares the incoming frames of audio to the voiceprints
of all enrolled speakers in real-time to determine the similarity between them.

## AccessKey

AccessKey is your authentication and authorization token for deploying Picovoice SDKs, including Eagle. Anyone who is
using Picovoice needs to have a valid AccessKey. You must keep your AccessKey secret. You would need internet
connectivity to validate your AccessKey with Picovoice license servers even though the speaker recognition is running
100% offline.

AccessKey also verifies that your usage is within the limits of your account. Everyone who signs up for
[Picovoice Console](https://console.picovoice.ai/) receives the `Free Tier` usage rights described
[here](https://picovoice.ai/pricing/). If you wish to increase your limits, you can purchase a subscription plan.

## Demos

### Python Demos

Install the demo package:

```console
pip3 install pveagledemo
```

#### Speaker Enrollment

Create a new speaker profile:

```console
eagle_demo_mic enroll --access_key ${ACCESS_KEY} --output_profile_path ${OUTPUT_PROFILE_PATH}
```

or

```console
eagle_demo_file enroll \
    --access_key ${ACCESS_KEY} \
    --enroll_audio_paths ${ENROLL_AUDIO_PATHS}
    --output_profile_path ${OUTPUT_PROFILE_PATH}
```

#### Speaker Recognition

Test the speaker recognition engine:

```console
eagle_demo_mic test \
    --access_key ${ACCESS_KEY} \
    --input_profile_paths ${INPUT_PROFILE_PATH}
```

or

```console
eagle_demo_file test \
    --access_key ${ACCESS_KEY} \
    --input_profile_paths ${INPUT_PROFILE_PATH}
    --test_audio_paths ${TEST_AUDIO_PATHS}
```

Replace `${ACCESS_KEY}` with yours obtained from Picovoice Console.

For more information about Python demos go to [demo/python](./demo/python).

### Android Demo

Using Android Studio, open [demo/android/EagleDemo](./demo/android/EagleDemo) as an Android project and then run the application.

Open the file [MainActivity.java](./demo/android/EagleDemo/eagle-demo-app/src/main/java/ai/picovoice/eagledemo/MainActivity.java) and replace `"${YOUR_ACCESS_KEY_HERE}"` in with your `AccessKey`.


### iOS Demo

To run the demo, go to [demo/ios/EagleDemo](./demo/ios/EagleDemo) and run:

```console
pod install
```

Replace `let accessKey = "${YOUR_ACCESS_KEY_HERE}"` in the file [ViewModel.swift](./demo/ios/EagleDemo/EagleDemo/ViewModel.swift) with your `AccessKey`.

Then, using [Xcode](https://developer.apple.com/xcode/), open the generated `EagleDemo.xcworkspace` and run the application.

### C Demos

Build the demo:

```console
cmake -S demo/c/ -B demo/c/build && cmake --build demo/c/build --target eagle_demo_mic
```

To list the available audio input devices:

```console
./demo/c/build/eagle_demo_mic -s
```

#### Speaker Enrollment

To enroll a new speaker:

```console
./demo/c/build/eagle_demo_mic -l ${LIBRARY_PATH} -m ${MODEL_PATH} -a ${ACCESS_KEY} -e ${OUTPUT_PROFILE_PATH}
```

#### Speaker Recognition

To test the speaker recognition engine:

```console
./demo/c/build/eagle_demo_mic -l ${LIBRARY_PATH} -m ${MODEL_PATH} -a ${ACCESS_KEY} -i ${INPUT_PROFILE_PATH}
```

Replace `${LIBRARY_PATH}` with path to appropriate library available under [lib](./lib), `${MODEL_PATH}` with path
to the model file available under [lib/common](./lib/common), `${ACCESS_KEY}` with AccessKey
obtained from [Picovoice Console](https://console.picovoice.ai/). `${OUTPUT_PROFILE_PATH}` in the enrollment step is the
path to the generated speaker profile. `${INPUT_PROFILE_PATH}` in the recognition step is the path to the generated
speaker
profile to be tested.

For more information about C demos go to [demo/c](./demo/c).

### Web Demo

From [demo/web](./demo/web) run the following in the terminal:

```console
yarn
yarn start
```

(or)

```console
npm install
npm run start
```

Open `http://localhost:5000` in your browser to try the demo.

### Node.js Demos

Install the demo package:

```console
npm install -g @picovoice/eagle-node-demo
```

#### Speaker Enrollment

Create a new speaker profile:

```console
eagle-mic-demo --enroll \
    --access_key ${ACCESS_KEY} \
    --output_profile_path ${OUTPUT_PROFILE_PATH}
```

or

```console
eagle-file-demo --enroll \
    --access_key ${ACCESS_KEY} \
    --enroll_audio_paths ${ENROLL_AUDIO_PATH_1 ...} \
    --output_profile_path ${OUTPUT_PROFILE_PATH}
```

#### Speaker Recognition

Test the speaker recognition engine:

```console
eagle-mic-demo --test \
    --access_key ${ACCESS_KEY} \
    --input_profile_paths ${INPUT_PROFILE_PATH_1 ...}
```

or

```console
eagle-file-demo --test \
    --access_key ${ACCESS_KEY} \
    --test_audio_path ${TEST_AUDIO_PATH} \
    --input_profile_paths ${INPUT_PROFILE_PATH_1 ...}
```

Replace `${ACCESS_KEY}` with yours obtained from Picovoice Console.

For more information about Node.js demos go to [demo/nodejs](./demo/nodejs).

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
eagle = pveagle.create_recognizer(access_key, speaker_profile)
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

To include the package in your Android project, ensure you have included `mavenCentral()` in your top-level `build.gradle` file and then add the following to your app's `build.gradle`:

```groovy
dependencies {
    implementation 'ai.picovoice:eagle-android:${LATEST_VERSION}'
}
```

#### Speaker Enrollment

Create an instance of the profiler:

```java
import ai.picovoice.eagle.*;

final String accessKey = "${ACCESS_KEY}";

try {
    EagleProfiler eagleProfiler = new EagleProfiler.Builder()
            .setAccessKey(accessKey)
            .build();
} catch (EagleException e) { }
```

Create a new speaker profile:

```java
public short[] getNextEnrollAudioData() {
    // get audio data
}

EagleProfilerEnrollResult result = null;
try {
    while (result != null && result.getPercentage() < 100.0) {
        result = eagleProfiler.enroll(getNextEnrollAudioData());
    }
} catch (EagleException e) { }
```

Export the speaker profile once enrollment is complete:

```java
try {
    EagleProfile speakerProfile = eagleProfiler.export();
} catch (EagleException e) { }
```

Release the resources acquired by the profiler:

```java
eagleProfiler.delete();
```

#### Speaker Recognition

Create an instance of the engine using the speaker profile exported before:

```java
import ai.picovoice.eagle.*;

final String accessKey = "${ACCESS_KEY}";

try {
    Eagle eagle = new Eagle.Builder()
        .setAccessKey(accessKey)
        .setSpeakerProfile(speakerProfile)
        .build();
} catch (EagleException e) { }
```

Process incoming audio frames:

```java
public short[] getNextAudioFrame() {
    // get audio frame
}


try {
    while (true) {
        float[] scores = eagle.process(getNextAudioFrame());
    }
} catch (EagleException e) { }
```

Finally, when done be sure to explicitly release the resources:

```java
eagle.delete()
```

### iOS

<!-- markdown-link-check-disable -->
The Eagle iOS binding is available via [CocoaPods](https://cocoapods.org/pods/Eagle-iOS). To import it into your iOS project, add the following line to your Podfile and run `pod install`:
<!-- markdown-link-check-enable -->

```ruby
pod 'Eagle-iOS'
```

#### Speaker Enrollment

Create an instance of the profiler:

```swift
import pveagle

let accessKey : String = // .. AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
let eagleProfiler = try EagleProfiler(accessKey: accessKey)
```

Create a new speaker profile:

```swift
func get_next_enroll_audio_data(numSamples: Int) -> [Int16] {
    // ...
}

do {
    let numSamples = eagleProfiler.minEnrollSamples()

    var percentage = 0.0
    var feedback: EagleProfilerEnrollFeedback?

    while (percentage < 100.0) {
        (percentage, feedback) = try eagleProfiler.enroll(pcm: get_next_enroll_audio_data(numSamples: numSamples))
    }
} catch { }
```

Export the speaker profile once enrollment is complete:

```swift
let speakerProfile = try eagleProfiler.export()
```

Release the resources acquired by the profiler:

```swift
eagleProfiler.delete()
```

#### Speaker Recognition

Create an instance of the engine using the speaker profile exported before:

```swift
let eagle = Eagle(accessKey: accessKey, speakerProfiles: [speakerProfile])
```

Process incoming audio frames:

```swift
func get_next_audio_frame() -> [Int16] {
    // ...
}

do {
    let profileScores = try eagle.process(pcm: get_next_audio_frame())
} catch { }
```

Finally, when done be sure to explicitly release the resources:

```swift
eagle.delete()
```

### C

[include/pv_eagle.h](./include/pv_eagle.h) header file contains relevant information.

#### Speaker Enrollment

Build an instance of the profiler:

```c
const char *access_key = "${ACCESS_KEY}";
const char *model_path = "${MODEL_PATH}";

pv_eagle_profiler_t *eagle_profiler = NULL;
pv_status_t status = pv_eagle_profiler_init(
            access_key,
            model_path,
            &eagle_profiler);
if (status != PV_STATUS_SUCCESS) {
    // error handling logic
}
```

Replace `${ACCESS_KEY}` with the AccessKey obtained from Picovoice Console, and `${MODEL_PATH}` with the path to the
model file available under [lib/common](./lib/common).

Use `eagle_profiler` to create a new speaker profile:

```c
extern const int16_t *get_next_enroll_audio_frame(void);
extern const int32_t get_next_enroll_audio_num_samples(void);

float enroll_percentage = 0.0f;
pv_eagle_profiler_enroll_feedback_t feedback = PV_EAGLE_PROFILER_ENROLLMENT_ERROR_AUDIO_OK;

while (enroll_percentage < 100.0f) {
  status = pv_eagle_profiler_enroll(
          eagle_profiler,
          get_next_enroll_audio_frame(),
          get_next_enroll_audio_num_samples(),
          &feedback,
          &enroll_percentage);
  if (status != PV_STATUS_SUCCESS) {
      // error handling logic
  }
}

int32_t profile_size_bytes = 0;
status = pv_eagle_profiler_export_size(eagle_profiler, &profile_size_bytes);
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

#### Speaker Recognition

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

### Web

Install the Eagle package with `yarn` (or `npm`):

```console
yarn add @picovoice/eagle-web
```

#### Speaker Enrollment

Create an instance of the `EagleProfiler`:

```typescript
const eagleModel = {
  publicPath: ${MODEL_RELATIVE_PATH},
  // or
  base64: ${MODEL_BASE64_STRING},
}

const eagleProfiler = await EagleProfiler.create(
        ${ACCESS_KEY},
        eagleModel);
```

Replace `${ACCESS_KEY}` with the AccessKey obtained from Picovoice Console, and the model options with the path to the model file available under [lib/common](./lib/common) or a base64 string of it.

Use `EagleProfiler` to create a new speaker profile:
```typescript
function getAudioData(numSamples): Int16Array {
  // get audio frame of size `numSamples`
}

let percentage = 0;
while (percentage < 100) {
  const audioData = getAudioData(eagleProfiler.minEnrollSamples);

  const result: EagleProfilerEnrollResult = await eagleProfiler.enroll(audioData);
  if (result.feedback === EagleProfilerEnrollFeedback.AUDIO_OK) {
      // audio is good!
  } else {
      // feedback code will tell you why audio was not used in enrollment
  }
  percentage = result.percentage;
}

// export speaker profile
const speakerProfile: EagleProfile = eagleProfiler.export();
```

#### Speaker Recognition

Create an instance of the engine with one or more speaker profiles created by the `EagleProfiler`:

```typescript
const eagle = await Eagle.create(
        ${ACCESS_KEY},
        eagleModel,
        speakerProfile);
```

Process audio frames and get speaker scores (i.e. likelihood they are speaking) in real-time:
```typescript
function getAudioData(numSamples): Int16Array {
  // get audio frame of size `numSamples`
}

while (true) {
  const audioData = getAudioData(eagle.frameLength);
  const scores: number[] = await eagle.process(audioData);
}
```

### Node.js

Install Node.js SDK:

```console
yarn add @picovoice/eagle-node
```

#### Speaker Enrollment

Create an instance of the profiler:

```typescript
const { EagleProfiler } = require("@picovoice/eagle-node");

const accessKey = "${ACCESS_KEY}"; // Obtained from the Picovoice Console (https://console.picovoice.ai/)
const eagleProfiler = new EagleProfiler(accessKey);
```

Create a new speaker profile:

```typescript
const { EnrollProgress } = require("@picovoice/eagle-node");

function getAudioData(numSamples): Int16Array {
  // get audio frame of size `numSamples`
}

let percentage = 0;
while (percentage < 100) {
  const audioData = getAudioData(eagleProfiler.minEnrollSamples);
  
  const result: EnrollProgress = await eagleProfiler.enroll(audioData);
  if (result.feedback === EagleProfilerEnrollFeedback.NONE) {
      // audio is good!
  } else {
      // feedback code will tell you why audio was not used in enrollment
  }
  percentage = result.percentage;
}
```

Export the speaker profile once enrollment is complete:

```typescript
const speakerProfile: Uint8Array = eagleProfiler.export();
```

Release the resources acquired by the profiler:

```typescript
eagleProfiler.release();
```

#### Speaker Recognition

Create an instance of the engine using the speaker profile exported before:

```typescript
const { Eagle } = require("@picovoice/eagle-node");

const accessKey = "${ACCESS_KEY}"; // Obtained from the Picovoice Console (https://console.picovoice.ai/)
const eagle = new Eagle(accessKey, speakerProfile);
```

Process incoming audio frames:

```typescript
function getAudioData(numSamples): Int16Array {
  // get audio frame of size `numSamples`
}

while (true) {
  const audioData = getAudioData(eagle.frameLength);
  const scores: number[] = eagle.process(audioData);
}
```

Finally, when done be sure to explicitly release the resources:

```typescript
eagle.release()
```

## Releases

### v1.0.0 - January 24th, 2024

 - Enhanced engine accuracy
 - Improved the enrollment process
 - Added Raspberry Pi 5 support
 - Various bug fixes and improvements

### v0.2.0 - November 24th, 2023

- Improvements to error reporting
- Upgrades to authorization and authentication system
- Various bug fixes and improvements
- Web min support bumped to Node 16
- iOS support bumped to iOS 13

### v0.1.0 - May 29, 2023

- Beta release

## FAQ

You can find the FAQ [here](https://picovoice.ai/docs/faq/general/).
