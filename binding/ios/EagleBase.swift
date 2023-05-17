import PvEagle

public class EagleBase {

    /// Required audio sample rate for PCM data
    public static let sampleRate = Int(pv_sample_rate())

    /// EagleProfiler version
    public static let version = String(cString: pv_eagle_version())

    /// Given a path, return the full path to the resource.
    ///
    /// - Parameters:
    ///   - filePath: relative path of a file in the bundle.
    /// - Throws: EagleIOError
    /// - Returns: The full path of the resource.
    internal func getResourcePath(_ filePath: String) throws -> String {
        if let resourcePath = Bundle(for: type(of: self)).resourceURL?.appendingPathComponent(filePath).path {
            if (FileManager.default.fileExists(atPath: resourcePath)) {
                return resourcePath
            }
        }

        throw EagleIOError("Could not find file at path '\(filePath)'. If this is a packaged asset, ensure you have added it to your xcode project.")
    }

    public func pvStatusToEagleError(_ status: pv_status_t, _ message: String) -> EagleError {
        switch status {
        case PV_STATUS_OUT_OF_MEMORY:
            return EagleMemoryError(message)
        case PV_STATUS_IO_ERROR:
            return EagleIOError(message)
        case PV_STATUS_INVALID_ARGUMENT:
            return EagleInvalidArgumentError(message)
        case PV_STATUS_STOP_ITERATION:
            return EagleStopIterationError(message)
        case PV_STATUS_KEY_ERROR:
            return EagleKeyError(message)
        case PV_STATUS_INVALID_STATE:
            return EagleInvalidStateError(message)
        case PV_STATUS_RUNTIME_ERROR:
            return EagleRuntimeError(message)
        case PV_STATUS_ACTIVATION_ERROR:
            return EagleActivationError(message)
        case PV_STATUS_ACTIVATION_LIMIT_REACHED:
            return EagleActivationLimitError(message)
        case PV_STATUS_ACTIVATION_THROTTLED:
            return EagleActivationThrottledError(message)
        case PV_STATUS_ACTIVATION_REFUSED:
            return EagleActivationRefusedError(message)
        default:
            let pvStatusString = String(cString: pv_status_to_string(status))
            return EagleError("\(pvStatusString): \(message)")
        }
    }

    public func pvProfilerEnrollmentErrorToEnrollFeedback(_ status: pv_eagle_profiler_enroll_feedback_t) -> EagleProfilerEnrollFeedback {
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
}
