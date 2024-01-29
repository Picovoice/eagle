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
import static org.junit.Assert.assertEquals;

import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.junit.experimental.runners.Enclosed;
import org.junit.runner.RunWith;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import ai.picovoice.eagle.Eagle;
import ai.picovoice.eagle.EagleException;
import ai.picovoice.eagle.EagleProfile;
import ai.picovoice.eagle.EagleProfiler;
import ai.picovoice.eagle.EagleProfilerEnrollFeedback;
import ai.picovoice.eagle.EagleProfilerEnrollResult;


@RunWith(Enclosed.class)
public class EagleTest {

    public static class StandardTests extends BaseTest {

        private EagleProfiler eagleProfiler = null;
        private EagleProfile profile = null;

        @Before
        public void init() throws Exception {
            eagleProfiler = new EagleProfiler.Builder()
                    .setAccessKey(accessKey)
                    .setModelPath(defaultModelPath)
                    .build(appContext);

            for (String path : enrollPaths) {
                File audioFile = new File(testResourcesPath, path);
                short[] pcm = readAudioFile(audioFile.getAbsolutePath());
                eagleProfiler.enroll(pcm);
            }

            profile = eagleProfiler.export();
        }

        @After
        public void tearDown() {
            if (eagleProfiler != null) {
                eagleProfiler.delete();
            }
        }

        @Test
        public void testInitProfilerFailWithInvalidAccessKey() {
            boolean didFail = false;
            try {
                new EagleProfiler.Builder()
                        .setAccessKey("")
                        .setModelPath(defaultModelPath)
                        .build(appContext);
            } catch (EagleException e) {
                didFail = true;
            }

            assertTrue(didFail);
        }

        @Test
        public void testInitProfilerFailWithMissingAccessKey() {
            boolean didFail = false;
            try {
                new EagleProfiler.Builder()
                        .setModelPath(defaultModelPath)
                        .build(appContext);
            } catch (EagleException e) {
                didFail = true;
            }

            assertTrue(didFail);
        }

        @Test
        public void testInitProfilerFailWithInvalidModelPath() {
            boolean didFail = false;
            File modelPath = new File(testResourcesPath, "bad_path/bad_path.pv");
            try {
                new EagleProfiler.Builder()
                        .setAccessKey(accessKey)
                        .setModelPath(modelPath.getAbsolutePath())
                        .build(appContext);
            } catch (EagleException e) {
                didFail = true;
            }

            assertTrue(didFail);
        }

        @Test
        public void testInitFailWithInvalidAccessKey() {
            boolean didFail = false;
            try {
                new Eagle.Builder()
                        .setAccessKey("")
                        .setModelPath(defaultModelPath)
                        .setSpeakerProfile(profile)
                        .build(appContext);
            } catch (EagleException e) {
                didFail = true;
            }

            assertTrue(didFail);
        }

        @Test
        public void testInitFailWithMissingAccessKey() {
            boolean didFail = false;
            try {
                new Eagle.Builder()
                        .setModelPath(defaultModelPath)
                        .setSpeakerProfile(profile)
                        .build(appContext);
            } catch (EagleException e) {
                didFail = true;
            }

            assertTrue(didFail);
        }

        @Test
        public void testInitFailWithInvalidModelPath() {
            boolean didFail = false;
            File modelPath = new File(testResourcesPath, "bad_path/bad_path.pv");
            try {
                new Eagle.Builder()
                        .setAccessKey(accessKey)
                        .setModelPath(modelPath.getAbsolutePath())
                        .setSpeakerProfile(profile)
                        .build(appContext);
            } catch (EagleException e) {
                didFail = true;
            }

            assertTrue(didFail);
        }

        @Test
        public void testInitFailWithMissingSpeakerProfile() {
            boolean didFail = false;
            try {
                new Eagle.Builder()
                        .setAccessKey(accessKey)
                        .build(appContext);
            } catch (EagleException e) {
                didFail = true;
            }

            assertTrue(didFail);
        }

        @Test
        public void getVersion() throws EagleException {
            Eagle eagle = new Eagle.Builder()
                    .setAccessKey(accessKey)
                    .setSpeakerProfile(profile)
                    .build(appContext);

            assertTrue(eagle.getVersion() != null && !eagle.getVersion().equals(""));

            eagle.delete();
        }

        @Test
        public void getSampleRate() throws EagleException {
            Eagle eagle = new Eagle.Builder()
                    .setAccessKey(accessKey)
                    .setSpeakerProfile(profile)
                    .build(appContext);

            assertTrue(eagle.getSampleRate() > 0);

            eagle.delete();
        }

        @Test
        public void testEagleProcess() throws Exception {
            Eagle eagle = new Eagle.Builder()
                    .setAccessKey(accessKey)
                    .setSpeakerProfile(profile)
                    .build(appContext);

            File audioFile = new File(testResourcesPath, testPath);
            short[] pcm = readAudioFile(audioFile.getAbsolutePath());
            int numFrames = pcm.length / eagle.getFrameLength();
            List<Float> scores = new ArrayList<>();
            for (int i = 0; i < numFrames; i++) {
                float[] score = eagle.process(Arrays.copyOfRange(
                        pcm,
                        i * eagle.getFrameLength(), (i + 1) * eagle.getFrameLength())
                );
                scores.add(score[0]);
            }

            assertTrue(Collections.max(scores) > 0.5);
            eagle.delete();
        }

        @Test
        public void testEagleProcessImposter() throws Exception {
            Eagle eagle = new Eagle.Builder()
                    .setAccessKey(accessKey)
                    .setSpeakerProfile(profile)
                    .build(appContext);

            File audioFile = new File(testResourcesPath, imposterPath);
            short[] pcm = readAudioFile(audioFile.getAbsolutePath());
            int numFrames = pcm.length / eagle.getFrameLength();
            List<Float> scores = new ArrayList<>();
            for (int i = 0; i < numFrames; i++) {
                float[] score = eagle.process(Arrays.copyOfRange(
                        pcm,
                        i * eagle.getFrameLength(), (i + 1) * eagle.getFrameLength())
                );
                scores.add(score[0]);
            }

            assertTrue(Collections.max(scores) < 0.5);
            eagle.delete();
        }

        @Test
        public void testErrorStack() {
            String[] error = {};
            try {
                new Eagle.Builder()
                        .setAccessKey("invalid")
                        .setSpeakerProfile(profile)
                        .build(appContext);
            } catch (EagleException e) {
                error = e.getMessageStack();
            }

            assertTrue(0 < error.length);
            assertTrue(error.length <= 8);

            try {
                new Eagle.Builder()
                        .setAccessKey("invalid")
                        .setSpeakerProfile(profile)
                        .build(appContext);
            } catch (EagleException e) {
                for (int i = 0; i < error.length; i++) {
                    assertEquals(e.getMessageStack()[i], error[i]);
                }
            }
        }
    }
}
