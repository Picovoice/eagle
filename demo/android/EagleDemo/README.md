# Eagle Demo

## AccessKey

Eagle requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Eagle SDKs.
You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

## Setup

Replace `"${YOUR_ACCESS_KEY_HERE}"` inside [MainActivity.java](eagle-demo-app/src/main/java/ai/picovoice/eagledemo/MainActivity.java)
with your AccessKey obtained from [Picovoice Console](https://console.picovoice.ai/).

1. Open the project in Android Studio
2. Build and run on an installed simulator or a connected Android device

## Usage

1. Press the `ENROLL` button.
2. Keep talking until `Eagle` has gathered enough audio to enroll a speaker.
3. Press the `TEST` button to start testing voice recognition.
4. Repeat from step 1 to test `Eagle` with more speakers.

## Running the Instrumented Unit Tests

Ensure you have an Android device connected or simulator running. Then run the following from the terminal:

```console
cd demo/android/EagleDemo
./gradlew connectedAndroidTest -PpvTestingAccessKey="YOUR_ACCESS_KEY_HERE"
```

The test results are stored in `eagle-demo-app/build/reports`.
