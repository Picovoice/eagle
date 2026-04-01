//
//  Copyright 2023-2024 Picovoice Inc.
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

    private var frameListener: VoiceProcessorFrameListener?
    private var testListener: VoiceProcessorFrameListener?
    private var errorListener: VoiceProcessorErrorListener?
    private var testErrorListener: VoiceProcessorErrorListener?

    private var eagleProfiler: EagleProfiler!
    private var eagle: Eagle!

    private var profiles: [EagleProfile] = []

    private var processPcmBuffer: [Int16] = []

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
            try? stopTest()
        }
        self.profiles = []
        self.scores = []
        self.statusText = ViewModel.defaultStatusText
        self.state = UIState.INTRO
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
            errorMessage = "\(error.localizedDescription)"
        }
    }

    public func enroll() throws {
        state = UIState.ENROLLING
        initProfiler()

        self.errorListener = VoiceProcessorErrorListener({ error in
            self.errorMessage = "\(error)"
        })
        self.frameListener = VoiceProcessorFrameListener({ pcm in
            guard let eagleProfiler = self.eagleProfiler else {
                return
            }

            do {
                let percentage = try eagleProfiler.enroll(pcm: pcm)
                if percentage >= 100.0 {
                    try self.stopEnroll(export: true)
                }

                DispatchQueue.main.async {
                    self.enrollPercentage = percentage
                }

                try self.appendToDumpFile(pcm: pcm)
            } catch {
                self.errorMessage = "Failed to process pcm frames for enrollment."
                try? self.stopEnroll()
            }
        })

        VoiceProcessor.instance.addErrorListener(self.errorListener!)
        VoiceProcessor.instance.addFrameListener(self.frameListener!)

        enrollPercentage = 0.0
        enrollFeedback = ""

        do {
            try VoiceProcessor.instance.start(
                frameLength: UInt32(EagleProfiler.frameLength),
                sampleRate: UInt32(EagleProfiler.sampleRate))
        } catch {
            errorMessage = "\(error)"
        }
    }

    private func stopEnroll(export: Bool = false) throws {
        VoiceProcessor.instance.removeErrorListener(errorListener!)
        VoiceProcessor.instance.removeFrameListener(frameListener!)

        if VoiceProcessor.instance.numFrameListeners == 0 {
            do {
                try VoiceProcessor.instance.stop()
            } catch {
                throw EagleError(error.localizedDescription)
            }
        }

        if export == true {
            let newProfile = try eagleProfiler.export()
            DispatchQueue.main.async {
                self.profiles.append(newProfile)
                self.scores.append(0)
                print("profiles", self.profiles.count)
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
            try eagle = Eagle(accessKey: accessKey)
            statusText = ""

            self.testErrorListener = VoiceProcessorErrorListener({ error in
                self.errorMessage = "\(error)"
            })
            self.testListener = VoiceProcessorFrameListener({ pcm in
                self.processPcmBuffer.append(contentsOf: pcm)
                do {
                    let minProcessSamples = try self.eagle.minProcessSamples()
                    if self.processPcmBuffer.count >= minProcessSamples {
                        let processFrame = Array(self.processPcmBuffer[0..<minProcessSamples])
                        self.processPcmBuffer.removeFirst(minProcessSamples)
                        
                        let profileScores = try self.eagle.process(pcm: processFrame, speakerProfiles: self.profiles)
                        print("scores", self.profiles.count, profileScores);
                        
                        if (profileScores != nil) {
                            DispatchQueue.main.async {
                                self.scores = profileScores!
                            }
                        } else {
                            DispatchQueue.main.async {
                                self.scores = Array(repeating: 0, count: self.profiles.count) 
                            }
                        }
                        
                        try self.appendToDumpFile(pcm: processFrame)
                    }
                } catch {
                    self.errorMessage = "Failed to process pcm frames for enrollment."
                    try? self.stopTest()
                }
            })

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

    public func test() throws {
        state = UIState.TESTING
        initEagle()

        VoiceProcessor.instance.addErrorListener(testErrorListener!)
        VoiceProcessor.instance.addFrameListener(testListener!)

        do {
            try VoiceProcessor.instance.start(
                frameLength: UInt32(EagleProfiler.frameLength),
                sampleRate: UInt32(Eagle.sampleRate))
        } catch {
            throw EagleError(error.localizedDescription)
        }
    }

    public func stopTest() throws {
        VoiceProcessor.instance.removeErrorListener(testErrorListener!)
        VoiceProcessor.instance.removeFrameListener(testListener!)

        if VoiceProcessor.instance.numFrameListeners == 0 {
            do {
                try VoiceProcessor.instance.stop()
            } catch {
                throw EagleError(error.localizedDescription)
            }
        }

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
