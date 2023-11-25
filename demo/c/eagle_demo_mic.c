/*
    Copyright 2023 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
    file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
    an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
*/

#include <getopt.h>
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
        {"enroll",              required_argument, NULL, 'e'},
        {"test",                required_argument, NULL, 't'},
        {"show_audio_devices",  no_argument,       NULL, 's'},

};

pv_status_t (*pv_get_error_stack_func)(char ***, int32_t *) = NULL;
void (*pv_free_error_stack_func)(char **) = NULL;

static void print_usage(const char *program_name) {
    fprintf(stdout,
            "Usage: %s [-s] [-e OUTPUT_PROFILE_PATH | -t INPUT_PROFILE_PATH] [-l LIBRARY_PATH -m MODEL_PATH -a ACCESS_KEY -d AUDIO_DEVICE_INDEX]\n",
            program_name);
}

static void print_error_message(char **message_stack, int32_t message_stack_depth) {
    for (int32_t i = 0; i < message_stack_depth; i++) {
        fprintf(stderr, "  [%d] %s\n", i, message_stack[i]);
    }
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

void speaker_enrollment(
        const char *access_key,
        const char *model_path,
        const char *output_profile_path,
        void *eagle_library,
        pv_recorder_t *recorder) {

    const char *(*pv_status_to_string_func)(pv_status_t) = load_symbol(eagle_library, "pv_status_to_string");
    if (!pv_status_to_string_func) {
        print_dl_error("Failed to load 'pv_status_to_string'");
        exit(EXIT_FAILURE);
    }

    int32_t (*pv_sample_rate_func)() = load_symbol(eagle_library, "pv_sample_rate");
    if (!pv_sample_rate_func) {
        print_dl_error("Failed to load 'pv_sample_rate'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_eagle_profiler_init_func)(
            const char *,
            const char *,
            pv_eagle_profiler_t **) = load_symbol(eagle_library, "pv_eagle_profiler_init");
    if (!pv_eagle_profiler_init_func) {
        print_dl_error("Failed to load 'pv_eagle_profiler_init'");
        exit(EXIT_FAILURE);
    }

    void
    (*pv_eagle_profiler_delete_func)(pv_eagle_profiler_t *) = load_symbol(eagle_library, "pv_eagle_profiler_delete");
    if (!pv_eagle_profiler_delete_func) {
        print_dl_error("Failed to load 'pv_eagle_profiler_delete'");
        exit(EXIT_FAILURE);
    }

    const char *(*pv_eagle_profiler_enroll_feedback_to_string_func)(
            pv_eagle_profiler_enroll_feedback_t) = load_symbol(eagle_library,
                                                                   "pv_eagle_profiler_enroll_feedback_to_string");
    if (!pv_eagle_profiler_enroll_feedback_to_string_func) {
        print_dl_error("Failed to load 'pv_eagle_profiler_enroll_feedback_to_string'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_eagle_profiler_enroll_func)(
            pv_eagle_profiler_t *,
            const int16_t *,
            int32_t,
            pv_eagle_profiler_enroll_feedback_t *,
            float *) = load_symbol(eagle_library, "pv_eagle_profiler_enroll");
    if (!pv_eagle_profiler_enroll_func) {
        print_dl_error("Failed to load 'pv_eagle_profiler_enroll'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_eagle_profiler_enroll_min_audio_length_samples_func)(
            const pv_eagle_profiler_t *,
            int32_t *) = load_symbol(eagle_library, "pv_eagle_profiler_enroll_min_audio_length_samples");
    if (!pv_eagle_profiler_enroll_min_audio_length_samples_func) {
        print_dl_error("Failed to load 'pv_eagle_profiler_enroll_min_audio_length_samples'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_eagle_profiler_export_func)(
            const pv_eagle_profiler_t *,
            void *) = load_symbol(eagle_library, "pv_eagle_profiler_export");
    if (!pv_eagle_profiler_export_func) {
        print_dl_error("Failed to load 'pv_eagle_profiler_export'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_eagle_profiler_export_size_func)(
            const pv_eagle_profiler_t *,
            int32_t *) = load_symbol(eagle_library, "pv_eagle_profiler_export_size");
    if (!pv_eagle_profiler_export_size_func) {
        print_dl_error("Failed to load 'pv_eagle_profiler_export_size'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_eagle_profiler_reset_func)(
            pv_eagle_profiler_t *) = load_symbol(eagle_library, "pv_eagle_profiler_reset");
    if (!pv_eagle_profiler_reset_func) {
        print_dl_error("Failed to load 'pv_eagle_profiler_reset'");
        exit(EXIT_FAILURE);
    }

    int32_t (*pv_eagle_frame_length_func)() = load_symbol(eagle_library, "pv_eagle_frame_length");
    if (!pv_eagle_frame_length_func) {
        print_dl_error("Failed to load 'pv_eagle_frame_length'");
        exit(EXIT_FAILURE);
    }

    char **message_stack = NULL;
    int32_t message_stack_depth = 0;
    pv_status_t error_status = PV_STATUS_RUNTIME_ERROR;

    pv_eagle_profiler_t *eagle_profiler = NULL;
    pv_status_t eagle_profiler_status = pv_eagle_profiler_init_func(
            access_key,
            model_path,
            &eagle_profiler);
    if (eagle_profiler_status != PV_STATUS_SUCCESS) {
        fprintf(stderr, "Failed to create an instance of eagle profiler");
        error_status = pv_get_error_stack_func(&message_stack, &message_stack_depth);
        if (error_status != PV_STATUS_SUCCESS) {
            fprintf(
                    stderr,
                    ".\nUnable to get Eagle error state with '%s'.\n",
                    pv_status_to_string_func(error_status));
            exit(EXIT_FAILURE);
        }

        if (message_stack_depth > 0) {
            fprintf(stderr, ":\n");
            print_error_message(message_stack, message_stack_depth);
            pv_free_error_stack_func(message_stack);
        }
        exit(EXIT_FAILURE);
    }

    int32_t num_enroll_samples = 0;
    eagle_profiler_status = pv_eagle_profiler_enroll_min_audio_length_samples_func(
            eagle_profiler, &num_enroll_samples);
    if (eagle_profiler_status != PV_STATUS_SUCCESS) {
        fprintf(stderr, "Failed to get minimum number of enrollment samples");
        error_status = pv_get_error_stack_func(&message_stack, &message_stack_depth);
        if (error_status != PV_STATUS_SUCCESS) {
            fprintf(
                    stderr,
                    ".\nUnable to get Eagle error state with '%s'.\n",
                    pv_status_to_string_func(error_status));
            exit(EXIT_FAILURE);
        }

        if (message_stack_depth > 0) {
            fprintf(stderr, ":\n");
            print_error_message(message_stack, message_stack_depth);
            pv_free_error_stack_func(message_stack);
        }
        exit(EXIT_FAILURE);
    }


    int16_t *enroll_pcm = (int16_t *) malloc(num_enroll_samples * sizeof(int16_t));
    if (!enroll_pcm) {
        fprintf(stderr, "Failed to allocate pcm memory.\n");
        exit(EXIT_FAILURE);
    }

    fprintf(stdout, "Starting enrollment. Keep talking to the device until the progress reaches 100%%.\n");

    float enroll_percentage = 0.0f;
    pv_eagle_profiler_enroll_feedback_t feedback = PV_EAGLE_PROFILER_ENROLL_FEEDBACK_AUDIO_OK;
    const int32_t frame_length = pv_eagle_frame_length_func();

    while ((enroll_percentage < 100.0f) && (!is_interrupted)) {
        pv_recorder_status_t recorder_status = pv_recorder_start(recorder);
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
                &feedback,
                &enroll_percentage);
        if (eagle_profiler_status != PV_STATUS_SUCCESS) {
            fprintf(stderr, "Failed to enroll audio");
            error_status = pv_get_error_stack_func(&message_stack, &message_stack_depth);
            if (error_status != PV_STATUS_SUCCESS) {
                fprintf(
                        stderr,
                        ".\nUnable to get Eagle error state with '%s'.\n",
                        pv_status_to_string_func(error_status));
                exit(EXIT_FAILURE);
            }

            if (message_stack_depth > 0) {
                fprintf(stderr, ":\n");
                print_error_message(message_stack, message_stack_depth);
                pv_free_error_stack_func(message_stack);
            }
            exit(EXIT_FAILURE);
        }
        if (feedback != PV_EAGLE_PROFILER_ENROLL_FEEDBACK_AUDIO_OK) {
            fprintf(stdout, "\nEnrollment audio feedback: %s\n",
                    pv_eagle_profiler_enroll_feedback_to_string_func(feedback));
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
    eagle_profiler_status = pv_eagle_profiler_export_size_func(eagle_profiler, &profile_size_bytes);
    if (eagle_profiler_status != PV_STATUS_SUCCESS) {
        (void) fprintf(stderr, "Failed to get profile size with `%s`",
                       pv_status_to_string_func(eagle_profiler_status));
        error_status = pv_get_error_stack_func(&message_stack, &message_stack_depth);
        if (error_status != PV_STATUS_SUCCESS) {
            fprintf(
                    stderr,
                    ".\nUnable to get Eagle error state with '%s'.\n",
                    pv_status_to_string_func(error_status));
            exit(EXIT_FAILURE);
        }

        if (message_stack_depth > 0) {
            fprintf(stderr, ":\n");
            print_error_message(message_stack, message_stack_depth);
            pv_free_error_stack_func(message_stack);
        }
        exit(EXIT_FAILURE);
    }

    void *speaker_profile = calloc(profile_size_bytes, sizeof(uint8_t));
    if (!speaker_profile) {
        (void) fprintf(stderr, "Failed to allocate memory for profile");
        exit(EXIT_FAILURE);
    }

    eagle_profiler_status = pv_eagle_profiler_export_func(
            eagle_profiler,
            speaker_profile);
    if (eagle_profiler_status != PV_STATUS_SUCCESS) {
        (void) fprintf(stderr, "Failed to export profile with `%s`",
                       pv_status_to_string_func(eagle_profiler_status));
        exit(EXIT_FAILURE);
    }

    free(enroll_pcm);
    pv_eagle_profiler_delete_func(eagle_profiler);


    FILE *output_profile_file = NULL;

#if defined(_WIN32) || defined(_WIN64)

    int output_profile_path_wchars_num = MultiByteToWideChar(CP_UTF8, UTF8_COMPOSITION_FLAG, output_profile_path, NULL_TERMINATED, NULL, 0);
            wchar_t output_profile_path_wchars[output_profile_path_wchars_num];
            MultiByteToWideChar(CP_UTF8, UTF8_COMPOSITION_FLAG, output_profile_path, NULL_TERMINATED, output_profile_path_wchars, output_profile_path_wchars_num);
            output_profile_file = _wfopen(output_profile_path_wchars, L"wb");

#else

    output_profile_file = fopen(output_profile_path, "wb");

#endif

    if (!output_profile_file) {
        fprintf(stderr, "Failed to open '%s' for writing\n", output_profile_path);
        exit(EXIT_FAILURE);
    }

    fwrite(speaker_profile, profile_size_bytes, sizeof(uint8_t), output_profile_file);

    fclose(output_profile_file);
}

void speaker_recognition(
        const char *access_key,
        const char *model_path,
        const char *input_profile_path,
        void *eagle_library,
        pv_recorder_t *recorder) {

    const char *(*pv_status_to_string_func)(pv_status_t) = load_symbol(eagle_library, "pv_status_to_string");
    if (!pv_status_to_string_func) {
        print_dl_error("Failed to load 'pv_status_to_string'");
        exit(EXIT_FAILURE);
    }

    int32_t (*pv_sample_rate_func)() = load_symbol(eagle_library, "pv_sample_rate");
    if (!pv_sample_rate_func) {
        print_dl_error("Failed to load 'pv_sample_rate'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_eagle_init_func)(
            const char *,
            const char *,
            int32_t,
            const void *const *,
            pv_eagle_t **) = load_symbol(eagle_library, "pv_eagle_init");
    if (!pv_eagle_init_func) {
        print_dl_error("Failed to load 'pv_eagle_init'");
        exit(EXIT_FAILURE);
    }

    void (*pv_eagle_delete_func)(pv_eagle_t *) = load_symbol(eagle_library, "pv_eagle_delete");
    if (!pv_eagle_delete_func) {
        print_dl_error("Failed to load 'pv_eagle_delete'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_eagle_process_func)(
            pv_eagle_t *,
            const int16_t *,
            float *) = load_symbol(eagle_library, "pv_eagle_process");
    if (!pv_eagle_process_func) {
        print_dl_error("Failed to load 'pv_eagle_process'");
        exit(EXIT_FAILURE);
    }

    int32_t (*pv_eagle_reset_func)(
            pv_eagle_t *) = load_symbol(eagle_library, "pv_eagle_reset");
    if (!pv_eagle_reset_func) {
        print_dl_error("Failed to load 'pv_eagle_reset'");
        exit(EXIT_FAILURE);
    }

    pv_status_t (*pv_eagle_frame_length_func)() = load_symbol(eagle_library, "pv_eagle_frame_length");
    if (!pv_eagle_frame_length_func) {
        print_dl_error("Failed to load 'pv_eagle_frame_length'");
        exit(EXIT_FAILURE);
    }


    FILE *input_profile_file = NULL;

#if defined(_WIN32) || defined(_WIN64)

    int input_profile_path_wchars_num = MultiByteToWideChar(CP_UTF8, UTF8_COMPOSITION_FLAG, input_profile_path, NULL_TERMINATED, NULL, 0);
        wchar_t input_profile_path_wchars[input_profile_path_wchars_num];
        MultiByteToWideChar(CP_UTF8, UTF8_COMPOSITION_FLAG, input_profile_path, NULL_TERMINATED, input_profile_path_wchars, input_profile_path_wchars_num);
        input_profile_file = _wfopen(input_profile_path_wchars, L"rb");

#else

    input_profile_file = fopen(input_profile_path, "rb");

#endif

    if (!input_profile_file) {
        fprintf(stderr, "Failed to open speaker profile file at '%s'.\n", input_profile_path);
        exit(EXIT_FAILURE);
    }

    fseek(input_profile_file, 0, SEEK_END);
    long speaker_profile_size = ftell(input_profile_file);
    rewind(input_profile_file);

    void *speaker_profile = calloc(speaker_profile_size, sizeof(uint8_t));
    size_t num_bytes = fread(speaker_profile, sizeof(uint8_t), speaker_profile_size, input_profile_file);
    if (num_bytes != speaker_profile_size) {
        fprintf(stderr, "Failed to read speaker profile from '%s'.\n", input_profile_path);
        exit(EXIT_FAILURE);
    }
    fclose(input_profile_file);

    char **message_stack = NULL;
    int32_t message_stack_depth = 0;
    pv_status_t error_status = PV_STATUS_RUNTIME_ERROR;

    pv_eagle_t *eagle = NULL;
    pv_status_t eagle_status = pv_eagle_init_func(
            access_key,
            model_path,
            1,
            (const void *const *) &speaker_profile,
            &eagle);
    if (eagle_status != PV_STATUS_SUCCESS) {
        fprintf(stderr, "Failed to create an instance of eagle with '%s'", pv_status_to_string_func(eagle_status));
        error_status = pv_get_error_stack_func(&message_stack, &message_stack_depth);
        if (error_status != PV_STATUS_SUCCESS) {
            fprintf(
                    stderr,
                    ".\nUnable to get Eagle error state with '%s'.\n",
                    pv_status_to_string_func(error_status));
        exit(EXIT_FAILURE);
        }

        if (message_stack_depth > 0) {
            fprintf(stderr, ":\n");
            print_error_message(message_stack, message_stack_depth);
            pv_free_error_stack_func(message_stack);
        }
        exit(EXIT_FAILURE);
    }

    pv_recorder_status_t recorder_status = pv_recorder_start(recorder);
    if (recorder_status != PV_RECORDER_STATUS_SUCCESS) {
        fprintf(stderr, "Failed to start device with %s.\n", pv_recorder_status_to_string(recorder_status));
        exit(EXIT_FAILURE);
    }

    float score = 0.0f;
    const int32_t frame_length = pv_eagle_frame_length_func();
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
            fprintf(stderr, "Failed to process audio with %s", pv_status_to_string_func(eagle_status));
            error_status = pv_get_error_stack_func(&message_stack, &message_stack_depth);
            if (error_status != PV_STATUS_SUCCESS) {
                fprintf(
                        stderr,
                        ".\nUnable to get Eagle error state with '%s'.\n",
                        pv_status_to_string_func(error_status));
            exit(EXIT_FAILURE);
            }

            if (message_stack_depth > 0) {
                fprintf(stderr, ":\n");
                print_error_message(message_stack, message_stack_depth);
                pv_free_error_stack_func(message_stack);
            }
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
    pv_eagle_delete_func(eagle);
}

int picovoice_main(int argc, char *argv[]) {
    signal(SIGINT, interrupt_handler);

    const char *access_key = NULL;
    const char *library_path = NULL;
    const char *model_path = NULL;
    const char *input_profile_path = NULL;
    const char *output_profile_path = NULL;
    int32_t device_index = -1;

    int c;
    while ((c = getopt_long(argc, argv, "sa:d:l:m:e:t:", long_options, NULL)) != -1) {
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
            case 'e':
                output_profile_path = optarg;
                break;
            case 't':
                input_profile_path = optarg;
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

    if (input_profile_path && output_profile_path) {
        fprintf(stderr, "Please run the demo in either enrollment or test mode\n");
        print_usage(argv[0]);
        exit(EXIT_FAILURE);
    }

    if (!input_profile_path && !output_profile_path) {
        fprintf(stderr, "Please specify either enrollment or test mode\n");
        print_usage(argv[0]);
        exit(EXIT_FAILURE);
    }

    void *eagle_library = open_dl(library_path);
    if (!eagle_library) {
        fprintf(stderr, "Failed to open library at '%s'.\n", library_path);
        exit(EXIT_FAILURE);
    }

    int32_t (*pv_eagle_frame_length_func)() = load_symbol(eagle_library, "pv_eagle_frame_length");
    if (!pv_eagle_frame_length_func) {
        print_dl_error("Failed to load 'pv_eagle_frame_length'");
        exit(EXIT_FAILURE);
    }

    char *(*pv_eagle_version_func)() = load_symbol(eagle_library, "pv_eagle_version");
    if (!pv_eagle_version_func) {
        print_dl_error("Failed to load 'pv_eagle_version'");
        exit(EXIT_FAILURE);
    }

    pv_get_error_stack_func = load_symbol(eagle_library, "pv_get_error_stack");
    if (!pv_get_error_stack_func) {
        print_dl_error("Failed to load 'pv_get_error_stack'");
        exit(EXIT_FAILURE);
    }

    pv_free_error_stack_func = load_symbol(eagle_library, "pv_free_error_stack");
    if (!pv_free_error_stack_func) {
        print_dl_error("Failed to load 'pv_free_error_stack'");
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

    if (output_profile_path) {
        speaker_enrollment(
                access_key,
                model_path,
                output_profile_path,
                eagle_library,
                recorder);
    } else {
        speaker_recognition(
                access_key,
                model_path,
                input_profile_path,
                eagle_library,
                recorder);
    }

    pv_recorder_delete(recorder);
    close_dl(eagle_library);

    return EXIT_SUCCESS;
}

int main(int argc, char *argv[]) {

#if defined(_WIN32) || defined(_WIN64)

    LPWSTR *wargv = CommandLineToArgvW(GetCommandLineW(), &argc);
    if (wargv == NULL) {
        fprintf(stderr, "CommandLineToArgvW Failed\n");
        exit(EXIT_FAILURE);
    }

    char *utf8_argv[argc];

    for (int i = 0; i < argc; ++i) {
        // WideCharToMultiByte: https://docs.microsoft.com/en-us/windows/win32/api/stringapiset/nf-stringapiset-widechartomultibyte
        int arg_chars_num = WideCharToMultiByte(CP_UTF8, UTF8_COMPOSITION_FLAG, wargv[i], NULL_TERMINATED, NULL, 0, NULL, NULL);
        utf8_argv[i] = (char *) malloc(arg_chars_num * sizeof(char));
        if (!utf8_argv[i]) {
            fprintf(stderr, "Failed to to allocate memory for converting args");
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
