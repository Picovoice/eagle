# Eagle Binding for Node.js

## Eagle Speaker Recognition Engine

Made in Vancouver, Canada by [Picovoice](https://picovoice.ai)

Eagle is an on-device speaker recognition engine. Eagle is:

- Private; All voice processing runs locally.
- Cross-Platform:
    - Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64, arm64)
    - Android and iOS
    - Chrome, Safari, Firefox, and Edge
    - Raspberry Pi (3, 4, 5)

## Compatibility

- Node.js 16+
- Runs on Linux (x86_64), macOS (x86_64, arm64), Windows (x86_64, arm64), and Raspberry Pi (3, 4, 5).

## Installation

Using `yarn`:

```console
yarn add @picovoice/eagle-node
```

or using `npm`:

```console
npm install --save @picovoice/eagle-node
```

## AccessKey

Eagle requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Eagle
SDKs. You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

## Usage

Eagle has two distinct steps: Enrollment and Recognition. In the enrollment step, Eagle analyzes a series of
utterances from a particular speaker to learn their unique voiceprint. This step produces a profile object,
which can be stored and utilized during inference. During the Recognition step, Eagle compares the incoming frames of
audio to the voiceprints of all enrolled speakers in real-time to determine the similarity between them.

### Speaker Enrollment

Create an instance of the profiler:

```typescript
const { EagleProfiler } = require("@picovoice/eagle-node");

const accessKey = "${ACCESS_KEY}"; // Obtained from the Picovoice Console (https://console.picovoice.ai/)
const eagleProfiler = new EagleProfiler(accessKey);
```

`EagleProfiler` is responsible for processing and enrolling PCM audio data, with the valid audio sample rate determined
by `eagleProfiler.sampleRate`. The audio data must be 16-bit linearly-encoded and single-channel.

When passing samples to `eagleProfiler.enroll`, the number of samples must be at
least `eagleProfiler.minEnrollSamples` to ensure sufficient data for enrollment. The percentage value
returned from this process indicates the progress of enrollment, while the feedback value can be utilized to determine the status of the enrollment process.

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

After the percentage reaches 100%, the enrollment process is considered complete. While it is possible to continue
providing additional audio data to the profiler to improve the accuracy of the voiceprint, it is not necessary to do so.
Moreover, if the audio data submitted is unsuitable for enrollment, the feedback value will indicate the reason, and the
enrollment progress will remain unchanged.

```typescript
const speakerProfile: Uint8Array = eagleProfiler.export();
```

The `eagleProfiler.export()` function produces a binary array, which can be saved to a file.

To reset the profiler and enroll a new speaker, the `eagleProfiler.reset()` method can be used. This method clears all
previously stored data, making it possible to start a new enrollment session with a different speaker.

Finally, when done be sure to explicitly release the resources:

```typescript
eagleProfiler.release();
```

### Speaker Recognition

Create an instance of the engine with one or more speaker profiles created by the profiler:

```typescript
const { Eagle } = require("@picovoice/eagle-node");

const accessKey = "${ACCESS_KEY}"; // Obtained from the Picovoice Console (https://console.picovoice.ai/)
const eagle = new Eagle(accessKey, speakerProfile);
```

When initialized, `eagle.sampleRate` specifies the valid sample rate for Eagle. The expected length of a frame, or the
number of audio samples in an input array, is defined by `eagle.frameLength`.

Like the profiler, Eagle is designed to work with single-channel audio that is encoded using 16-bit linear PCM.

```typescript
function getAudioData(numSamples): Int16Array {
  // get audio frame of size `numSamples`
}

while (true) {
  const audioData = getAudioData(eagle.frameLength);
  const scores: number[] = eagle.process(audioData);
}
```

The return value `scores` represents the degree of similarity between the input audio frame and the enrolled speakers.
Each value is a floating-point number ranging from 0 to 1, with higher values indicating a greater degree of similarity.

Finally, when done be sure to explicitly release the resources:

```typescript
eagle.release();
```

## Demos

The [Eagle Node.js demo package](https://www.npmjs.com/package/@picovoice/eagle-node-demo) provides command-line utilities for processing audio using Eagle.
