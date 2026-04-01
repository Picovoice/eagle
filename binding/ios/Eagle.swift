//
//  Copyright 2023-2026 Picovoice Inc.
//  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
//  file accompanying this source.
//  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
//  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
//  specific language governing permissions and limitations under the License.
//

import Foundation
import PvEagle

/// Eagle class for iOS Eagle text-independent speaker recognition engine.
/// It can determine audio similarity scores given a set of EagleProfiles.
public class Eagle: EagleBase {

    private var handle: OpaquePointer?

    private var minProcessAudioLength: Int?

    /// Constructor.
    ///
    /// - Parameters:
    ///   - accessKey: AccessKey obtained from the Picovoice Console (https://console.picovoice.ai/)
    ///   - modelPath: Absolute path to file containing model parameters.
    ///   - device: String representation of the device (e.g., CPU or GPU) to use. If set to `best`, the most
    ///     suitable device is selected automatically. If set to `gpu`, the engine uses the first available GPU
    ///     device. To select a specific GPU device, set this argument to `gpu:${GPU_INDEX}`, where `${GPU_INDEX}`
    ///     is the index of the target GPU. If set to `cpu`, the engine will run on the CPU with the default
    ///     number of threads. To specify the number of threads, set this argument to `cpu:${NUM_THREADS}`,
    ///     where `${NUM_THREADS}` is the desired number of threads.
    ///   - voiceThreshold: Sensitivity threshold for detecting voice.
    /// - Throws: EagleError
    public init(
        accessKey: String,
        modelPath: String? = nil,
        device: String? = nil,
        voiceThreshold: Float = 0.3
    ) throws {
        super.init()

        var modelPathArg = modelPath

        if modelPath == nil {
            modelPathArg = EagleBase.resourceBundle.path(forResource: "eagle_params", ofType: "pv")
            if modelPathArg == nil {
                throw EagleIOError("Could not find default model file in app bundle.")
            }
        }

        if !FileManager().fileExists(atPath: modelPathArg!) {
            modelPathArg = try self.getResourcePath(modelPathArg!)
        }

        var deviceArg = device
        if device == nil {
            deviceArg = "best"
        }

        pv_set_sdk(Eagle.sdk)

        var status = pv_eagle_init(
            accessKey,
            modelPathArg,
            deviceArg,
            voiceThreshold,
            &handle)
        if status != PV_STATUS_SUCCESS {
            let messageStack = try Eagle.getMessageStack()
            throw Eagle.pvStatusToEagleError(status, "Eagle init failed", messageStack)
        }

        var cMinAudioLengthSamples: Int32 = 0
        status = pv_eagle_process_min_audio_length_samples(
            handle,
            &cMinAudioLengthSamples)
        if status != PV_STATUS_SUCCESS {
            let messageStack = try Eagle.getMessageStack()
            throw Eagle.pvStatusToEagleError(
                status,
                "Eagle process_min_audio_length_sample failed",
                messageStack)
        }
        minProcessAudioLength = Int(cMinAudioLengthSamples)
    }

    deinit {
        self.delete()
    }

    /// Releases resources acquired by Eagle.
    public func delete() {
        if handle != nil {
            pv_eagle_delete(handle)
            handle = nil
        }
    }

    /// Processes given audio data and returns its speaker likelihood scores or nil.
    ///
    /// - Parameters:
    ///   - pcm: An array of audio samples. The minimum number of samples per frame can be
    ///          attained by calling `.minProcessSamples()`. The audio needs to have a sample
    ///          rate equal to `.sampleRate` and be single-channel, 16-bit linearly-encoded.
    ///   - speakerProfiles: An array of EagleProfile objects obtained from EagleProfiler.
    /// - Throws: EagleError
    /// - Returns: Similarity scores for each enrolled speaker. The scores are in the range
    ///            [0, 1] with 1 being a perfect match. A return value of nil indicated that
    ///            there was not enough voice in the pcm to detect a speaker.
    public func process(
        pcm: [Int16],
        speakerProfiles: [EagleProfile],
    ) throws -> [Float]? {

        if handle == nil {
            throw EagleInvalidStateError("Eagle must be initialized before indexing")
        }

        if speakerProfiles.isEmpty {
            throw EagleInvalidArgumentError("`speakerProfiles` must contain at least one profile")
        }

        var speakerHandles: [UnsafeMutableRawPointer?] = []
        for profile in speakerProfiles {
            var profileBytes = profile.getBytes()
            speakerHandles.append(&profileBytes)
        }

        var cScores: UnsafeMutablePointer<Float32>?
        let status = pv_eagle_process(
            handle,
            pcm,
            Int32(pcm.count),
            &speakerHandles,
            Int32(speakerProfiles.count),
            &cScores)

        if status != PV_STATUS_SUCCESS {
            let messageStack = try Eagle.getMessageStack()
            throw Eagle.pvStatusToEagleError(status, "Eagle process failed", messageStack)
        }

        if cScores != nil {
            var scores: [Float] = []
            for i in 0..<speakerProfiles.count {
                scores.append(cScores![Int(i)])
            }

            pv_eagle_scores_delete(cScores)

            return scores
        }

        return nil
    }

    /// Getter for the minimum length of the input pcm required by `process()`.
    /// - Throws: EagleError
    /// - Returns: Minimum number of samples required for a call to `process()`
    public func minProcessSamples() throws -> Int {
        if handle == nil {
            throw EagleInvalidStateError("Eagle must be initialized before calling minProcessSamples")
        }

        return minProcessAudioLength!
    }
}
