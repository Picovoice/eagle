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
 * Representation of the feedback, given percentage and code.
 */
public class EagleProfilerEnrollFeedback {

    private final float percentage;
    private final EagleProfilerFeedback feedback;

    public EagleProfilerEnrollFeedback(float percentage, int feedbackIdx) {
        this.percentage = percentage;
        this.feedback = EagleProfilerFeedback.values()[feedbackIdx];
    }

    public float getPercentage() {
        return this.percentage;
    }

    public EagleProfilerFeedback getFeedback() {
        return this.feedback;
    }

}
