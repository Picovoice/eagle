/*
    Copyright 2023 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is
    located in the "LICENSE" file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the
    License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
    express or implied. See the License for the specific language governing permissions and
    limitations under the License.
*/

package ai.picovoice.eagle.testapp;

import android.content.Context;
import android.content.res.AssetManager;

import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Before;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class BaseTest {
    static Set<String> extractedFiles = new HashSet<>();
    protected final String[] enrollPaths = {
            "speaker_1_utt_1.wav",
            "speaker_1_utt_2.wav"
    };
    protected final String testPath = "speaker_1_test_utt.wav";
    protected final String imposterPath = "speaker_2_test_utt.wav";

    Context testContext;
    Context appContext;
    AssetManager assetManager;
    String testResourcesPath;
    String defaultModelPath;

    String accessKey;

    @Before
    public void Setup() throws IOException {
        testContext = InstrumentationRegistry.getInstrumentation().getContext();
        appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assetManager = testContext.getAssets();
        testResourcesPath = new File(appContext.getFilesDir(), "test_resources").getAbsolutePath();
        defaultModelPath = getModelFilepath("eagle_params.pv");

        accessKey = appContext.getString(R.string.pvTestingAccessKey);
    }

    protected static short[] readAudioFile(String audioFile) throws Exception {
        FileInputStream audioInputStream = new FileInputStream(audioFile);
        ByteArrayOutputStream audioByteBuffer = new ByteArrayOutputStream();
        byte[] buffer = new byte[1024];
        for (int length; (length = audioInputStream.read(buffer)) != -1; ) {
            audioByteBuffer.write(buffer, 0, length);
        }
        byte[] rawData = audioByteBuffer.toByteArray();

        short[] pcm = new short[rawData.length / 2];
        ByteBuffer pcmBuff = ByteBuffer.wrap(rawData).order(ByteOrder.LITTLE_ENDIAN);
        pcmBuff.asShortBuffer().get(pcm);
        pcm = Arrays.copyOfRange(pcm, 44, pcm.length);

        return pcm;
    }

    public String getModelFilepath(String modelFilename) throws IOException {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String resPath = new File(
                context.getFilesDir(),
                "test_resources").getAbsolutePath();
        String modelPath = String.format("model_files/%s", modelFilename);
        extractTestFile(String.format("test_resources/%s", modelPath));
        return new File(resPath, modelPath).getAbsolutePath();
    }

    public String getAudioFilepath(String audioFilename) throws IOException {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String resPath = new File(
                context.getFilesDir(),
                "test_resources").getAbsolutePath();
        extractTestFile(String.format("test_resources/audio_samples/%s", audioFilename));
        return new File(resPath, String.format("audio_samples/%s", audioFilename)).getAbsolutePath();
    }

    private void extractTestFile(String filepath) throws IOException {
        File absPath = new File(
                appContext.getFilesDir(),
                filepath);

        if (extractedFiles.contains(filepath)) {
            return;
        }

        if (!absPath.exists()) {
            if (absPath.getParentFile() != null) {
                absPath.getParentFile().mkdirs();
            }
            absPath.createNewFile();
        }

        InputStream is = new BufferedInputStream(
                assetManager.open(filepath),
                256);
        OutputStream os = new BufferedOutputStream(
                new FileOutputStream(absPath),
                256);

        int r;
        while ((r = is.read()) != -1) {
            os.write(r);
        }
        os.flush();

        is.close();
        os.close();

        extractedFiles.add(filepath);

    }
}
