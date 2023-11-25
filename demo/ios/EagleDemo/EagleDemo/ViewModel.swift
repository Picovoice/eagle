//
//  Copyright 2023 Picovoice Inc.
//  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
//  file accompanying this source.
//  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
//  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
//  specific language governing permissions and limitations under the License.
//

import AVFoundation
import Foundation
import Eagle
import ios_voice_processor

enum UIState {
    case INTRO
    case ENROLLING
    case TESTING
    case FATAL_ERROR
}

class ViewModel: ObservableObject {

    private let accessKey = "{YOUR_ACCESS_KEY_HERE}"

    private var eagleProfiler: EagleProfiler!
    private var eagle: Eagle!

    private var profiles: [EagleProfile] = []

    private var enrollPcmBuffer: [Int16] = []

    @Published var scores: [Float] = []
    @Published var enrollPercentage: Float = 0
    @Published var enrollFeedback: String = ""

    static let defaultStatusText = "Press 'Enroll' to enroll a speaker"
    @Published var statusText = defaultStatusText
    @Published var errorMessage = ""
    @Published var state: UIState = UIState.INTRO

    public func reset() {
        if self.state == UIState.ENROLLING {
            try? stopEnroll()
        }
        if self.state == UIState.TESTING {
            stopTest()
        }
        self.profiles = []
        self.scores = []
        self.statusText = ViewModel.defaultStatusText
        self.state = UIState.INTRO
    }

    private func setEnrollFeedback(feedback: EagleProfilerEnrollFeedback) {
        switch feedback {
        case EagleProfilerEnrollFeedback.AUDIO_TOO_SHORT:
            enrollFeedback = "Insufficient audio length"
        case EagleProfilerEnrollFeedback.UNKNOWN_SPEAKER:
            enrollFeedback = "Different speaker detected in audio"
        case EagleProfilerEnrollFeedback.NO_VOICE_FOUND:
            enrollFeedback = "Unable to detect voice in audio"
        case EagleProfilerEnrollFeedback.QUALITY_ISSUE:
            enrollFeedback = "Audio quality too low to use for enrollment"
        default:
            enrollFeedback = ""
        }
    }

    private func initProfiler() {
        do {
            try eagleProfiler = EagleProfiler(accessKey: accessKey)
            statusText = "Please keep speaking until the enrollment percentage reaches 100%"

            try createDumpFile(filename: "enroll_dump.pcm")
        } catch let error as EagleInvalidArgumentError {
            errorMessage = "\(error.localizedDescription)"
        } catch is EagleActivationError {
            errorMessage = "AccessKey activation error"
        } catch is EagleActivationRefusedError {
            errorMessage = "AccessKey activation refused"
        } catch is EagleActivationLimitError {
            errorMessage = "AccessKey reached its limit"
        } catch is EagleActivationThrottledError {
            errorMessage = "AccessKey is throttled"
        } catch {
            errorMessage = "\(error)"
        }
    }

    private func enrollAudioCallback(pcm: [Int16]) {
        enrollPcmBuffer.append(contentsOf: pcm)
        do {
            let minEnrollSamples = try eagleProfiler.minEnrollSamples()
            if enrollPcmBuffer.count >= minEnrollSamples {
                let enrollFrame = Array(enrollPcmBuffer[0..<minEnrollSamples])
                enrollPcmBuffer.removeFirst(minEnrollSamples)

                let (percentage, feedback) = try eagleProfiler.enroll(pcm: enrollFrame)
                if percentage >= 100.0 {
                    try stopEnroll(export: true)
                }

                DispatchQueue.main.async {
                    self.enrollPercentage = percentage
                    self.setEnrollFeedback(feedback: feedback)
                }

                try appendToDumpFile(pcm: enrollFrame)
            }
        } catch {
            self.errorMessage = "Failed to process pcm frames for enrollment."
            try? self.stopEnroll()
        }
    }

    public func enroll() throws {
        state = UIState.ENROLLING
        initProfiler()

        guard try VoiceProcessor.shared.hasPermissions() else {
            print("Permissions denied.")
            return
        }

        enrollPercentage = 0.0
        enrollFeedback = ""

        try VoiceProcessor.shared.start(
            frameLength: UInt32(512),
            sampleRate: UInt32(EagleProfiler.sampleRate),
            audioCallback: self.enrollAudioCallback)
    }

    private func stopEnroll(export: Bool = false) throws {
        VoiceProcessor.shared.stop()
        if export == true {
            let newProfile = try eagleProfiler.export()
            DispatchQueue.main.async {
                self.profiles.append(newProfile)
                self.scores.append(0)
            }
        }

        if eagleProfiler != nil {
            eagleProfiler.delete()
            eagleProfiler = nil
        }

        DispatchQueue.main.async {
            self.state = UIState.INTRO
            self.statusText = "Press 'Test' to begin recognition"

            self.dumpFile = nil
        }
    }

    private func initEagle() {
        do {
            try eagle = Eagle(accessKey: accessKey, speakerProfiles: profiles)
            statusText = ""

            try createDumpFile(filename: "test_dump.pcm")
        } catch let error as EagleInvalidArgumentError {
            errorMessage = "\(error.localizedDescription)"
        } catch is EagleActivationError {
            errorMessage = "AccessKey activation error"
        } catch is EagleActivationRefusedError {
            errorMessage = "AccessKey activation refused"
        } catch is EagleActivationLimitError {
            errorMessage = "AccessKey reached its limit"
        } catch is EagleActivationThrottledError {
            errorMessage = "AccessKey is throttled"
        } catch {
            errorMessage = "\(error)"
        }
    }

    private func testAudioCallback(pcm: [Int16]) {
        do {
            let profileScores = try eagle.process(pcm: pcm)

            DispatchQueue.main.async {
                self.scores = profileScores
            }

            try appendToDumpFile(pcm: pcm)
        } catch {
            self.errorMessage = "Failed to process pcm frames for enrollment."
            self.stopTest()
        }
    }

    public func test() throws {
        state = UIState.TESTING
        initEagle()

        guard try VoiceProcessor.shared.hasPermissions() else {
            print("Permissions denied.")
            self.errorMessage = "App does not have microphone permissions"
            return
        }

        try VoiceProcessor.shared.start(
            frameLength: UInt32(Eagle.frameLength),
            sampleRate: UInt32(Eagle.sampleRate),
            audioCallback: self.testAudioCallback)
    }

    public func stopTest() {
        VoiceProcessor.shared.stop()

        if eagle != nil {
            eagle.delete()
            eagle = nil
        }

        DispatchQueue.main.async {
            self.state = UIState.INTRO
        }
    }

    private let dumpAudio = false
    private var dumpFile: URL?

    private func createDumpFile(filename: String) throws {
        if dumpAudio {
            let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
            dumpFile = directory!.appendingPathComponent(filename)
            try Data().write(to: dumpFile!)
        }
    }

    private func appendToDumpFile(pcm: [Int16]) throws {
        if dumpAudio {
            let data = Data(bytes: pcm, count: pcm.count * MemoryLayout<Int16>.stride)
            if let fileHandle = FileHandle(forWritingAtPath: dumpFile!.path) {
                try fileHandle.seekToEnd()
                fileHandle.write(data)
                try fileHandle.close()
            }
        }
    }
}
