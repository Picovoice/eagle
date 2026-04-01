//
//  Copyright 2023-2026 Picovoice Inc.
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
        return bundle.url(
            forResource: "speaker_2_test_utt",
            withExtension: "wav",
            subdirectory: "audio_samples")!
    }

    private func testUrl() -> URL {
        let bundle = Bundle(for: type(of: self))
        return bundle.url(
            forResource: "speaker_1_test_utt",
            withExtension: "wav",
            subdirectory: "audio_samples")!
    }

    private func initEagle() throws -> Eagle {
        return try Eagle(
            accessKey: accessKey,
            device: device
        )
    }

    func testEagleEnrollment() throws {
        let enrollUrls = enrollUrls()

        var percentage: Float = 0.0

        let eagleProfiler = try EagleProfiler(accessKey: accessKey, device: device)
        for url in enrollUrls {
            let pcm = try readPcmFromFile(testAudioURL: url)
            let numFrames = pcm.count / EagleProfiler.frameLength

            for i in 0..<numFrames {
                let start = i * EagleProfiler.frameLength
                let end = start + EagleProfiler.frameLength

                percentage = try eagleProfiler.enroll(pcm: Array(pcm[start..<end]))
            }

            percentage = try eagleProfiler.flush()
        }
        XCTAssert(percentage > 0)
        let profile = try eagleProfiler.export()
        XCTAssertFalse(profile.getBytes().isEmpty)

        eagleProfiler.delete()
    }

    func testEagleProcess() throws {
        let enrollUrls = enrollUrls()

        let eagleProfiler = try EagleProfiler(
            accessKey: accessKey,
            device: device)

        for url in enrollUrls {
            let pcm = try readPcmFromFile(testAudioURL: url)
            let numFrames = pcm.count / EagleProfiler.frameLength

            for i in 0..<numFrames {
                let start = i * EagleProfiler.frameLength
                let end = start + EagleProfiler.frameLength

                _ = try eagleProfiler.enroll(pcm: Array(pcm[start..<end]))
            }
            
            _ = try eagleProfiler.flush();
        }

        let profile = try eagleProfiler.export()
        eagleProfiler.delete()

        let testUrl = testUrl()

        let eagle = try initEagle()
        let pcm = try readPcmFromFile(testAudioURL: testUrl)

        let scores: [Float]? = try eagle.process(
            pcm: pcm,
            speakerProfiles: [profile])

        XCTAssertNotNil(scores)
        XCTAssertGreaterThan(scores![0], 0.5)
        eagle.delete()
    }

    func testEagleProcessImposter() throws {
        let enrollUrls = enrollUrls()

        let eagleProfiler = try EagleProfiler(
            accessKey: accessKey,
            device: device)

        for url in enrollUrls {
            let pcm = try readPcmFromFile(testAudioURL: url)
            let numFrames = pcm.count / EagleProfiler.frameLength

            for i in 0..<numFrames {
                let start = i * EagleProfiler.frameLength
                let end = start + EagleProfiler.frameLength

                _ = try eagleProfiler.enroll(pcm: Array(pcm[start..<end]))
            }
            
            _ = try eagleProfiler.flush();
        }

        let profile = try eagleProfiler.export()
        eagleProfiler.delete()

        let imposterUrl = imposterUrl()

        let eagle = try initEagle()
        let pcm = try readPcmFromFile(testAudioURL: imposterUrl)

        let scores: [Float]? = try eagle.process(
            pcm: pcm,
            speakerProfiles: [profile])

        XCTAssertNotNil(scores)
        XCTAssertLessThan(scores![0], 0.5)
        eagle.delete()
    }

    func testGetAvailableDevices() throws {
        let devices = try Eagle.getAvailableDevices()
        XCTAssert(!devices.isEmpty)
        for device in devices {
            XCTAssert(!device.isEmpty)
        }
    }

    func testMessageStack() throws {
        var first_error: String = ""
        do {
            let eagle = try Eagle(accessKey: "invalid", device: device)
            XCTAssertNil(eagle)
        } catch {
            first_error = "\(error.localizedDescription)"
            XCTAssert(first_error.count < 1024)
        }

        do {
            let eagle = try Eagle(accessKey: "invalid", device: device)
            XCTAssertNil(eagle)
        } catch {
            XCTAssert("\(error.localizedDescription)".count == first_error.count)
        }
    }

    func testEnrollExportMessageStack() throws {
        let e = try EagleProfiler.init(accessKey: accessKey, device: device)
        e.delete()

        var testPcm: [Int16] = []
        testPcm.reserveCapacity(Int(EagleProfiler.frameLength))

        do {
            let res = try e.enroll(pcm: testPcm)
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

        let eagleProfiler = try EagleProfiler(
            accessKey: accessKey,
            device: device)

        for url in enrollUrls {
            let pcm = try readPcmFromFile(testAudioURL: url)
            let numFrames = pcm.count / EagleProfiler.frameLength

            for i in 0..<numFrames {
                let start = i * EagleProfiler.frameLength
                let end = start + EagleProfiler.frameLength

                _ = try eagleProfiler.enroll(pcm: Array(pcm[start..<end]))
            }
            
            _ = try eagleProfiler.flush();
        }

        let profile = try eagleProfiler.export()
        eagleProfiler.delete()

        let e = try Eagle.init(accessKey: accessKey, device: device)

        var testPcm: [Int16] = []
        testPcm.reserveCapacity(Int(try e.minProcessSamples()))

        e.delete()

        do {
            let res = try e.process(pcm: testPcm, speakerProfiles: [profile])
            XCTAssertNotNil(res)
            XCTAssert(res!.count == -1)
        } catch {
            XCTAssert("\(error.localizedDescription)".count > 0)
            XCTAssert("\(error.localizedDescription)".count < 1024)
        }
    }
}
