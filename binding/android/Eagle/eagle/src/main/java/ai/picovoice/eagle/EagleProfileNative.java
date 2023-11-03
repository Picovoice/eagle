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

class EagleProfileNative {

    final long handle;
    final int numBytes;

    public EagleProfileNative(long handle, int numBytes) {
        this.handle = handle;
        this.numBytes = numBytes;
    }

    public EagleProfileNative(byte[] profileBytes) {
        this.handle = setBytesNative(profileBytes, profileBytes.length);
        this.numBytes = profileBytes.length;
    }

    public byte[] getBytes() {
        return getBytesNative(this.handle, this.numBytes);
    }

    public void delete() {
        deleteNative(this.handle);
    }

    private native void deleteNative(long handle);

    private native byte[] getBytesNative(long handle, int numBytes);

    private native long setBytesNative(byte[] profileBytes, int numBytes);
}
