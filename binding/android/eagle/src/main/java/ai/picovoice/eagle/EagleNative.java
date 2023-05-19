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

import java.util.HashMap;

class EagleNative {

    private static final HashMap<Long, Integer> numSpeakerMap = new HashMap<>();

    static native int getFrameLength();

    static native int getSampleRate();

    static native String getVersion();

    static native long init(
            String accessKey,
            String modelPath,
            int numSpeakers,
            long[] speakerProfiles) throws EagleException;

    static native void delete(long object);

    static native float[] process(long object, short[] pcm) throws EagleException;

    static native void reset(long object) throws EagleException;

    private static void addNumSpeaker(long object, int numSpeakers) {
        numSpeakerMap.put(object, numSpeakers);
    }

    private static int getNumSpeaker(long object) {
        return numSpeakerMap.get(object);
    }

    private static void removeNumSpeaker(long object) {
        numSpeakerMap.remove(object);
    }
}
