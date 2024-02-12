# Eagle Binding for Web

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

- Chrome / Edge
- Firefox
- Safari

### Restrictions

IndexedDB is required to use `Eagle` in a worker thread. Browsers without IndexedDB support
(i.e. Firefox Incognito Mode) should use `Eagle` in the main thread.

## Installation

Using `yarn`:

```console
yarn add @picovoice/eagle-web
```

or using `npm`:

```console
npm install --save @picovoice/eagle-web
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

Create an instance of the `EagleProfiler`:

```typescript
const eagleModel = {
  publicPath: ${MODEL_RELATIVE_PATH},
  // or
  base64: ${MODEL_BASE64_STRING},
}

// Main thread
const eagleProfiler = await EagleProfiler.create(
        ${ACCESS_KEY},
        eagleModel);

// or on worker thread
const eagleProfiler = await EagleProfilerWorker.create(
        ${ACCESS_KEY},
        eagleModel);
```

`EagleProfiler` is responsible for processing and enrolling PCM audio data, with the valid audio sample rate determined
by `eagleProfiler.sampleRate`. The audio data must be 16-bit linearly-encoded and single-channel.

When passing samples to `eagleProfiler.enroll`, the number of samples must be at
least `eagleProfiler.minEnrollSamples` to ensure sufficient data for enrollment. The percentage value
returned from this process indicates the progress of enrollment, while the feedback value can be utilized to determine the status of the enrollment process.

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
```

After the percentage reaches 100%, the enrollment process is considered complete. While it is possible to continue
providing additional audio data to the profiler to improve the accuracy of the voiceprint, it is not necessary to do so.
Moreover, if the audio data submitted is unsuitable for enrollment, the feedback value will indicate the reason, and the
enrollment progress will remain unchanged.

```typescript
const speakerProfile: EagleProfile = eagleProfiler.export();
```

The `eagleProfiler.export()` function produces a binary array, which can be saved to a file.

To reset the profiler and enroll a new speaker, the `eagleProfiler.reset()` method can be used. This method clears all
previously stored data, making it possible to start a new enrollment session with a different speaker.

Finally, when done be sure to explicitly release the resources:

```typescript
eagleProfiler.release();

// if on worker thread
eagleProfiler.terminate();
```

### Speaker Recognition

Create an instance of the engine with one or more speaker profiles created by the `EagleProfiler`:

```typescript
// Main thread
const eagle = await Eagle.create(
        ${ACCESS_KEY},
        eagleModel,
        speakerProfile);

// or, on a worker thread
const eagle = await EagleWorker.create(
        ${ACCESS_KEY},
        eagleModel,
        speakerProfile);
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
  const scores: number[] = await eagle.process(audioData);
}
```

The return value `scores` represents the degree of similarity between the input audio frame and the enrolled speakers.
Each value is a floating-point number ranging from 0 to 1, with higher values indicating a greater degree of similarity.

Finally, when done be sure to explicitly release the resources:

```typescript
eagle.release();

// if on worker thread
eagle.terminate();
```

### Eagle Model

The default model is located in [lib/common](../../lib/common). Use it with the `EagleModel` type:

```typescript
const eagleModel = {
  publicPath: ${MODEL_RELATIVE_PATH},
  // or
  base64: ${MODEL_BASE64_STRING},

  // Optionals
  customWritePath: "eagle_model",
  forceWrite: false,
  version: 1,
}
```

Eagle saves and caches your model file in IndexedDB to be used by WebAssembly. Use a different `customWritePath` variable
to hold multiple models and set the `forceWrite` value to true to force re-save a model file.

Either `base64` or `publicPath` must be set to instantiate Eagle. If both are set, Eagle will use the `base64` model.

#### Public Directory

**NOTE**: Due to modern browser limitations of using a file URL, this method does __not__ work if used without hosting a server.

This method fetches the model file from the public directory and passes it to Eagle. Copy the model file into the public directory.

#### Base64

**NOTE**: This method works without hosting a server, but increases the size of the model file roughly by 33%.

This method uses a base64 string of the model file and passes it to Eagle. Use the built-in script `pvbase64` to
base64 your model file:

```console
npx pvbase64 -i ${EAGLE_MODEL_PATH} -o ${BASE64_MODEL_PATH}.js
```

The output will be a js file which you can import into any file of your project. For detailed information about `pvbase64`,
run:

```console
npx pvbase64 -h
```

## Demos

For example usage refer to our [Web demo application](https://github.com/Picovoice/eagle/tree/main/demo/web).
