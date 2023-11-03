import PvEagle

/// Base class providing shared utilities and functions for Eagle and EagleProfiler
public class EagleBase {

    /// Required audio sample rate for PCM data
    public static let sampleRate = Int(pv_sample_rate())

    /// Eagle/EagleProfiler version
    public static let version = String(cString: pv_eagle_version())

    internal static var sdk = "ios"

    public static func setSdk(sdk: String) {
        self.sdk = sdk
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
    internal func pvStatusToEagleError(
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

    /// Given a C pv_eagle_profiler_enroll_feedback_t enum value, return the equivalent Swift enum value.
    ///
    /// - Parameters:
    ///   - status: C enum value.
    /// - Returns: The equivalent Swift enum value.
    internal func pvProfilerEnrollmentErrorToEnrollFeedback(
            _ status: pv_eagle_profiler_enroll_feedback_t) -> EagleProfilerEnrollFeedback {
        switch status {
        case PV_EAGLE_PROFILER_ENROLL_FEEDBACK_AUDIO_OK:
            return EagleProfilerEnrollFeedback.AUDIO_OK
        case PV_EAGLE_PROFILER_ENROLL_FEEDBACK_AUDIO_TOO_SHORT:
            return EagleProfilerEnrollFeedback.AUDIO_TOO_SHORT
        case PV_EAGLE_PROFILER_ENROLL_FEEDBACK_UNKNOWN_SPEAKER:
            return EagleProfilerEnrollFeedback.UNKNOWN_SPEAKER
        case PV_EAGLE_PROFILER_ENROLL_FEEDBACK_NO_VOICE_FOUND:
            return EagleProfilerEnrollFeedback.NO_VOICE_FOUND
        case PV_EAGLE_PROFILER_ENROLL_FEEDBACK_QUALITY_ISSUE:
            return EagleProfilerEnrollFeedback.QUALITY_ISSUE
        default:
            return EagleProfilerEnrollFeedback.AUDIO_OK
        }
    }

    internal func getMessageStack() throws -> [String] {
        var messageStackRef: UnsafeMutablePointer<UnsafeMutablePointer<Int8>?>?
        var messageStackDepth: Int32 = 0
        let status = pv_get_error_stack(&messageStackRef, &messageStackDepth)
        if status != PV_STATUS_SUCCESS {
            throw pvStatusToEagleError(status, "Unable to get Eagle error state")
        }

        var messageStack: [String] = []
        for i in 0..<messageStackDepth {
            messageStack.append(String(cString: messageStackRef!.advanced(by: Int(i)).pointee!))
        }

        pv_free_error_stack(messageStackRef)

        return messageStack
    }
}
