//
//  Copyright 2023 Picovoice Inc.
//  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
//  file accompanying this source.
//  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
//  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
//  specific language governing permissions and limitations under the License.
//

import Foundation
import XCTest

import Eagle

class PerformanceTest: XCTestCase {
    let accessKey: String = "{TESTING_ACCESS_KEY_HERE}"
    let iterationString: String = "{NUM_TEST_ITERATIONS}"
    let indexThresholdString: String = "{INDEX_PERFORMANCE_THRESHOLD_SEC}"
    let searchThresholdString: String = "{SEARCH_PERFORMANCE_THRESHOLD_SEC}"

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
    }

    func testProfilerPerformance() throws {
        try XCTSkipIf(indexThresholdString == "{ENROLL_PERFORMANCE_THRESHOLD_SEC}")

        let numTestIterations = Int(iterationString) ?? 30
        let indexPerformanceThresholdSec = Double(indexThresholdString)
        try XCTSkipIf(indexPerformanceThresholdSec == nil)

        let bundle = Bundle(for: type(of: self))
        let fileURL: URL = bundle.url(forResource: "test", withExtension: "wav")!
        let audioData = try Data(contentsOf: fileURL)
        var pcm = [Int16](repeating: 0, count: (audioData.count - 44) / 2)
        _ = pcm.withUnsafeMutableBytes {
            audioData.copyBytes(to: $0, from: 44..<audioData.count)
        }

        let eagleProfiler = try EagleProfiler(accessKey: accessKey)

        var results: [Double] = []
        for _ in 0...numTestIterations {
            var totalNSec = 0.0

            let before = CFAbsoluteTimeGetCurrent()
            (_, _) = try eagleProfiler.enroll(pcm: pcm)
            let after = CFAbsoluteTimeGetCurrent()
            totalNSec += (after - before)
            results.append(totalNSec)
        }
        eagleProfiler.delete()

        let avgNSec = results.reduce(0.0, +) / Double(numTestIterations)
        let avgSec = Double(round(avgNSec * 1000) / 1000)
        XCTAssertLessThanOrEqual(avgSec, indexPerformanceThresholdSec!)
    }

    func testProcPerformance() throws {
        try XCTSkipIf(searchThresholdString == "{PROC_PERFORMANCE_THRESHOLD_SEC}")

        let numTestIterations = Int(iterationString) ?? 30
        let searchPerformanceThresholdSec = Double(searchThresholdString)
        try XCTSkipIf(searchPerformanceThresholdSec == nil)

        let bundle = Bundle(for: type(of: self))

        let enrollUrls: [URL] = [
            bundle.url(forResource: "speaker_1_utt_1", withExtension: "wav")!,
            bundle.url(forResource: "speaker_1_utt_2", withExtension: "wav")!
        ]
        let eagleProfiler = try EagleProfiler(accessKey: accessKey)
        for enrollUrl in enrollUrls {
            let audioData = try Data(contentsOf: enrollUrl)
            var pcm = [Int16](repeating: 0, count: (audioData.count - 44) / 2)
            _ = pcm.withUnsafeMutableBytes {
                audioData.copyBytes(to: $0, from: 44..<audioData.count)
            }

            (_, _) = try eagleProfiler.enroll(pcm: pcm)
        }
        let profile = try eagleProfiler.export()
        eagleProfiler.delete()

        let testAudioURL: URL = bundle.url(forResource: "test", withExtension: "wav")!
        let audioData = try Data(contentsOf: testAudioURL)
        var pcm = [Int16](repeating: 0, count: (audioData.count - 44) / 2)
        _ = pcm.withUnsafeMutableBytes {
            audioData.copyBytes(to: $0, from: 44..<audioData.count)
        }

        let eagle = try Eagle(accessKey: accessKey, speakerProfiles: [profile])

        var results: [Double] = []
        for _ in 0...numTestIterations {
            var totalNSec = 0.0

            let before = CFAbsoluteTimeGetCurrent()
            _ = try eagle.process(pcm: pcm)
            let after = CFAbsoluteTimeGetCurrent()
            totalNSec += (after - before)
            results.append(totalNSec)
        }
        eagle.delete()

        let avgNSec = results.reduce(0.0, +) / Double(numTestIterations)
        let avgSec = Double(round(avgNSec * 1000) / 1000)
        XCTAssertLessThanOrEqual(avgSec, searchPerformanceThresholdSec!)
    }
}
