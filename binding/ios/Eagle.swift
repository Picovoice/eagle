//
//  Copyright 2023-2025 Picovoice Inc.
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

    public static let frameLength = Int(pv_eagle_frame_length())

    private var speakerCount = 0

    private var handle: OpaquePointer?

    /// Constructor.
    ///
    /// - Parameters:
    ///   - accessKey: AccessKey obtained from the Picovoice Console (https://console.picovoice.ai/)
    ///   - speakerProfiles: An array of EagleProfile objects obtained from EagleProfiler.
    ///   - modelPath: Absolute path to file containing model parameters.
    ///   - device: String representation of the device (e.g., CPU or GPU) to use. If set to `best`, the most
    ///     suitable device is selected automatically. If set to `gpu`, the engine uses the first available GPU
    ///     device. To select a specific GPU device, set this argument to `gpu:${GPU_INDEX}`, where `${GPU_INDEX}`
    ///     is the index of the target GPU. If set to `cpu`, the engine will run on the CPU with the default
    ///     number of threads. To specify the number of threads, set this argument to `cpu:${NUM_THREADS}`,
    ///     where `${NUM_THREADS}` is the desired number of threads.
    /// - Throws: EagleError
    public init(
        accessKey: String,
        speakerProfiles: [EagleProfile],
        modelPath: String? = nil,
        device: String? = nil
    ) throws {
        super.init()

        if speakerProfiles.isEmpty {
            throw EagleInvalidArgumentError("`speakerProfiles` must contain at least one profile")
        }

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

        var speakerHandles: [UnsafeRawPointer?] = []
        for profile in speakerProfiles {
            var profileBytes = profile.getBytes()
            speakerHandles.append(&profileBytes)
        }

        speakerCount = speakerProfiles.count

        pv_set_sdk(Eagle.sdk)

        let status = pv_eagle_init(
            accessKey,
            modelPathArg,
            deviceArg,
            Int32(speakerCount),
            speakerHandles,
            &handle)
        if status != PV_STATUS_SUCCESS {
            let messageStack = try Eagle.getMessageStack()
            throw Eagle.pvStatusToEagleError(status, "Eagle init failed", messageStack)
        }
    }

    /// Constructor.
    ///
    /// - Parameters:
    ///   - accessKey: AccessKey obtained from the Picovoice Console (https://console.picovoice.ai/)
    ///   - speakerProfile: An EagleProfile object obtained from EagleProfiler.
    ///   - modelPath: Absolute path to file containing model parameters.
    ///   - device: String representation of the device (e.g., CPU or GPU) to use. If set to `best`, the most
    ///     suitable device is selected automatically. If set to `gpu`, the engine uses the first available GPU
    ///     device. To select a specific GPU device, set this argument to `gpu:${GPU_INDEX}`, where `${GPU_INDEX}`
    ///     is the index of the target GPU. If set to `cpu`, the engine will run on the CPU with the default
    ///     number of threads. To specify the number of threads, set this argument to `cpu:${NUM_THREADS}`,
    ///     where `${NUM_THREADS}` is the desired number of threads.
    /// - Throws: EagleError
    public convenience init(
        accessKey: String,
        speakerProfile: EagleProfile,
        modelPath: String? = nil,
        device: String = "best"
    ) throws {
        try self.init(
            accessKey: accessKey,
            speakerProfiles: [speakerProfile],
            modelPath: modelPath,
            device: device)
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

    /// Processes given audio data and returns its speaker likelihood scores.
    ///
    /// - Parameters:
    ///   - pcm: An array of audio samples. The number of samples per frame can be attained
    ///          by calling `.frameLength`. The audio needs to have a sample rate
    ///          equal to `.sampleRate` and be single-channel, 16-bit linearly-encoded.
    /// - Throws: EagleError
    /// - Returns: Similarity scores for each enrolled speaker.
    ///            The scores are in the range [0, 1] with 1 being a perfect match.
    public func process(pcm: [Int16]) throws -> [Float] {

        if handle == nil {
            throw EagleInvalidStateError("Eagle must be initialized before indexing")
        }

        let scores = UnsafeMutableBufferPointer<Float32>.allocate(capacity: speakerCount)
        let status = pv_eagle_process(
            handle,
            pcm,
            scores.baseAddress)

        if status != PV_STATUS_SUCCESS {
            let messageStack = try Eagle.getMessageStack()
            throw Eagle.pvStatusToEagleError(status, "Eagle process failed", messageStack)
        }

        return Array(scores)
    }

    /// Resets the internal state of the Eagle engine.
    /// It is best to call before processing a new sequence of audio (e.g. a new voice interaction).
    /// This ensures that the accuracy of the engine is not affected by a change in audio context.
    ///
    /// - Parameters:
    /// - Throws: EagleError
    public func reset() throws {

        if handle == nil {
            throw EagleInvalidStateError("Eagle must be initialized before indexing")
        }

        let status = pv_eagle_reset(handle)

        if status != PV_STATUS_SUCCESS {
            let messageStack = try Eagle.getMessageStack()
            throw Eagle.pvStatusToEagleError(status, "Eagle reset failed", messageStack)
        }
    }
}
