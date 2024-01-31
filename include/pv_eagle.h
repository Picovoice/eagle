/*
    Copyright 2021-2024 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

#ifndef PV_EAGLE_H
#define PV_EAGLE_H

#include <stdint.h>

#include "picovoice.h"

#ifdef __cplusplus

extern "C" {

#endif

/**
 * Forward declaration of the EagleProfiler object for Eagle text-independent speaker recognition engine.
 * It enrolls a speaker given a set of utterances and then constructs a profile for the enrolled speaker.
 */
typedef struct pv_eagle_profiler pv_eagle_profiler_t;

/**
 * Constructor to create an instance of the EagleProfiler object.
 *
 * @param access_key AccessKey obtained from Picovoice Console (https://console.picovoice.ai/).
 * @param model_path Absolute path to the file containing model parameters.
 * @param[out] object EagleProfiler object.
 * @return Status code. Returns `PV_STATUS_OUT_OF_MEMORY`, `PV_STATUS_IO_ERROR`, `PV_STATUS_INVALID_ARGUMENT`,
 * `PV_STATUS_RUNTIME_ERROR`, `PV_STATUS_ACTIVATION_ERROR`, `PV_STATUS_ACTIVATION_LIMIT_REACHED`,
 * `PV_STATUS_ACTIVATION_THROTTLED`, or `PV_STATUS_ACTIVATION_REFUSED` on failure.
 */
PV_API pv_status_t pv_eagle_profiler_init(
        const char *access_key,
        const char *model_path,
        pv_eagle_profiler_t **object);

/**
 * Destructor.
 *
 * @param object EagleProfiler object.
 */
PV_API void pv_eagle_profiler_delete(pv_eagle_profiler_t *object);

/**
 * Enrollment feedback codes.
 */
typedef enum {
    PV_EAGLE_PROFILER_ENROLL_FEEDBACK_AUDIO_OK = 0,
    PV_EAGLE_PROFILER_ENROLL_FEEDBACK_AUDIO_TOO_SHORT,
    PV_EAGLE_PROFILER_ENROLL_FEEDBACK_UNKNOWN_SPEAKER,
    PV_EAGLE_PROFILER_ENROLL_FEEDBACK_NO_VOICE_FOUND,
    PV_EAGLE_PROFILER_ENROLL_FEEDBACK_QUALITY_ISSUE,
} pv_eagle_profiler_enroll_feedback_t;

/**
 * Provides string representations of EagleProfiler enrollment feedback codes.
 *
 * @param feedback Feedback code.
 * @return String representation.
 */
PV_API const char *pv_eagle_profiler_enroll_feedback_to_string(pv_eagle_profiler_enroll_feedback_t feedback);

/**
 * Enrolls a speaker. This function should be called multiple times with different utterances of the same speaker
 * until `percentage` reaches `100.0`. Any further enrollment can be used to improve the speaker voice profile.
 * The minimum number of required samples can be obtained by calling `pv_eagle_profile_min_enroll_audio_length()`.
 * The audio data used for enrollment should satisfy the following requirements:
 * - only one speaker should be present in the audio
 * - the speaker should be speaking in a normal voice
 * - the audio should contain no speech from other speakers and no other sounds (e.g. music),
 * - it should be captured in a quiet environment with no background noise,
 *
 * @param object EagleProfiler object.
 * @param pcm Audio data. The required sample rate can be attained by calling `pv_sample_rate()`. The required audio
 * format is 16-bit linearly-encoded single-channel PCM. The minimum audio length required for enrollment can be attained
 * by calling `pv_eagle_profiler_enroll_min_audio_length_samples()`.
 * @param num_samples Number of audio samples in `pcm`.
 * @param[out] feedback Feedback code. If enrollment process fails because of a bad input audio, this will be set to
 * a proper feedback code indicating the cause of failure:
 * - `PV_EAGLE_PROFILER_ENROLL_FEEDBACK_AUDIO_TOO_SHORT`: The audio is too short,
 * i.e. it contains less than the minimum number of required samples.
 * - `PV_EAGLE_PROFILER_ENROLL_FEEDBACK_UNKNOWN_SPEAKER`: The speaker is unknown,
 * i.e. the speaker is not the same as the one enrolled in the previous enrollment.
 * - `PV_EAGLE_PROFILER_ENROLL_FEEDBACK_NO_VOICE_FOUND`: The audio does not contain any speech.
 * - `PV_EAGLE_PROFILER_ENROLL_FEEDBACK_QUALITY_ISSUE`:
 * The audio is too noisy or the speaker is speaking in a low voice.
* Otherwise, it will be set to `PV_EAGLE_PROFILER_ENROLL_FEEDBACK_AUDIO_OK`
 * @param[out] percentage Percentage of enrollment completed.
 * @return Status code. Returns `PV_STATUS_OUT_OF_MEMORY`, `PV_STATUS_INVALID_ARGUMENT`,
 * `PV_STATUS_RUNTIME_ERROR`, `PV_STATUS_ACTIVATION_ERROR`, `PV_STATUS_ACTIVATION_LIMIT_REACHED`,
 * `PV_STATUS_ACTIVATION_THROTTLED`, or `PV_STATUS_ACTIVATION_REFUSED` on failure.
 */
PV_API pv_status_t pv_eagle_profiler_enroll(
        pv_eagle_profiler_t *object,
        const int16_t *pcm,
        int32_t num_samples,
        pv_eagle_profiler_enroll_feedback_t *feedback,
        float *percentage);

/**
 * Getter for the minimum length of the input pcm required by `pv_eagle_profiler_enroll()`.
 *
 * @param object EagleProfiler object.
 * @param[out] num_samples Number of samples.
 * @return Status code. Returns `PV_STATUS_INVALID_ARGUMENT` on failure.
 */
PV_API pv_status_t pv_eagle_profiler_enroll_min_audio_length_samples(
        const pv_eagle_profiler_t *object,
        int32_t *num_samples);

/**
 * Determines size required for the speaker profile buffer when exporting the speaker profile.
 *
 * @param object EagleProfiler object.
 * @param[out] speaker_profile_size_bytes Size of the serialized speaker profile in bytes.
 * @return Status code. Returns `PV_STATUS_INVALID_ARGUMENT` on failure
 */
PV_API pv_status_t pv_eagle_profiler_export_size(
        const pv_eagle_profiler_t *object,
        int32_t *speaker_profile_size_bytes);

/**
 * Exports the speaker profile to a buffer.
 * The exported profile can be used in `pv_eagle_init()` or stored for later use.
 *
 * @param object EagleProfiler object.
 * @param[out] speaker_profile Buffer where the speaker profile will be stored. Must be pre-allocated with a size
 * obtained by calling `pv_eagle_profiler_export_size()`.
 * @return Status code. Returns `PV_STATUS_OUT_OF_MEMORY`, `PV_STATUS_INVALID_ARGUMENT`,
 * or `PV_STATUS_RUNTIME_ERROR` on failure. It returns `PV_STATUS_INVALID_STATE` if enrollment is not complete.
 */
PV_API pv_status_t pv_eagle_profiler_export(
        const pv_eagle_profiler_t *object,
        void *speaker_profile);

/**
 * Resets the EagleProfiler object and removes all enrollment data. It must be called before enrolling a new speaker.
 *
 * @param object EagleProfiler object.
 * @return status code. Returns `PV_STATUS_INVALID_ARGUMENT` on failure.
 */
PV_API pv_status_t pv_eagle_profiler_reset(pv_eagle_profiler_t *object);

/**
 * Forward declaration for Eagle Text-Independent Speaker Recognition engine. It processes incoming audio in consecutive
 * frames and emits a similarity score for each enrolled speaker.
 */
typedef struct pv_eagle pv_eagle_t;

/**
 * Constructor.
 *
 * @param access_key AccessKey obtained from Picovoice Console (https://console.picovoice.ai/)
 * @param model_path Absolute path to the file containing model parameters.
 * @param num_speakers Number of speakers.
 * @param speaker_profiles Speaker profiles. This can be created using the EagleProfiler object and its related functions.
 * @param[out] object Constructed instance of Eagle.
 * @return Status code. Returns `PV_STATUS_OUT_OF_MEMORY`, `PV_STATUS_IO_ERROR`, `PV_STATUS_INVALID_ARGUMENT`,
 * `PV_STATUS_RUNTIME_ERROR`, `PV_STATUS_ACTIVATION_ERROR`, `PV_STATUS_ACTIVATION_LIMIT_REACHED`,
 * `PV_STATUS_ACTIVATION_THROTTLED`, or `PV_STATUS_ACTIVATION_REFUSED` on failure.
 */
PV_API pv_status_t pv_eagle_init(
        const char *access_key,
        const char *model_path,
        int32_t num_speakers,
        const void *const *speaker_profiles,
        pv_eagle_t **object);

/**
 * Destructor.
 *
 * @param object Eagle object.
 */
PV_API void pv_eagle_delete(pv_eagle_t *object);

/**
 * Processes a frame of the incoming audio.
 *
 * @param object Eagle object.
 * @param pcm A frame of audio samples. The number of samples per frame can be attained by calling
 * `pv_eagle_frame_length()`. The incoming audio needs to have a sample rate equal to `pv_sample_rate()` and be
 * 16-bit linearly-encoded. Eagle operates on single-channel audio.
 * @param[out] scores Similarity scores for each enrolled speaker. Must be pre-allocated with a size equal to
 * the number of enrolled speakers. The scores are in the range [0, 1] with 1 being a perfect match.
 * @return Status code. Returns `PV_STATUS_OUT_OF_MEMORY`, `PV_STATUS_INVALID_ARGUMENT`,
 * `PV_STATUS_RUNTIME_ERROR`, `PV_STATUS_ACTIVATION_ERROR`, `PV_STATUS_ACTIVATION_LIMIT_REACHED`,
 * `PV_STATUS_ACTIVATION_THROTTLED`, or `PV_STATUS_ACTIVATION_REFUSED` on failure.
 */
PV_API pv_status_t pv_eagle_process(
        pv_eagle_t *object,
        const int16_t *pcm,
        float *scores);

/**
 * Resets the internal state of the Eagle engine. It must be called before processing a new sequence of audio frames.
 * @param object Eagle object.
 * @return Status code. Returns `PV_STATUS_INVALID_ARGUMENT` on failure.
 */
PV_API pv_status_t pv_eagle_reset(pv_eagle_t *object);

/**
 * Getter for number of audio samples per frame.
 *
 * @return Frame length.
 */
PV_API int32_t pv_eagle_frame_length(void);

/**
 * Getter for version.
 *
 * @return Version.
 */
PV_API const char *pv_eagle_version(void);

#ifdef __cplusplus

}

#endif

#endif // PV_EAGLE_H
