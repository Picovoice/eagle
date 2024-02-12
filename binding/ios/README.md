# Eagle Binding for iOS

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

- iOS 13.0+

## Installation
<!-- markdown-link-check-disable -->
The Eagle iOS binding is available via [Cocoapods](https://cocoapods.org/pods/Eagle-iOS). To import it into your iOS project, add the following line to your Podfile:
<!-- markdown-link-check-enable -->

```ruby
pod 'Eagle-iOS'
```

## AccessKey

Eagle requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Eagle SDKs.
You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

## Usage

Eagle consists of two distinct steps: Enrollment and Recognition. In the enrollment step, Eagle analyzes a series of
utterances from a particular speaker to learn their unique voiceprint. This step results in an `EagleProfile` object,
which can be stored and utilized during inference. During the Recognition step, Eagle compares the incoming frames of
audio to the voiceprints of all enrolled speakers in real-time to determine the similarity between them.

### Speaker Enrollment

Create an instance of the profiler:

```swift
import Eagle

let accessKey : String = // .. AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
do {
    let eagleProfiler = try EagleProfiler(accessKey: accessKey)
} catch { }
```

`EagleProfiler` is responsible for processing and enrolling PCM audio data, with the valid audio sample rate determined by `EagleProfiler.sampleRate`. The audio data must be 16-bit linearly-encoded and single-channel.

When passing samples to `eagleProfiler.enroll()`, the number of samples must be at least `eagleProfiler.minEnrollSamples()` to ensure sufficient data for enrollment. The percentage value obtained from this process indicates the progress of enrollment, while the feedback value can be utilized to determine the status of the enrollment process.

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

After the percentage reaches 100%, the enrollment process is considered complete. While it is possible to continue
providing additional audio data to the profiler to improve the accuracy of the voiceprint, it is not necessary to do so.
Moreover, if the audio data submitted is unsuitable for enrollment, the feedback value will indicate the reason, and the enrollment progress will remain unchanged.

```swift
let speakerProfile = try eagleProfiler.export()
```

To reset the profiler and enroll a new speaker, the `eagleProfiler.reset()` method can be used. This method clears all previously stored data, making it possible to start a new enrollment session with a different speaker.

Finally, when done be sure to explicitly release the resources:

```swift
eagleProfiler.delete()
```

### Speaker Recognition

Create an instance of the engine:

```swift
let eagle = Eagle(accessKey: accessKey, speakerProfiles: [speakerProfile])
```

`Eagle.sampleRate` specifies the valid sample rate for Eagle. The expected length of a frame, or the number of audio samples in an input array, is defined by `Eagle.frameLength`.

Like the profiler, Eagle is designed to work with single-channel audio that is encoded using 16-bit linear PCM.

```swift
func get_next_audio_frame() -> [Int16] {
    // ...
}

do {
    let profileScores = try eagle.process(pcm: get_next_audio_frame())
} catch { }
```

The return value `profileScores` represents the degree of similarity between the input audio frame and the enrolled speakers.
This value is an array of floating-point numbers ranging from 0 to 1, with higher values indicating a greater degree of similarity. Index 0 indicates the first speaker, index 1 the second, and so on.

Finally, when done be sure to explicitly release the resources:

```swift
eagle.delete()
```

## Running Unit Tests

Copy your `AccessKey` into the `accessKey` variable in [`EagleAppTestUITests.swift`](EagleAppTest/EagleAppTestUITests/EagleAppTestUITests.swift). Open `EagleAppTest.xcworkspace` with XCode and run the tests with `Product > Test`.
