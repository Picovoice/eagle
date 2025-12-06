/*
    Copyright 2023-2025 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is
    located in the "LICENSE" file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the
    License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
    express or implied. See the License for the specific language governing permissions and
    limitations under the License.
*/

package ai.picovoice.eagle;

import android.content.Context;
import android.content.res.Resources;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Android binding for Eagle speaker recognition engine.
 */
public class Eagle {

    private static String defaultModelPath;
    private static String _sdk = "android";

    static {
        System.loadLibrary("pv_eagle");
    }

    private long handle;
    private int numSpeakers;

    public static void setSdk(String sdk) {
        Eagle._sdk = sdk;
    }

    /**
     * Lists all available devices that Eagle can use for inference.
     * Each entry in the list can be used as the `device` argument when initializing Eagle.
     *
     * @return Array of all available devices that Eagle can be used for inference.
     * @throws EagleException if getting available devices fails.
     */
    public static String[] getAvailableDevices() throws EagleException {
        return EagleNative.listHardwareDevices();
    }

    /**
     * Constructor.
     *
     * @param accessKey AccessKey obtained from Picovoice Console
     * @param modelPath Absolute path to the file containing Eagle model parameters.
     * @param device String representation of the device (e.g., CPU or GPU) to use for inference.
     *               If set to `best`, the most suitable device is selected automatically. If set to `gpu`,
     *               the engine uses the first available GPU device. To select a specific GPU device, set this
     *               argument to `gpu:${GPU_INDEX}`, where `${GPU_INDEX}` is the index of the target GPU. If
     *               set to `cpu`, the engine will run on the CPU with the default number of threads. To specify
     *               the number of threads, set this argument to `cpu:${NUM_THREADS}`, where `${NUM_THREADS}`
     *               is the desired number of threads.
     * @param speakerProfiles A list of EagleProfile objects. This can be constructed using `EagleProfiler`.
     * @throws EagleException if there is an error while initializing Eagle.
     */
    private Eagle(
            String accessKey,
            String modelPath,
            String device,
            EagleProfile[] speakerProfiles) throws EagleException {
        long[] profileHandles = new long[speakerProfiles.length];

        for (int i = 0; i < speakerProfiles.length; i++) {
            profileHandles[i] = speakerProfiles[i].profileNative.handle;
        }

        EagleNative.setSdk(Eagle._sdk);
        handle = EagleNative.init(
                accessKey,
                modelPath,
                device,
                speakerProfiles.length,
                profileHandles);

        numSpeakers = speakerProfiles.length;
    }

    /**
     * Releases resources acquired by Eagle.
     */
    public void delete() {
        if (handle != 0) {
            EagleNative.delete(handle);
            handle = 0;
        }
    }

    /**
     * Processes a frame of audio and returns a list of similarity scores for each speaker profile.
     *
     * @param pcm A frame of audio samples. The number of samples per frame can be attained by calling
     *            `.getFrameLength()`. The incoming audio needs to have a sample rate equal
     *            to `.getSampleRate()` and be 16-bit linearly-encoded. Eagle operates on single-channel audio.
     * @return A list of similarity scores for each speaker profile. A higher score indicates that the voice
     *         belongs to the corresponding speaker. The range is [0, 1] with 1.0 representing a perfect match.
     * @throws EagleException if there is an error while processing audio frames.
     */
    public float[] process(short[] pcm) throws EagleException {
        if (handle == 0) {
            throw new EagleInvalidStateException("Attempted to call eagle process after delete.");
        }

        if (pcm.length != this.getFrameLength()) {
            throw new EagleInvalidArgumentException(
                    String.format("Length of input frame %d does not match required frame length %d",
                            pcm.length,
                            this.getSampleRate()));
        }

        return EagleNative.process(handle, pcm, numSpeakers);
    }

    /**
     * Resets the internal state of Eagle Profiler.
     * It should be called before starting a new enrollment session.
     *
     * @throws EagleException if there is an error while resetting Eagle.
     */
    public void reset() throws EagleException {
        if (handle == 0) {
            throw new EagleInvalidStateException("Attempted to call eagle reset after delete.");
        }

        EagleNative.reset(handle);
    }

    /**
     * Getter for version.
     *
     * @return Version.
     */
    public String getVersion() {
        return EagleNative.getVersion();
    }

    /**
     * Getter for number of audio samples per frame.
     *
     * @return Number of audio samples per frame.
     */
    public int getFrameLength() {
        return EagleNative.getFrameLength();
    }

    /**
     * Getter for audio sample rate accepted by Picovoice.
     *
     * @return Audio sample rate accepted by Picovoice.
     */
    public int getSampleRate() {
        return EagleNative.getSampleRate();
    }

    /**
     * Builder for creating instance of Eagle.
     */
    public static class Builder {

        private String accessKey = null;
        private String modelPath = null;
        private String device = null;

        private EagleProfile[] speakerProfiles = null;

        public Builder setAccessKey(String accessKey) {
            this.accessKey = accessKey;
            return this;
        }

        public Builder setModelPath(String modelPath) {
            this.modelPath = modelPath;
            return this;
        }

        public Builder setDevice(String device) {
            this.device = device;
            return this;
        }

        public Builder setSpeakerProfiles(EagleProfile[] speakerProfiles) {
            this.speakerProfiles = speakerProfiles;
            return this;
        }

        public Builder setSpeakerProfile(EagleProfile speakerProfile) {
            this.speakerProfiles = new EagleProfile[]{ speakerProfile };
            return this;
        }

        private static void extractPackageResources(Context context) throws EagleIOException {
            final Resources resources = context.getResources();

            try {
                defaultModelPath = extractResource(context,
                        resources.openRawResource(R.raw.eagle_params),
                        resources.getResourceEntryName(R.raw.eagle_params) + ".pv");
            } catch (IOException ex) {
                throw new EagleIOException(ex);
            }
        }

        private static String extractResource(
                Context context,
                InputStream srcFileStream,
                String dstFilename
        ) throws IOException {
            InputStream is = new BufferedInputStream(srcFileStream, 256);
            OutputStream os = new BufferedOutputStream(context.openFileOutput(dstFilename, Context.MODE_PRIVATE), 256);
            int r;
            while ((r = is.read()) != -1) {
                os.write(r);
            }
            os.flush();

            is.close();
            os.close();
            return new File(context.getFilesDir(), dstFilename).getAbsolutePath();
        }

        /**
         * Validates properties and creates an instance of the Eagle speaker recognition engine.
         *
         * @param context Android app context (for extracting Eagle resources)
         * @return An instance Eagle speaker recognition engine
         * @throws EagleException if there is an error while initializing Eagle.
         */
        public Eagle build(Context context) throws EagleException {
            if (accessKey == null || accessKey.equals("")) {
                throw new EagleInvalidArgumentException("No AccessKey was provided to Eagle");
            }

            if (modelPath == null) {
                if (defaultModelPath == null) {
                    extractPackageResources(context);
                }
                modelPath = defaultModelPath;
            } else {
                File modelFile = new File(modelPath);
                String modelFilename = modelFile.getName();
                if (!modelFile.exists() && !modelFilename.equals("")) {
                    try {
                        modelPath = extractResource(context,
                                context.getAssets().open(modelPath),
                                modelFilename);
                    } catch (IOException ex) {
                        throw new EagleIOException(ex);
                    }
                }
            }

            if (device == null) {
                device = "best";
            }

            if (speakerProfiles == null || speakerProfiles.length == 0) {
                throw new EagleInvalidArgumentException("No speaker profiles provided to Eagle");
            }

            return new Eagle(accessKey, modelPath, device, speakerProfiles);
        }
    }

}
