/*
    Copyright 2023 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

#include <float.h>
#include <getopt.h>
#include <limits.h>
#include <math.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>

#if defined(_WIN32) || defined(_WIN64)

#include <windows.h>

#define UTF8_COMPOSITION_FLAG (0)
#define NULL_TERMINATED       (-1)

#else

#include <dlfcn.h>

#endif

#include "pv_eagle.h"
#include "pv_recorder.h"

static void *open_dl(const char *dl_path) {

#if defined(_WIN32) || defined(_WIN64)

    return LoadLibrary(dl_path);

#else

    return dlopen(dl_path, RTLD_NOW);

#endif
}

static void *load_symbol(void *handle, const char *symbol) {

#if defined(_WIN32) || defined(_WIN64)

    return GetProcAddress((HMODULE) handle, symbol);

#else

    return dlsym(handle, symbol);

#endif
}

static void close_dl(void *handle) {

#if defined(_WIN32) || defined(_WIN64)

    FreeLibrary((HMODULE) handle);

#else

    dlclose(handle);

#endif
}

static void print_dl_error(const char *message) {

#if defined(_WIN32) || defined(_WIN64)

    fprintf(stderr, "%s with code '%lu'.\n", message, GetLastError());

#else

    fprintf(stderr, "%s with '%s'.\n", message, dlerror());

#endif
}

static volatile bool is_interrupted = false;

static struct option long_options[] = {
        {"access_key",          required_argument, NULL, 'a'},
        {"audio_device_index",  required_argument, NULL, 'd'},
        {"library_path",        required_argument, NULL, 'l'},
        {"model_path",          required_argument, NULL, 'm'},
        {"profile_input_path",  required_argument, NULL, 'i'},
        {"profile_output_path", required_argument, NULL, 'o'},
        {"show_audio_devices",  no_argument,       NULL, 's'},
};

void print_usage(const char *program_name) {
    fprintf(stdout,
            "Usage: %s [-s] [-l LIBRARY_PATH -m MODEL_PATH -a ACCESS_KEY -d AUDIO_DEVICE_INDEX -i PROFILE_INPUT_PATH -o PROFILE_OUTPUT_PATH]\n",
            program_name);
}

void interrupt_handler(int _) {
    (void) _;
    is_interrupted = true;
}

void show_audio_devices(void) {
    char **devices = NULL;
    int32_t count = 0;

    pv_recorder_status_t status = pv_recorder_get_audio_devices(&count, &devices);
    if (status != PV_RECORDER_STATUS_SUCCESS) {
        fprintf(stderr, "Failed to get audio devices with: %s.\n", pv_recorder_status_to_string(status));
        exit(EXIT_FAILURE);
    }

    fprintf(stdout, "Printing devices...\n");
    for (int32_t i = 0; i < count; i++) {
        fprintf(stdout, "index: %d, name: %s\n", i, devices[i]);
    }

    pv_recorder_free_device_list(count, devices);
}

int picovoice_main(int argc, char *argv[]) {
    signal(SIGINT, interrupt_handler);

    const char *access_key = NULL;
    const char *library_path = NULL;
    const char *profile_input_path = NULL;
    const char *profile_output_path = NULL;
    const char *model_path = NULL;
    int32_t device_index = -1;

    int c;
    while ((c = getopt_long(argc, argv, "sa:d:l:m:i:o:s:", long_options, NULL)) != -1) {
        switch (c) {
            case 's':
                show_audio_devices();
                return 0;
            case 'l':
                library_path = optarg;
                break;
            case 'a':
                access_key = optarg;
                break;
            case 'i':
                profile_input_path = optarg;
                break;
            case 'o':
                profile_output_path = optarg;
                break;
            case 'm':
                model_path = optarg;
                break;
            case 'd':
                device_index = (int32_t) strtol(optarg, NULL, 10);
                break;
            default:
                exit(EXIT_FAILURE);
        }
    }

    if (!library_path || !access_key || !model_path) {
        print_usage(argv[0]);
        exit(EXIT_FAILURE);
    }

    void *speaker_profile = NULL;

    if (profile_input_path) {

        FILE *profile_input_file = NULL;

#if defined(_WIN32) || defined(_WIN64)

        int profile_input_path_wchars_num = MultiByteToWideChar(CP_UTF8, UTF8_COMPOSITION_FLAG, profile_input_path, NULL_TERMINATED, NULL, 0);
        wchar_t profile_input_path_wchars[profile_input_path_wchars_num];
        MultiByteToWideChar(CP_UTF8, UTF8_COMPOSITION_FLAG, profile_input_path, NULL_TERMINATED, profile_input_path_wchars, profile_input_path_wchars_num);
        profile_input_file = _wfopen(profile_input_path_wchars, "rb")

#else

        profile_input_file = fopen(profile_input_path, "rb");

#endif

        if (!profile_input_file) {
            fprintf(stderr, "failed to open speaker profile file at '%s'.\n", profile_input_path);
            exit(EXIT_FAILURE);
        }

        fseek(profile_input_file, 0, SEEK_END);
        long speaker_profile_size = ftell(profile_input_file);
        rewind(profile_input_file);

        speaker_profile = calloc(speaker_profile_size, sizeof(uint8_t));
        size_t num_bytes = fread(speaker_profile, sizeof(uint8_t), speaker_profile_size, profile_input_file);
        if (num_bytes != speaker_profile_size) {
            fprintf(stderr, "failed to read speaker profile from '%s'.\n", profile_input_path);
            exit(EXIT_FAILURE);
        }
        fclose(profile_input_file);
    }


    void *eagle_library = open_dl(library_path);
    if (!eagle_library) {
        fprintf(stderr, "failed to open library at '%s'.\n", library_path);
        exit(EXIT_FAILURE);
    }

    const char *(*pv_status_to_string_func)(pv_status_t) = load_symbol(eagle_library, "pv_status_to_string");
    if (!pv_status_to_string_func) {
        print_dl_error("failed to load 'pv_status_to_string'");
        exit(EXIT_FAILURE);
    }

    int32_t (*pv_sample_rate_func)() = load_symbol(eagle_library, "pv_sample_rate");
    if (!pv_sample_rate_func) {
        print_dl_error("failed to load 'pv_sample_rate'");
        exit(EXIT_FAILURE);
    }


    pv_status_t (*pv_eagle_profiler_init_func)(
            const char *,
            const char *,
            pv_eagle_profiler_t **) = load_symbol(eagle_library, "pv_eagle_profiler_init");
    if (!pv_eagle_profiler_init_func) {
        print_dl_error("failed to load 'pv_eagle_profiler_init'");
        exit(EXIT_FAILURE);
    }

    void
    (*pv_eagle_profiler_delete_func)(pv_eagle_profiler_t *) = load_symbol(eagle_library, "pv_eagle_profiler_delete");
    if (!pv_eagle_profiler_delete_func) {
        print_dl_error("failed to load 'pv_eagle_profiler_delete'");
        exit(EXIT_FAILURE);
    }

    const char *(*pv_eagle_profiler_enrollment_error_to_string_func)(
            pv_eagle_profiler_enrollment_error_t) = load_symbol(eagle_library,
                                                                "pv_eagle_profiler_enrollment_error_to_string");
    if (!pv_eagle_profiler_enrollment_error_to_string_func) {
        print_dl_error("failed to load 'pv_eagle_profiler_enrollment_error_to_string'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_eagle_profiler_enroll_func)(
            pv_eagle_profiler_t *,
            const int16_t *,
            int32_t,
            pv_eagle_profiler_enrollment_error_t *,
            float *) = load_symbol(eagle_library, "pv_eagle_profiler_enroll");
    if (!pv_eagle_profiler_enroll_func) {
        print_dl_error("failed to load 'pv_eagle_profiler_enroll'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_eagle_profiler_enrollment_min_audio_length_sample_func)(
            const pv_eagle_profiler_t *,
            int32_t *) = load_symbol(eagle_library, "pv_eagle_profiler_enrollment_min_audio_length_sample");
    if (!pv_eagle_profiler_enrollment_min_audio_length_sample_func) {
        print_dl_error("failed to load 'pv_eagle_profiler_enrollment_min_audio_length_sample'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_eagle_profiler_export_func)(
            const pv_eagle_profiler_t *,
            void *) = load_symbol(eagle_library, "pv_eagle_profiler_export");
    if (!pv_eagle_profiler_export_func) {
        print_dl_error("failed to load 'pv_eagle_profiler_export'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_eagle_profiler_speaker_profile_size_func)(
            const pv_eagle_profiler_t *,
            int32_t *) = load_symbol(eagle_library, "pv_eagle_profiler_speaker_profile_size");
    if (!pv_eagle_profiler_speaker_profile_size_func) {
        print_dl_error("failed to load 'pv_eagle_profiler_speaker_profile_size'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_eagle_profiler_reset_func)(
            pv_eagle_profiler_t *) = load_symbol(eagle_library, "pv_eagle_profiler_reset");
    if (!pv_eagle_profiler_reset_func) {
        print_dl_error("failed to load 'pv_eagle_profiler_reset'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_eagle_init_func)(
            const char *,
            const char *,
            int32_t,
            const void *const *,
            pv_eagle_t **) = load_symbol(eagle_library, "pv_eagle_init");
    if (!pv_eagle_init_func) {
        print_dl_error("failed to load 'pv_eagle_init'");
        exit(EXIT_FAILURE);
    }

    void (*pv_eagle_delete_func)(pv_eagle_t *) = load_symbol(eagle_library, "pv_eagle_delete");
    if (!pv_eagle_delete_func) {
        print_dl_error("failed to load 'pv_eagle_delete'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_eagle_process_func)(
            pv_eagle_t *,
            const int16_t *,
            float *) = load_symbol(eagle_library, "pv_eagle_process");
    if (!pv_eagle_process_func) {
        print_dl_error("failed to load 'pv_eagle_process'");
        exit(EXIT_FAILURE);
    }

    int32_t (*pv_eagle_reset_func)(
            pv_eagle_t *) = load_symbol(eagle_library, "pv_eagle_reset");
    if (!pv_eagle_reset_func) {
        print_dl_error("failed to load 'pv_eagle_reset'");
        exit(EXIT_FAILURE);
    }

    int32_t (*pv_eagle_frame_length_func)() = load_symbol(eagle_library, "pv_eagle_frame_length");
    if (!pv_eagle_frame_length_func) {
        print_dl_error("failed to load 'pv_eagle_frame_length'");
        exit(EXIT_FAILURE);
    }

    char *(*pv_eagle_version_func)() = load_symbol(eagle_library, "pv_eagle_version");
    if (!pv_eagle_version_func) {
        print_dl_error("failed to load 'pv_eagle_version'");
        exit(EXIT_FAILURE);
    }

    fprintf(stdout, "v%s\n\n", pv_eagle_version_func());

    const int32_t frame_length = pv_eagle_frame_length_func();
    pv_recorder_t *recorder = NULL;
    pv_recorder_status_t recorder_status = pv_recorder_init(device_index, frame_length, 100, true, true, &recorder);
    if (recorder_status != PV_RECORDER_STATUS_SUCCESS) {
        fprintf(stderr, "Failed to initialize device with %s.\n", pv_recorder_status_to_string(recorder_status));
        exit(EXIT_FAILURE);
    }
    const char *selected_device = pv_recorder_get_selected_device(recorder);
    fprintf(stdout, "Selected device: %s.\n", selected_device);

    // Speaker enrollment
    if (!speaker_profile) {
        pv_eagle_profiler_t *eagle_profiler = NULL;
        pv_status_t eagle_profiler_status = pv_eagle_profiler_init_func(
                access_key,
                model_path,
                &eagle_profiler);
        if (eagle_profiler_status != PV_STATUS_SUCCESS) {
            fprintf(stderr, "failed to create an instance of eagle profiler\n");
            exit(EXIT_FAILURE);
        }

        int32_t num_enroll_samples = 0;
        eagle_profiler_status = pv_eagle_profiler_enrollment_min_audio_length_sample_func(eagle_profiler,
                                                                                          &num_enroll_samples);
        if (eagle_profiler_status != PV_STATUS_SUCCESS) {
            fprintf(stderr, "failed to get minimum number of enrollment frames\n");
            exit(EXIT_FAILURE);
        }


        int16_t *enroll_pcm = (int16_t *) malloc(num_enroll_samples * sizeof(int16_t));
        if (!enroll_pcm) {
            fprintf(stderr, "Failed to allocate pcm memory.\n");
            exit(EXIT_FAILURE);
        }

        fprintf(stdout, "Starting enrollment. Keep talking to the device until the progress reaches 100%%.\n");

        float enroll_percentage = 0.0f;
        pv_eagle_profiler_enrollment_error_t error = PV_EAGLE_PROFILER_ENROLLMENT_ERROR_NONE;

        while ((enroll_percentage < 100.0f) && (!is_interrupted)) {
            recorder_status = pv_recorder_start(recorder);
            if (recorder_status != PV_RECORDER_STATUS_SUCCESS) {
                fprintf(stderr, "Failed to start device with %s.\n", pv_recorder_status_to_string(recorder_status));
                exit(EXIT_FAILURE);
            }
            for (int32_t i = 0; i < num_enroll_samples; i += frame_length) {
                int16_t *pcm = &enroll_pcm[i];
                recorder_status = pv_recorder_read(recorder, pcm);
                if (recorder_status != PV_RECORDER_STATUS_SUCCESS) {
                    fprintf(stderr, "Failed to read audio with %s.\n", pv_recorder_status_to_string(recorder_status));
                    exit(EXIT_FAILURE);
                }
            }
            recorder_status = pv_recorder_stop(recorder);
            if (recorder_status != PV_RECORDER_STATUS_SUCCESS) {
                fprintf(stderr, "Failed to stop device with %s.\n", pv_recorder_status_to_string(recorder_status));
                exit(EXIT_FAILURE);
            }

            eagle_profiler_status = pv_eagle_profiler_enroll_func(
                    eagle_profiler,
                    enroll_pcm,
                    num_enroll_samples,
                    &error,
                    &enroll_percentage);
            if (eagle_profiler_status == PV_STATUS_INVALID_ARGUMENT) {
                fprintf(stderr, "\nfailed to enroll the last audio frame: %s\n", pv_eagle_profiler_enrollment_error_to_string_func(error));
            } else if (eagle_profiler_status != PV_STATUS_SUCCESS) {
                fprintf(stderr, "failed to enroll audio\n");
                exit(EXIT_FAILURE);
            }
            fprintf(stdout, "\rEnrollment progress: %.2f%%", enroll_percentage);
            fflush(stdout);
        }
        fprintf(stdout, "\n");

        if (is_interrupted) {
            fprintf(stdout, "Enrollment interrupted.\n");
            exit(EXIT_SUCCESS);
        }

        fprintf(stdout, "Enrollment complete.\n");

        int32_t profile_size_bytes = 0;
        eagle_profiler_status = pv_eagle_profiler_speaker_profile_size_func(eagle_profiler, &profile_size_bytes);
        if (eagle_profiler_status != PV_STATUS_SUCCESS) {
            (void) fprintf(stderr, "failed to get profile size with `%s`",
                           pv_status_to_string_func(eagle_profiler_status));
            exit(EXIT_FAILURE);
        }
        speaker_profile = calloc(profile_size_bytes, sizeof(uint8_t));
        if (!speaker_profile) {
            (void) fprintf(stderr, "failed to allocate memory for profile");
            exit(EXIT_FAILURE);
        }

        eagle_profiler_status = pv_eagle_profiler_export_func(
                eagle_profiler,
                speaker_profile);
        if (eagle_profiler_status != PV_STATUS_SUCCESS) {
            (void) fprintf(stderr, "failed to export profile with `%s`",
                           pv_status_to_string_func(eagle_profiler_status));
            exit(EXIT_FAILURE);
        }

        free(enroll_pcm);
        pv_eagle_profiler_delete_func(eagle_profiler);

        if (profile_output_path) {

            FILE *profile_output_file = NULL;

#if defined(_WIN32) || defined(_WIN64)

            int profile_output_path_wchars_num = MultiByteToWideChar(CP_UTF8, UTF8_COMPOSITION_FLAG, profile_output_path, NULL_TERMINATED, NULL, 0);
            wchar_t profile_output_path_wchars[profile_output_path_wchars_num];
            MultiByteToWideChar(CP_UTF8, UTF8_COMPOSITION_FLAG, profile_output_path, NULL_TERMINATED, profile_output_path_wchars, profile_output_path_wchars_num);
            profile_output_file = _wfopen(profile_output_path_wchars, "wb")

#else

            profile_output_file = fopen(profile_output_path, "wb");

#endif

            if (!profile_output_file) {
                fprintf(stderr, "failed to open '%s' for writing\n", profile_output_path);
                exit(EXIT_FAILURE);
            }

            fwrite(speaker_profile, profile_size_bytes, sizeof(uint8_t), profile_output_file);

            fclose(profile_output_file);
        }
    }

    // Speaker recognition
    pv_eagle_t *eagle = NULL;
    pv_status_t eagle_status = pv_eagle_init_func(
            access_key,
            model_path,
            1,
            (const void *const *) &speaker_profile,
            &eagle);
    if (eagle_status != PV_STATUS_SUCCESS) {
        fprintf(stderr, "failed to create an instance of eagle with '%s'\n", pv_status_to_string_func(eagle_status));
        exit(EXIT_FAILURE);
    }

    recorder_status = pv_recorder_start(recorder);
    if (recorder_status != PV_RECORDER_STATUS_SUCCESS) {
        fprintf(stderr, "Failed to start device with %s.\n", pv_recorder_status_to_string(recorder_status));
        exit(EXIT_FAILURE);
    }

    float score = 0.0f;
    int16_t *pcm = (int16_t *) calloc(frame_length, sizeof(int16_t));
    if (!pcm) {
        fprintf(stderr, "Failed to allocate pcm memory.\n");
        exit(EXIT_FAILURE);
    }

    fprintf(stdout, "Listening... (press Ctrl+C to stop)\n");
    while (!is_interrupted) {
        recorder_status = pv_recorder_read(recorder, pcm);
        if (recorder_status != PV_RECORDER_STATUS_SUCCESS) {
            fprintf(stderr, "Failed to read with %s.\n", pv_recorder_status_to_string(recorder_status));
            exit(EXIT_FAILURE);
        }

        eagle_status = pv_eagle_process_func(eagle, pcm, &score);
        if (eagle_status != PV_STATUS_SUCCESS) {
            fprintf(stderr, "Failed to process audio with %s.\n", pv_status_to_string_func(eagle_status));
            exit(EXIT_FAILURE);
        }

        fprintf(stdout, "\r[score: %.2f]", score);
        fflush(stdout);
    }
    fprintf(stdout, "\n");

    recorder_status = pv_recorder_stop(recorder);
    if (recorder_status != PV_RECORDER_STATUS_SUCCESS) {
        fprintf(stderr, "Failed to stop device with %s.\n", pv_recorder_status_to_string(recorder_status));
        exit(1);
    }

    free(pcm);
    free(speaker_profile);
    pv_recorder_delete(recorder);
    pv_eagle_delete_func(eagle);
    close_dl(eagle_library);

    return EXIT_SUCCESS;
}

int main(int argc, char *argv[]) {

#if defined(_WIN32) || defined(_WIN64)

    LPWSTR *wargv = CommandLineToArgvW(GetCommandLineW(), &argc);
    if (wargv == NULL) {
        fprintf(stderr, "CommandLineToArgvW failed\n");
        exit(EXIT_FAILURE);
    }

    char *utf8_argv[argc];

    for (int i = 0; i < argc; ++i) {
        // WideCharToMultiByte: https://docs.microsoft.com/en-us/windows/win32/api/stringapiset/nf-stringapiset-widechartomultibyte
        int arg_chars_num = WideCharToMultiByte(CP_UTF8, UTF8_COMPOSITION_FLAG, wargv[i], NULL_TERMINATED, NULL, 0, NULL, NULL);
        utf8_argv[i] = (char *) malloc(arg_chars_num * sizeof(char));
        if (!utf8_argv[i]) {
            fprintf(stderr, "failed to to allocate memory for converting args");
        }
        WideCharToMultiByte(CP_UTF8, UTF8_COMPOSITION_FLAG, wargv[i], NULL_TERMINATED, utf8_argv[i], arg_chars_num, NULL, NULL);
    }

    LocalFree(wargv);
    argv = utf8_argv;

#endif

    int result = picovoice_main(argc, argv);

#if defined(_WIN32) || defined(_WIN64)

    for (int i = 0; i < argc; ++i) {
        free(utf8_argv[i]);
    }

#endif

    return result;
}
