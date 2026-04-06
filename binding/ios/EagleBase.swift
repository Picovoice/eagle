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

/// Base class providing shared utilities and functions for Eagle and EagleProfiler
public class EagleBase {

#if SWIFT_PACKAGE

    static let resourceBundle = Bundle.module

#else

    static let resourceBundle: Bundle = {
        let myBundle = Bundle(for: EagleBase.self)

        guard let resourceBundleURL = myBundle.url(
                forResource: "EagleResources", withExtension: "bundle")
                else {
            fatalError("EagleResources.bundle not found")
        }

        guard let resourceBundle = Bundle(url: resourceBundleURL)
                else {
            fatalError("Could not open EagleResources.bundle")
        }

        return resourceBundle
    }()

#endif

    /// Required audio sample rate for PCM data
    public static let sampleRate = Int(pv_sample_rate())

    /// Eagle/EagleProfiler version
    public static let version = String(cString: pv_eagle_version())

    internal static var sdk = "ios"

    public static func setSdk(sdk: String) {
        self.sdk = sdk
    }

    /// Lists all available devices that Eagle can use for inference.
    /// Entries in the list can be used as the `device` argument when initializing Eagle.
    ///
    /// - Throws: EagleError
    /// - Returns: Array of available devices that Eagle can be used for inference.
    public static func getAvailableDevices() throws -> [String] {
        var cHardwareDevices: UnsafeMutablePointer<UnsafeMutablePointer<Int8>?>?
        var numHardwareDevices: Int32 = 0
        let status = pv_eagle_list_hardware_devices(&cHardwareDevices, &numHardwareDevices)
        if status != PV_STATUS_SUCCESS {
            let messageStack = try EagleBase.getMessageStack()
            throw EagleBase.pvStatusToEagleError(status, "Eagle getAvailableDevices failed", messageStack)
        }

        var hardwareDevices: [String] = []
        for i in 0..<numHardwareDevices {
            hardwareDevices.append(String(cString: cHardwareDevices!.advanced(by: Int(i)).pointee!))
        }

        pv_eagle_free_hardware_devices(cHardwareDevices, numHardwareDevices)

        return hardwareDevices
    }

    /// Given a path, return the full path to the resource.
    ///
    /// - Parameters:
    ///   - filePath: relative path of a file in the bundle.
    /// - Throws: EagleIOError
    /// - Returns: The full path of the resource.
    internal func getResourcePath(_ filePath: String) throws -> String {
        if let resourcePath = Bundle(for: type(of: self)).resourceURL?.appendingPathComponent(filePath).path {
            if FileManager.default.fileExists(atPath: resourcePath) {
                return resourcePath
            }
        }

        throw EagleIOError("Could not find file at path '\(filePath)'. " +
                           "If this is a packaged asset, ensure you have added it to your xcode project.")
    }

    /// Given a C pv_status_t enum, return the appropriate EagleError
    ///
    /// - Parameters:
    ///   - status: C enum value.
    ///   - message: message to include with the EagleError.
    ///   - messageStack: Error stack returned from Eagle.
    /// - Returns: An EagleError.
    internal static func pvStatusToEagleError(
        _ status: pv_status_t,
        _ message: String,
        _ messageStack: [String] = []) -> EagleError {
        switch status {
        case PV_STATUS_OUT_OF_MEMORY:
            return EagleMemoryError(message, messageStack)
        case PV_STATUS_IO_ERROR:
            return EagleIOError(message, messageStack)
        case PV_STATUS_INVALID_ARGUMENT:
            return EagleInvalidArgumentError(message, messageStack)
        case PV_STATUS_STOP_ITERATION:
            return EagleStopIterationError(message, messageStack)
        case PV_STATUS_KEY_ERROR:
            return EagleKeyError(message, messageStack)
        case PV_STATUS_INVALID_STATE:
            return EagleInvalidStateError(message, messageStack)
        case PV_STATUS_RUNTIME_ERROR:
            return EagleRuntimeError(message, messageStack)
        case PV_STATUS_ACTIVATION_ERROR:
            return EagleActivationError(message, messageStack)
        case PV_STATUS_ACTIVATION_LIMIT_REACHED:
            return EagleActivationLimitError(message, messageStack)
        case PV_STATUS_ACTIVATION_THROTTLED:
            return EagleActivationThrottledError(message, messageStack)
        case PV_STATUS_ACTIVATION_REFUSED:
            return EagleActivationRefusedError(message, messageStack)
        default:
            let pvStatusString = String(cString: pv_status_to_string(status))
            return EagleError("\(pvStatusString): \(message)", messageStack)
        }
    }

    internal static func getMessageStack() throws -> [String] {
        var messageStackRef: UnsafeMutablePointer<UnsafeMutablePointer<Int8>?>?
        var messageStackDepth: Int32 = 0
        let status = pv_get_error_stack(&messageStackRef, &messageStackDepth)
        if status != PV_STATUS_SUCCESS {
            throw EagleBase.pvStatusToEagleError(status, "Unable to get Eagle error state")
        }

        var messageStack: [String] = []
        for i in 0..<messageStackDepth {
            messageStack.append(String(cString: messageStackRef!.advanced(by: Int(i)).pointee!))
        }

        pv_free_error_stack(messageStackRef)

        return messageStack
    }
}
