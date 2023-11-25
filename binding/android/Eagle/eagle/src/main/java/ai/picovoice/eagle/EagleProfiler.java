/*
    Copyright 2023 Picovoice Inc.

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
 * Android binding for the profiler of the Eagle speaker recognition engine.
 * It enrolls a speaker given a set of utterances and then constructs a profile for the enrolled speaker.
 */
public class EagleProfiler {

    private static String defaultModelPath;
    private static String _sdk = "android";

    private final int minEnrollSamples;

    static {
        System.loadLibrary("pv_eagle");
    }

    private long handle;

    public static void setSdk(String sdk) {
        EagleProfiler._sdk = sdk;
    }

    /**
     * Constructor.
     *
     * @param accessKey AccessKey obtained from Picovoice Console
     * @param modelPath Absolute path to the file containing Eagle model parameters.
     * @throws EagleException if there is an error while initializing EagleProfiler.
     */
    private EagleProfiler(String accessKey, String modelPath) throws EagleException {
        EagleNative.setSdk(EagleProfiler._sdk);
        handle = EagleProfilerNative.init(accessKey, modelPath);
        minEnrollSamples = EagleProfilerNative.minEnrollSamples(handle);
    }

    /**
     * Releases resources acquired by Eagle.
     */
    public void delete() {
        if (handle != 0) {
            EagleProfilerNative.delete(handle);
            handle = 0;
        }
    }

    /**
     * Enrolls a speaker. This function should be called multiple times with different utterances of the same speaker
     * until `percentage` reaches `100.0`. Any further enrollment can be used to improve the speaker voice profile.
     * The minimum number of required samples can be obtained by calling `.getMinEnrollSamples()`.
     * The audio data used for enrollment should satisfy the following requirements:
     *     - only one speaker should be present in the audio
     *     - the speaker should be speaking in a normal voice
     *     - the audio should contain no speech from other speakers and no other sounds (e.g. music)
     *     - it should be captured in a quiet environment with no background noise
     *
     * @param pcm The audio needs to have a sample rate equal to `.getSampleRate()` and be
     *            16-bit linearly-encoded. EagleProfiler operates on single-channel audio.
     * @return The percentage of completeness of the speaker enrollment process along with the feedback code
     *         corresponding to the last enrollment attempt.
     * @throws EagleException if there is an error while enrolling speaker.
     */
    public EagleProfilerEnrollResult enroll(short[] pcm) throws EagleException {
        if (handle == 0) {
            throw new EagleInvalidStateException("Attempted to call eagle enroll after delete.");
        }

        return EagleProfilerNative.enroll(handle, pcm, pcm.length);
    }

    /**
     * Exports the speaker profile of the current session. Will raise an exception if the profile is not ready.
     *
     * @return An EagleProfile object.
     */
    public EagleProfile export() throws EagleException {
        if (handle == 0) {
            throw new EagleInvalidStateException("Attempted to call eagle profile export after delete.");
        }

        return new EagleProfile(EagleProfilerNative.export(handle));
    }

    /**
     * Resets the internal state of Eagle Profiler. It should be called before starting a new enrollment session.
     */
    public void reset() throws EagleException {
        if (handle == 0) {
            throw new EagleInvalidStateException("Attempted to call eagle reset after delete.");
        }

        EagleProfilerNative.reset(handle);
    }

    /**
     * Getter for version.
     *
     * @return Version.
     */
    public String getVersion() {
        return EagleProfilerNative.getVersion();
    }

    /**
     * Getter for audio sample rate accepted by Picovoice.
     *
     * @return Audio sample rate accepted by Picovoice.
     */
    public int getSampleRate() {
        return EagleProfilerNative.getSampleRate();
    }

    /**
     * Getter for minimum length of the input pcm required by `.enroll()`.
     *
     * @return minimum length of the input pcm.
     */
    public int getMinEnrollSamples() {
        return this.minEnrollSamples;
    }

    /**
     * Builder for creating instance of EagleProfiler.
     */
    public static class Builder {

        private String accessKey = null;
        private String modelPath = null;

        public Builder setAccessKey(String accessKey) {
            this.accessKey = accessKey;
            return this;
        }

        public Builder setModelPath(String modelPath) {
            this.modelPath = modelPath;
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
         * Validates properties and creates an instance of the Eagle profiler.
         *
         * @param context Android app context (for extracting Eagle resources)
         * @return An instance Eagle profiler
         * @throws EagleException if there is an error while initializing Eagle profiler.
         */
        public EagleProfiler build(Context context) throws EagleException {
            if (accessKey == null || this.accessKey.equals("")) {
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

            return new EagleProfiler(accessKey, modelPath);
        }
    }

}
