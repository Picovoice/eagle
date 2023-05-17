# Octopus iOS Demo

## AccessKey

Octopus requires a valid Picovoice `AccessKey` at initialization. `AccessKey` acts as your credentials when using Octopus SDKs.
You can get your `AccessKey` for free. Make sure to keep your `AccessKey` secret.
Signup or Login to [Picovoice Console](https://console.picovoice.ai/) to get your `AccessKey`.

## Setup

1. Before building the demo app, run the following from this directory to install the Octopus CocoaPod:
```console
pod install
```
2. Replace `"YOUR_ACCESS_KEY_HERE"` inside [`ViewModel.swift`](OctopusDemo/OctopusDemo/ViewModel.swift) with
your AccessKey obtained from [Picovoice Console](https://console.picovoice.ai/).

## Usage
Open the OctopusDemo Xcode project and build. Launch the demo on a simulator or a physical iOS device.

1. Press the record button.
2. Start talking. Record some phrases or whatever audio you would like to search.
3. Press stop. Wait for the info box to display "Indexing Complete". This may take a few seconds.
4. Enter your search phrase into the text input and press search. The results will appear below.
5. You can continue to enter in new search phrases without re-recording or re-indexing the audio.
