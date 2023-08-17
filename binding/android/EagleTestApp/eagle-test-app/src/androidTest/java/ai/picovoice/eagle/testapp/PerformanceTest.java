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

import static org.junit.Assert.assertTrue;

import androidx.test.ext.junit.runners.AndroidJUnit4;

import org.junit.Assume;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.File;
import java.io.IOException;
import java.util.Arrays;

import ai.picovoice.eagle.Eagle;
import ai.picovoice.eagle.EagleProfile;
import ai.picovoice.eagle.EagleProfiler;

@RunWith(AndroidJUnit4.class)
public class PerformanceTest extends BaseTest {

    int numTestIterations = 30;

    @Before
    public void Setup() throws IOException {
        super.Setup();
        String iterationString = appContext.getString(R.string.numTestIterations);

        try {
            numTestIterations = Integer.parseInt(iterationString);
        } catch (NumberFormatException ignored) { }
    }

    @Test
    public void testProfilerPerformance() throws Exception {
        String enrollThresholdString = appContext.getString(R.string.enrollPerformanceThresholdSec);
        Assume.assumeNotNull(enrollThresholdString);
        Assume.assumeFalse(enrollThresholdString.equals(""));

        double enrollPerformanceThresholdSec = Double.parseDouble(enrollThresholdString);

        EagleProfiler eagleProfiler = new EagleProfiler.Builder()
                .setAccessKey(accessKey)
                .build(appContext);

        File audioFile = new File(testResourcesPath, testPath);
        short[] pcm = readAudioFile(audioFile.getAbsolutePath());

        long totalNSec = 0;
        for (int i = 0; i < numTestIterations + 1; i++) {
            long before = System.nanoTime();
            eagleProfiler.enroll(pcm);
            long after = System.nanoTime();

            // throw away first run to account for cold start
            if (i > 0) {
                totalNSec += (after - before);
            }
        }

        double avgNSec = totalNSec / (double) numTestIterations;
        double avgSec = ((double) Math.round(avgNSec * 1e-6)) / 1000.0;
        assertTrue(
                String.format(
                    "Expected threshold (%.3fs), profiler took (%.3fs)",
                    enrollPerformanceThresholdSec,
                    avgSec),
                avgSec <= enrollPerformanceThresholdSec
        );

        eagleProfiler.delete();
    }

    @Test
    public void testProcPerformance() throws Exception {
        String procThresholdString = appContext.getString(R.string.procPerformanceThresholdSec);
        Assume.assumeNotNull(procThresholdString);
        Assume.assumeFalse(procThresholdString.equals(""));

        double procPerformanceThresholdSec = Double.parseDouble(procThresholdString);

        EagleProfiler eagleProfiler = new EagleProfiler.Builder()
                .setAccessKey(accessKey)
                .build(appContext);

        for (String path : enrollPaths) {
            File audioFile = new File(testResourcesPath, path);
            short[] pcm = readAudioFile(audioFile.getAbsolutePath());
            eagleProfiler.enroll(pcm);
        }

        EagleProfile profile = eagleProfiler.export();

        Eagle eagle = new Eagle.Builder()
                .setAccessKey(accessKey)
                .setSpeakerProfile(profile)
                .build(appContext);

        File audioFile = new File(testResourcesPath, testPath);
        short[] pcm = readAudioFile(audioFile.getAbsolutePath());
        int numFrames = pcm.length / eagle.getFrameLength();

        long totalNSec = 0;
        for (int i = 0; i < numTestIterations + 1; i++) {
            long before = System.nanoTime();
            for (int j = 0; j < numFrames; j++) {
                eagle.process(Arrays.copyOfRange(
                        pcm,
                        i * eagle.getFrameLength(), (i + 1) * eagle.getFrameLength())
                );
            }
            long after = System.nanoTime();

            // throw away first run to account for cold start
            if (i > 0) {
                totalNSec += (after - before);
            }
        }

        double avgNSec = totalNSec / (double) numTestIterations;
        double avgSec = ((double) Math.round(avgNSec * 1e-6)) / 1000.0;
        assertTrue(
                String.format("Expected threshold (%.3fs), process took (%.3fs)", procPerformanceThresholdSec, avgSec),
                avgSec <= procPerformanceThresholdSec
        );
    }
}
