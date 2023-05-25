//
//  Copyright 2023 Picovoice Inc.
//  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
//  file accompanying this source.
//  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
//  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
//  specific language governing permissions and limitations under the License.
//

import Foundation

public class EagleProfile {
    private var profileBytes: [UInt8]?

    /// Constructor.
    ///
    /// - Parameters:
    ///   - profileBytes: A byte array that was previously obtained via `getBytes`
    public init(profileBytes: [UInt8]) {
        self.profileBytes = profileBytes
    }

    /// Gets a binary representation of the speaker profile
    ///
    /// - Throws: EagleError
    /// - Returns: A byte array of the speaker profile
    public func getBytes() -> [UInt8] {
        return profileBytes!
    }

}
