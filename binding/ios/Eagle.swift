//
//  Copyright 2023 Picovoice Inc.
//  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
//  file accompanying this source.
//  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
//  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
//  specific language governing permissions and limitations under the License.
//

import Foundation
import PvEagle

/// iOS binding for Octopus Speech-to-Index engine. It transforms audio into searchable metadata.
public class Eagle : EagleBase {

    /// Required audio sample rate for PCM data
    public static let frameLength = Int(pv_eagle_frame_length())

    private var speakerCount = 0

    private var handle: OpaquePointer?

    /// Constructor.
    ///
    /// - Parameters:
    ///   - accessKey: AccessKey obtained from the Picovoice Console (https://console.picovoice.ai/)
    ///   - modelPath: Absolute path to file containing model parameters.
    /// - Throws: OctopusError
    public init(accessKey: String, speakerProfiles: [EagleProfile], modelPath: String? = nil) throws {
        super.init()
        
        var modelPathArg = modelPath

        if (modelPath == nil) {
            let bundle = Bundle(for: type(of: self))

            modelPathArg = bundle.path(forResource: "eagle_params", ofType: "pv")
            if modelPathArg == nil {
                throw EagleIOError("Could not retrieve default model from app bundle")
            }
        }

        if !FileManager().fileExists(atPath: modelPathArg!) {
            modelPathArg = try self.getResourcePath(modelPathArg!)
        }

        var speakerHandles: [UnsafeRawPointer?] = []
        for profile in speakerProfiles {
            var profileBytes = profile.getBytes()
            speakerHandles.append(&profileBytes)
        }

        speakerCount = speakerProfiles.count

        let status = pv_eagle_init(
            accessKey,
            modelPathArg,
            Int32(speakerCount),
            speakerHandles,
            &handle)
        if(status != PV_STATUS_SUCCESS) {
            throw pvStatusToEagleError(status, "Eagle init failed")
        }
    }

    deinit {
        self.delete()
    }

    /// Releases resources acquired by Octopus.
    public func delete() {
        if handle != nil {
            pv_eagle_delete(handle);
            handle = nil
        }
    }

    /// Indexes raw PCM data.
    ///
    /// - Parameters:
    ///   - pcm: An array of audio samples. The audio needs to have a sample rate
    ///          equal to `.pcmDataSampleRate` and be single-channel, 16-bit linearly-encoded.
    /// - Throws: OctopusError
    /// - Returns: OctopusMetadata object that is used to perform searches
    public func process(pcm: [Int16]) throws -> [Float] {

        if handle == nil {
            throw EagleInvalidStateError("Eagle must be initialized before indexing")
        }

        var scores = UnsafeMutableBufferPointer<Float32>.allocate(capacity: speakerCount)
        let status = pv_eagle_process(
            handle,
            pcm,
            scores.baseAddress)

        if(status != PV_STATUS_SUCCESS) {
            throw pvStatusToEagleError(status, "Eagle process failed")
        }

        return Array(scores)
    }
}