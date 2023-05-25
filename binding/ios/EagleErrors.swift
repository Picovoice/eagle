//
//  Copyright 2023 Picovoice Inc.
//  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
//  file accompanying this source.
//  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
//  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
//  specific language governing permissions and limitations under the License.
//

public class EagleError: LocalizedError {
    private let message: String

    public init (_ message: String) {
        self.message = message
    }

    public var errorDescription: String? {
        return message
    }

    public var name: String {
        get {
            return String(describing: type(of: self))
        }
    }
}

public class EagleMemoryError: EagleError {}

public class EagleIOError: EagleError {}

public class EagleInvalidArgumentError: EagleError {}

public class EagleStopIterationError: EagleError {}

public class EagleKeyError: EagleError {}

public class EagleInvalidStateError: EagleError {}

public class EagleRuntimeError: EagleError {}

public class EagleActivationError: EagleError {}

public class EagleActivationLimitError: EagleError {}

public class EagleActivationThrottledError: EagleError {}

public class EagleActivationRefusedError: EagleError {}
