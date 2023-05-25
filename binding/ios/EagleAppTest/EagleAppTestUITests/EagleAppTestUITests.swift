//
//  Copyright 2023 Picovoice Inc.
//  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
//  file accompanying this source.
//  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
//  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
//  specific language governing permissions and limitations under the License.
//

import XCTest

import Eagle

class EagleAppTestUITests: BaseTest {

    private func getEnrollUrls() -> [URL] {
        let bundle = Bundle(for: type(of: self))
        return [
            bundle.url(forResource: "speaker_1_utt_1", withExtension: "wav", subdirectory: "audio_samples")!,
            bundle.url(forResource: "speaker_1_utt_2", withExtension: "wav", subdirectory: "audio_samples")!,
        ]
    }
    
    func testEagleEnrollment() throws {
        let enrollUrls = getEnrollUrls()
        
        var percentage: Float = 0.0
        
        let eagleProfiler = try EagleProfiler(accessKey: accessKey)
        for url in enrollUrls {
            let pcm = try readPcmFromFile(testAudioURL: url)
            (percentage, _) = try eagleProfiler.enroll(pcm: pcm)
        }
        XCTAssert(percentage > 0)
        let profile = try eagleProfiler.export()
        XCTAssertFalse(profile.getBytes().isEmpty)
        
        eagleProfiler.delete()
    }
}
