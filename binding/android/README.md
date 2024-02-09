# Eagle Binding for Android

## Eagle Speaker Recognition Engine

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

Eagle is an on-device speaker recognition engine. Eagle is:

- Private; All voice processing runs locally.
- Cross-Platform:
    - Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64)
    - Android and iOS
    - Chrome, Safari, Firefox, and Edge
    - Raspberry Pi (3, 4, 5) and NVIDIA Jetson Nano

## Compatibility

- Android 5.0+ (API 21+)

## Installation

Eagle can be found on Maven Central. To include the package in your Android project, ensure you have included `mavenCentral()` in your top-level `build.gradle` file and then add the following to your app's `build.gradle`:

```groovy
dependencies {
    // ...
    implementation 'ai.picovoice:eagle-android:${LATEST_VERSION}'
}
```

## AccessKey

Eagle requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Eagle
SDKs. You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

## Permissions

To enable AccessKey validation and recording with your Android device's microphone, you must add the following line to your `AndroidManifest.xml` file:
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
```

## Usage

Eagle has two distinct steps: Enrollment and Recognition. In the enrollment step, Eagle analyzes a series of
utterances from a particular speaker to learn their unique voiceprint. This step produces an `EagleProfile` object,
which can be stored and utilized during inference. During the Recognition step, Eagle compares the incoming frames of
audio to the voiceprints of all enrolled speakers in real-time to determine the similarity between them.

### Speaker Enrollment

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

`EagleProfiler` is responsible for processing and enrolling PCM audio data, with the valid audio sample rate determined
by `eagleProfiler.getSampleRate()`. The audio data must be 16-bit linearly-encoded and single-channel.

When passing samples to `eagleProfiler.enroll()`, the number of samples must be at
least `eagleProfiler.getMinEnrollSamples()` to ensure sufficient data for enrollment. The percentage value
obtained from this process indicates the progress of enrollment, while the feedback value can be utilized to determine
the status of the enrollment process.

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

After the percentage reaches 100%, the enrollment process is considered complete. While it is possible to continue
providing additional audio data to the profiler to improve the accuracy of the voiceprint, it is not necessary to do so.
Moreover, if the audio data submitted is unsuitable for enrollment, the feedback value will indicate the reason, and the
enrollment progress will remain unchanged.

```java
try {
    EagleProfile speakerProfile = eagleProfiler.export();
} catch (EagleException e) { }
```

The `eagleProfiler.export()` function produces an `EagleProfile` object, which can be converted into a binary form
using the `EagleProfile.getBytes()` method. This binary representation can be saved and subsequently retrieved using
the constructor (`new EagleProfile(bytes)`) method.

To reset the profiler and enroll a new speaker, the `eagleProfiler.reset()` method can be used. This method clears all
previously stored data, making it possible to start a new enrollment session with a different speaker.

Finally, when done be sure to explicitly release the resources:

```java
eagleProfiler.delete();
```

### Speaker Recognition

Create an instance of the engine:

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

When initialized, `eagle.getSampleRate()` specifies the valid sample rate for Eagle. The expected length of a frame, or the
number of audio samples in an input array, is defined by `eagle.getFrameLength()`.

Like the profiler, Eagle is designed to work with single-channel audio that is encoded using 16-bit linear PCM.

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

The return value `scores` represents the degree of similarity between the input audio frame and the enrolled speakers.
This value is a floating-point number ranging from 0 to 1, with higher values indicating a greater degree of similarity.

Finally, when done be sure to explicitly release the resources:

```java
eagle.delete()
```

## Demos

For example usage, refer to our [Android demo application](../../demo/android).
