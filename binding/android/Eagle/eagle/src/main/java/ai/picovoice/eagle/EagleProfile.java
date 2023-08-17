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
 * Representation of an Eagle speaker profile.
 */
public class EagleProfile {

    static {
        System.loadLibrary("pv_eagle");
    }

    final EagleProfileNative profileNative;

    EagleProfile(EagleProfileNative profileNative) {
        this.profileNative = profileNative;
    }

    /**
     * Constructor.
     *
     * @param profileBytes a byte array previously obtained via {@link #getBytes()}.
     */
    public EagleProfile(byte[] profileBytes) {
        profileNative = new EagleProfileNative(profileBytes);
    }

    /**
     * Gets the speaker profile in the form of a byte array.
     *
     * @return the speaker profile in the form of a byte array.
     */
    public byte[] getBytes() {
        return profileNative.getBytes();
    }

    /**
     * Releases resources acquired by EagleProfile.
     */
    public void delete() {
        profileNative.delete();
    }
}
