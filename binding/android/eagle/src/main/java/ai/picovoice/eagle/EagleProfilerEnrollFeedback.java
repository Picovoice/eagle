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

/**
 * Enumeration of possible enrollment feedback codes:
 * - `AUDIO_OK`: The audio is good for enrollment.
 * - `AUDIO_TOO_SHORT`: Audio length is insufficient for enrollment,
 *      i.e. it is shorter than`EagleProfiler.getMinEnrollSamples()`.
 * - `UNKNOWN_SPEAKER`: There is another speaker in the audio that is different from the speaker
 *      being enrolled. Too much background noise may cause this error as well.
 * - `NO_VOICE_FOUND`: The audio does not contain any voice, i.e. it is silent or
 *      has a low signal-to-noise ratio.
 * - `QUALITY_ISSUE`: The audio quality is too low for enrollment due to a bad microphone
 *      or recording environment.
 */
public enum EagleProfilerEnrollFeedback {
    AUDIO_OK,
    AUDIO_TOO_SHORT,
    UNKNOWN_SPEAKER,
    NO_VOICE_FOUND,
    QUALITY_ISSUE;
}
