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

class EagleProfilerNative {

    static native int getSampleRate();

    static native String getVersion();

    static native long init(
            String accessKey,
            String modelPath) throws EagleException;

    static native void delete(long object);

    static native EagleProfilerEnrollResult enroll(
            long handle,
            short[] pcm,
            int numSamples) throws EagleException;

    static native EagleProfileNative export(long handle) throws EagleException;

    static native void reset(long handle) throws EagleException;

    static native int minEnrollSamples(long handle) throws EagleException;

}
