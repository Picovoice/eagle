//
//  Copyright 2023-2024 Picovoice Inc.
//  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
//  file accompanying this source.
//  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
//  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
//  specific language governing permissions and limitations under the License.
//

import XCTest

import Eagle

class EagleAppTestUITests: BaseTest {
    private func enrollUrls() -> [URL] {
        let bundle = Bundle(for: type(of: self))
        return [
            bundle.url(forResource: "speaker_1_utt_1", withExtension: "wav", subdirectory: "audio_samples")!,
            bundle.url(forResource: "speaker_1_utt_2", withExtension: "wav", subdirectory: "audio_samples")!
        ]
    }

    private func imposterUrl() -> URL {
        let bundle = Bundle(for: type(of: self))
        return bundle.url(forResource: "speaker_2_test_utt", withExtension: "wav", subdirectory: "audio_samples")!
    }

    private func testUrl() -> URL {
        let bundle = Bundle(for: type(of: self))
        return bundle.url(forResource: "speaker_1_test_utt", withExtension: "wav", subdirectory: "audio_samples")!
    }

    private func initEagle() throws -> Eagle {
        let enrollUrls = enrollUrls()

        let eagleProfiler = try EagleProfiler(accessKey: accessKey)
        for url in enrollUrls {
            let pcm = try readPcmFromFile(testAudioURL: url)
            (_, _) = try eagleProfiler.enroll(pcm: pcm)
        }

        let profile = try eagleProfiler.export()
        eagleProfiler.delete()

        return try Eagle(accessKey: accessKey, speakerProfiles: [profile])
    }

    func testEagleEnrollment() throws {
        let enrollUrls = enrollUrls()

        var percentage: Float = 0.0
        var feedback: EagleProfilerEnrollFeedback?

        let eagleProfiler = try EagleProfiler(accessKey: accessKey)
        for url in enrollUrls {
            let pcm = try readPcmFromFile(testAudioURL: url)
            (percentage, feedback) = try eagleProfiler.enroll(pcm: pcm)
            XCTAssertEqual(feedback, EagleProfilerEnrollFeedback.AUDIO_OK)
        }
        XCTAssert(percentage > 0)
        let profile = try eagleProfiler.export()
        XCTAssertFalse(profile.getBytes().isEmpty)

        eagleProfiler.delete()
    }

    func testEagleProcess() throws {
        let testUrl = testUrl()

        let eagle = try initEagle()
        let pcm = try readPcmFromFile(testAudioURL: testUrl)
        let numFrames = pcm.count / Eagle.frameLength

        var scores: [Float] = []
        for i in 0..<numFrames {
            let start = i * Eagle.frameLength
            let end = start + Eagle.frameLength

            let score = try eagle.process(pcm: Array(pcm[start..<end]))
            scores.append(score.first!)
        }

        XCTAssertGreaterThan(scores.max()!, 0.5)
        eagle.delete()
    }

    func testEagleProcessImposter() throws {
        let imposterUrl = imposterUrl()

        let eagle = try initEagle()
        let pcm = try readPcmFromFile(testAudioURL: imposterUrl)
        let numFrames = pcm.count / Eagle.frameLength

        var scores: [Float] = []
        for i in 0..<numFrames {
            let start = i * Eagle.frameLength
            let end = start + Eagle.frameLength

            let score = try eagle.process(pcm: Array(pcm[start..<end]))
            scores.append(score.first!)
        }

        XCTAssertLessThan(scores.max()!, 0.5)
        eagle.delete()
    }

    func testMessageStack() throws {
        let enrollUrls = enrollUrls()

        let eagleProfiler = try EagleProfiler(accessKey: accessKey)
        for url in enrollUrls {
            let pcm = try readPcmFromFile(testAudioURL: url)
            (_, _) = try eagleProfiler.enroll(pcm: pcm)
        }

        let profile = try eagleProfiler.export()
        eagleProfiler.delete()

        var first_error: String = ""
        do {
            let eagle = try Eagle(accessKey: "invalid", speakerProfiles: [profile])
            XCTAssertNil(eagle)
        } catch {
            first_error = "\(error.localizedDescription)"
            XCTAssert(first_error.count < 1024)
        }

        do {
            let eagle = try Eagle(accessKey: "invalid", speakerProfiles: [profile])
            XCTAssertNil(eagle)
        } catch {
            XCTAssert("\(error.localizedDescription)".count == first_error.count)
        }
    }

    func testEnrollExportMessageStack() throws {
        let e = try EagleProfiler.init(accessKey: accessKey)
        e.delete()

        var testPcm: [Int16] = []
        testPcm.reserveCapacity(Int(Eagle.frameLength))

        do {
            let (res, _) = try e.enroll(pcm: testPcm)
            XCTAssert(res == -1)
        } catch {
            XCTAssert("\(error.localizedDescription)".count > 0)
            XCTAssert("\(error.localizedDescription)".count < 1024)
        }

        do {
            let res = try e.export()
            XCTAssertNil(res)
        } catch {
            XCTAssert("\(error.localizedDescription)".count > 0)
            XCTAssert("\(error.localizedDescription)".count < 1024)
        }
    }

    func testProcessMessageStack() throws {
        let enrollUrls = enrollUrls()

        let eagleProfiler = try EagleProfiler(accessKey: accessKey)
        for url in enrollUrls {
            let pcm = try readPcmFromFile(testAudioURL: url)
            (_, _) = try eagleProfiler.enroll(pcm: pcm)
        }

        let profile = try eagleProfiler.export()
        eagleProfiler.delete()

        let e = try Eagle.init(accessKey: accessKey, speakerProfiles: [profile])
        e.delete()

        var testPcm: [Int16] = []
        testPcm.reserveCapacity(Int(Eagle.frameLength))

        do {
            let res = try e.process(pcm: testPcm)
            XCTAssert(res.count == -1)
        } catch {
            XCTAssert("\(error.localizedDescription)".count > 0)
            XCTAssert("\(error.localizedDescription)".count < 1024)
        }
    }
}
