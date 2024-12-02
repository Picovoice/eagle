# Eagle iOS Demo

## AccessKey

Eagle requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Eagle SDKs.
You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

## Setup

Replace `{YOUR_ACCESS_KEY_HERE}` inside [`ViewModel.swift`](EagleDemo/EagleDemo/ViewModel.swift) with
your AccessKey obtained from [Picovoice Console](https://console.picovoice.ai/).

## Usage

Open the EagleDemo Xcode project ([.xcodeproj](EagleDemo/EagleDemo.xcodeproj/)) and build. Launch the demo on a simulator or a physical iOS device.

1. Press the enroll button.
2. Start talking. Continue talking until the enrollment process reaches 100%.
3. Repeat steps 1 to 2 for as many unique speakers as you would like to enroll.
4. Press test.
5. Start talking. Eagle will detect which speaker is talking and indicate the percentage in the speaker table.
