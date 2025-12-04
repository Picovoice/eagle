//
//  Copyright 2023-2024 Picovoice Inc.
//  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
//  file accompanying this source.
//  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
//  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
//  specific language governing permissions and limitations under the License.
//

import Foundation
import PvEagle

public enum EagleProfilerEnrollFeedback {
    case AUDIO_OK
    case AUDIO_TOO_SHORT
    case UNKNOWN_SPEAKER
    case NO_VOICE_FOUND
    case QUALITY_ISSUE
}

/// EagleProfiler class for iOS Eagle text-independent speaker recognition engine.
/// It enrolls a speaker given a set of utterances and then constructs a profile for the enrolled speaker.
public class EagleProfiler: EagleBase {

    private var handle: OpaquePointer?

    private var speakerProfileSize: Int?
    private var minEnrollAudioLength: Int?

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
    /// - Throws: EagleError
    public init(
        accessKey: String,
        modelPath: String? = nil,
        device: String? = nil
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
            modelPathArg = try getResourcePath(modelPathArg!)
        }


        var deviceArg = device
        if device == nil {
            deviceArg = "best"
        }

        pv_set_sdk(EagleProfiler.sdk)

        var status = pv_eagle_profiler_init(
            accessKey,
            modelPathArg,
            deviceArg,
            &handle)
        if status != PV_STATUS_SUCCESS {
            let messageStack = try EagleProfiler.getMessageStack()
            throw EagleProfiler.pvStatusToEagleError(status, "EagleProfiler init failed", messageStack)
        }

        var cSpeakerProfileSizeBytes: Int32 = 0
        status = pv_eagle_profiler_export_size(
            handle,
            &cSpeakerProfileSizeBytes)
        if status != PV_STATUS_SUCCESS {
            let messageStack = try EagleProfiler.getMessageStack()
            throw EagleProfiler.pvStatusToEagleError(status, "EagleProfiler speaker_profile_size failed", messageStack)
        }
        speakerProfileSize = Int(cSpeakerProfileSizeBytes)

        var cMinAudioLengthSamples: Int32 = 0
        status = pv_eagle_profiler_enroll_min_audio_length_samples(
            handle,
            &cMinAudioLengthSamples)
        if status != PV_STATUS_SUCCESS {
            let messageStack = try EagleProfiler.getMessageStack()
            throw EagleProfiler.pvStatusToEagleError(
                status,
                "EagleProfiler enrollment_min_audio_length_sample failed",
                messageStack)
        }
        minEnrollAudioLength = Int(cMinAudioLengthSamples)
    }

    deinit {
        self.delete()
    }

    /// Releases resources acquired by EagleProfiler.
    public func delete() {
        if handle != nil {
            pv_eagle_profiler_delete(handle)
            handle = nil
        }
    }

    /// Enrolls a speaker.
    /// - Parameters:
    ///   - pcm: An array of audio samples. The audio needs to have a sample rate
    ///          equal to `.sampleRate` and be single-channel, 16-bit linearly-encoded.
    ///          In addition it must be at least `.minEnrollSamples` samples long.
    /// - Throws: EagleError
    /// - Returns: A tuple containing a the percentage of enrollment completed as a Float and
    ///            an enum representing the feedback code.
    public func enroll(pcm: [Int16]) throws -> (Float, EagleProfilerEnrollFeedback) {

        if handle == nil {
            throw EagleInvalidStateError("EagleProfiler must be initialized before enrolling")
        }

        var cEnrollError: pv_eagle_profiler_enroll_feedback_t = PV_EAGLE_PROFILER_ENROLL_FEEDBACK_AUDIO_OK
        var cPercentage: Float32 = 0
        let status = pv_eagle_profiler_enroll(
            handle,
            pcm,
            Int32(pcm.count),
            &cEnrollError,
            &cPercentage)

        if status != PV_STATUS_SUCCESS {
            let messageStack = try EagleProfiler.getMessageStack()
            throw EagleProfiler.pvStatusToEagleError(status, "EagleProfiler enroll failed", messageStack)
        }

        let enrollFeedback = pvProfilerEnrollmentErrorToEnrollFeedback(cEnrollError)
        let percentage = Float(cPercentage)

        return (percentage, enrollFeedback)
    }

    /// Exports the speaker profile. The exported profile can be used in `Eagle` or stored for later use.
    /// - Throws: EagleError
    /// - Returns: EagleProfile object that is used to perform recognition
    public func export() throws -> EagleProfile {
        if handle == nil {
            throw EagleInvalidStateError("EagleProfiler must be initialized before enrolling")
        }

        var cProfile = [UInt8](repeating: 0, count: speakerProfileSize!)
        let status = pv_eagle_profiler_export(
            handle,
            &cProfile)

        if status != PV_STATUS_SUCCESS {
            let messageStack = try EagleProfiler.getMessageStack()
            throw EagleProfiler.pvStatusToEagleError(status, "EagleProfiler export failed", messageStack)
        }

        return EagleProfile(profileBytes: cProfile)
    }

    /// Resets EagleProfiler and removes all enrollment data. It must be called before enrolling a new speaker.
    /// - Throws: EagleError
    public func reset() throws {
        if handle == nil {
            throw EagleInvalidStateError("EagleProfiler must be initialized before resetting")
        }

        let status = pv_eagle_profiler_reset(handle)

        if status != PV_STATUS_SUCCESS {
            let messageStack = try EagleProfiler.getMessageStack()
            throw EagleProfiler.pvStatusToEagleError(status, "EagleProfiler reset failed", messageStack)
        }
    }

    /// Getter for the minimum length of the input pcm required by `enroll()`.
    /// - Throws: EagleError
    /// - Returns: Minimum number of samples required for a call to `enroll()`
    public func minEnrollSamples() throws -> Int {
        if handle == nil {
            throw EagleInvalidStateError("EagleProfiler must be initialized before calling minEnrollSamples")
        }

        return minEnrollAudioLength!
    }
}
