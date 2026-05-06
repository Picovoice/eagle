/*
    Copyright 2021-2025 Picovoice Inc.

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
 * @param device String representation of the device (e.g., CPU or GPU) to use for inference. If set to `best`, the most
 * suitable device is selected automatically. If set to `gpu`, the engine uses the first available GPU device.
 * To select a specific GPU device, set this argument to `gpu:${GPU_INDEX}`, where `${GPU_INDEX}` is the index of the
 * target GPU. If set to `cpu`, the engine will run on the CPU with the default number of threads. To specify the
 * number of threads, set this argument to `cpu:${NUM_THREADS}`, where `${NUM_THREADS}` is the desired number of threads.
 * @param min_enrollment_chunks Minimum number of chunks to be processed before enroll returns 100%. The value should be
 * a number greater than or equal to 1. A higher number results in more accurate profiles at the cost of needing more
 * data to create the profile.
 * @param voice_threshold Sensitivity threshold for detecting voice. The value should be a number within [0, 1]. A
 * higher threshold increases detection confidence values at the cost of potentially missing frames of voice.
 * @param[out] object EagleProfiler object.
 * @return Status code. Returns `PV_STATUS_OUT_OF_MEMORY`, `PV_STATUS_IO_ERROR`, `PV_STATUS_INVALID_ARGUMENT`,
 * `PV_STATUS_RUNTIME_ERROR`, `PV_STATUS_ACTIVATION_ERROR`, `PV_STATUS_ACTIVATION_LIMIT_REACHED`,
 * `PV_STATUS_ACTIVATION_THROTTLED`, or `PV_STATUS_ACTIVATION_REFUSED` on failure.
 */
PV_API pv_status_t pv_eagle_profiler_init(
        const char *access_key,
        const char *model_path,
        const char *device,
        int32_t min_enrollment_chunks,
        float voice_threshold,
        pv_eagle_profiler_t **object);

/**
 * Destructor.
 *
 * @param object EagleProfiler object.
 */
PV_API void pv_eagle_profiler_delete(pv_eagle_profiler_t *object);

/**
 * Resets the EagleProfiler object and removes all enrollment data. It must be called before enrolling a new speaker.
 *
 * @param object EagleProfiler object.
 * @return status code. Returns `PV_STATUS_INVALID_ARGUMENT` on failure.
 */
PV_API pv_status_t pv_eagle_profiler_reset(pv_eagle_profiler_t *object);

/**
 * Enrolls a speaker. This function should be called multiple times with different utterances of the same speaker
 * until `percentage` reaches `100.0`. Any further enrollment can be used to improve the speaker voice profile.
 * The audio data used for enrollment should satisfy the following requirements:
 * - Only one speaker should be present in the audio.
 * - The speaker should be speaking in a normal voice.
 * - The audio should contain no speech from other speakers and no other sounds (e.g. music).
 * - It should be captured in a quiet environment with no background noise.
 *
 * @param object EagleProfiler object.
 * @param pcm A frame of audio samples. The number of samples per frame can be attained by calling
 * `pv_eagle_frame_length()`. The incoming audio needs to have a sample rate equal to `pv_sample_rate()` and be
 * 16-bit linearly-encoded. Eagle operates on single-channel audio.
 * @param[out] percentage Percentage of enrollment completed.
 * @return Status code. Returns `PV_STATUS_OUT_OF_MEMORY`, `PV_STATUS_INVALID_ARGUMENT`,
 * `PV_STATUS_RUNTIME_ERROR`, `PV_STATUS_ACTIVATION_ERROR`, `PV_STATUS_ACTIVATION_LIMIT_REACHED`,
 * `PV_STATUS_ACTIVATION_THROTTLED`, or `PV_STATUS_ACTIVATION_REFUSED` on failure.
 */
PV_API pv_status_t pv_eagle_profiler_enroll(
        pv_eagle_profiler_t *object,
        const int16_t *pcm,
        float *percentage);

/**
 * Marks the end of the audio stream, flushes internal state of the object, and returns the percentage of enrollment
 * completed.
 *
 * @param object EagleProfiler object.
 * @param[out] percentage Percentage of enrollment completed.
 * @return Status code. Returns `PV_STATUS_OUT_OF_MEMORY`, `PV_STATUS_INVALID_ARGUMENT`,
 * `PV_STATUS_RUNTIME_ERROR`, `PV_STATUS_ACTIVATION_ERROR`, `PV_STATUS_ACTIVATION_LIMIT_REACHED`,
 * `PV_STATUS_ACTIVATION_THROTTLED`, or `PV_STATUS_ACTIVATION_REFUSED` on failure.
 */
PV_API pv_status_t pv_eagle_profiler_flush(
        pv_eagle_profiler_t *object,
        float *percentage);

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
 * The exported profile can be used in `pv_eagle_process()` or stored for later use.
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
 * Getter for number of audio samples per frame.
 *
 * @return Frame length.
 */
PV_API int32_t pv_eagle_profiler_frame_length(void);

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
 * @param device String representation of the device (e.g., CPU or GPU) to use for inference. If set to `best`, the most
 * suitable device is selected automatically. If set to `gpu`, the engine uses the first available GPU device.
 * To select a specific GPU device, set this argument to `gpu:${GPU_INDEX}`, where `${GPU_INDEX}` is the index of the
 * target GPU. If set to `cpu`, the engine will run on the CPU with the default number of threads. To specify the
 * number of threads, set this argument to `cpu:${NUM_THREADS}`, where `${NUM_THREADS}` is the desired number of threads.
 * @param voice_threshold Sensitivity threshold for detecting voice. The value should be a number within [0, 1]. A
 * higher threshold increases detection confidence values at the cost of potentially missing frames of voice.
 * @param[out] object Constructed instance of Eagle.
 * @return Status code. Returns `PV_STATUS_OUT_OF_MEMORY`, `PV_STATUS_IO_ERROR`, `PV_STATUS_INVALID_ARGUMENT`,
 * `PV_STATUS_RUNTIME_ERROR`, `PV_STATUS_ACTIVATION_ERROR`, `PV_STATUS_ACTIVATION_LIMIT_REACHED`,
 * `PV_STATUS_ACTIVATION_THROTTLED`, or `PV_STATUS_ACTIVATION_REFUSED` on failure.
 */
PV_API pv_status_t pv_eagle_init(
        const char *access_key,
        const char *model_path,
        const char *device,
        float voice_threshold,
        pv_eagle_t **object);

/**
 * Destructor.
 *
 * @param object Eagle object.
 */
PV_API void pv_eagle_delete(pv_eagle_t *object);

/**
 * Getter for the minimum length of the input pcm required by `pv_eagle_process()`.
 *
 * @param object Eagle object.
 * @param[out] num_samples Number of samples.
 * @return Status code. Returns `PV_STATUS_INVALID_ARGUMENT` on failure.
 */
PV_API pv_status_t pv_eagle_process_min_audio_length_samples(
        const pv_eagle_t *object,
        int32_t *num_samples);

/**
 * Processes a frame of the incoming audio.
 *
 * @param object Eagle object.
 * @param pcm Audio data. The required sample rate can be attained by calling `pv_sample_rate()`. The required audio
 * format is 16-bit linearly-encoded single-channel PCM. The minimum audio length required for processing can be attained
 * by calling `pv_eagle_process_min_audio_length_samples()`.
 * @param num_samples Number of audio samples in `pcm`.
 * @param speaker_profiles Speaker profiles. This can be created using the EagleProfiler object and its related functions.
 * @param num_speakers Number of speakers.
 * @param[out] scores Similarity scores for each enrolled speaker. The scores are in the range [0, 1] with 1 being
 * maximum confidence in a perfect match. `scores` must be freed using `pv_eagle_scores_delete()`.
 * @return Status code. Returns `PV_STATUS_OUT_OF_MEMORY`, `PV_STATUS_INVALID_ARGUMENT`,
 * `PV_STATUS_RUNTIME_ERROR`, `PV_STATUS_ACTIVATION_ERROR`, `PV_STATUS_ACTIVATION_LIMIT_REACHED`,
 * `PV_STATUS_ACTIVATION_THROTTLED`, or `PV_STATUS_ACTIVATION_REFUSED` on failure.
 */
PV_API pv_status_t pv_eagle_process(
        pv_eagle_t *object,
        const int16_t *pcm,
        int32_t num_samples,
        void **speaker_profiles,
        int32_t num_speakers,
        float **scores);

/**
 * Deletes scores returned from `pv_eagle_process()`
 *
 * @param scores scores array returned from `pv_eagle_process()`
 */
PV_API void pv_eagle_scores_delete(float *scores);

/**
 * Getter for version.
 *
 * @return Version.
 */
PV_API const char *pv_eagle_version(void);

/**
 * Gets a list of hardware devices that can be specified when calling `pv_eagle_init`
 *
 * @param[out] hardware_devices Array of available hardware devices. Devices are NULL terminated strings.
 *                              The array must be freed using `pv_eagle_free_hardware_devices`.
 * @param[out] num_hardware_devices The number of devices in the `hardware_devices` array.
 * @return Status code. Returns `PV_STATUS_OUT_OF_MEMORY`, `PV_STATUS_INVALID_ARGUMENT`, `PV_STATUS_INVALID_STATE`,
 * `PV_STATUS_RUNTIME_ERROR`, `PV_STATUS_ACTIVATION_ERROR`, `PV_STATUS_ACTIVATION_LIMIT_REACHED`,
 * `PV_STATUS_ACTIVATION_THROTTLED`, or `PV_STATUS_ACTIVATION_REFUSED` on failure.
 */
PV_API pv_status_t pv_eagle_list_hardware_devices(
        char ***hardware_devices,
        int32_t *num_hardware_devices);

/**
 * Frees memory allocated by `pv_eagle_list_hardware_devices`.
 *
 * @param[out] hardware_devices Array of available hardware devices allocated by `pv_eagle_list_hardware_devices`.
 * @param[out] num_hardware_devices The number of devices in the `hardware_devices` array.
 */
PV_API void pv_eagle_free_hardware_devices(
        char **hardware_devices,
        int32_t num_hardware_devices);

#ifdef __cplusplus

}

#endif

#endif // PV_EAGLE_H
