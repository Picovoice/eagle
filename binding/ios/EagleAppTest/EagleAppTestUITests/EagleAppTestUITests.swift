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
    let phrases: Set<String> = ["gorilla", "terminator"]
    let expectedMatch = EagleMatch(
        startSec: 39.168,
        endSec: 40.128,
        probability: 1.0)

    func testIndexAndSearchFile() throws {
        let bundle = Bundle(for: type(of: self))
        let audioFilePath = bundle.path(forResource: "multiple_keywords", ofType: "wav")!

        let eagle = try Eagle(accessKey: accessKey)
        let metadata = try eagle.indexAudioFile(path: audioFilePath)
        let matches = try eagle.search(metadata: metadata, phrases: phrases)
        XCTAssert(matches["gorilla"]!.count == 0)
        XCTAssert(matches["terminator"]!.count == 1)

        let terminatorMatches = matches["terminator"]!
        XCTAssertEqual(terminatorMatches[0].startSec, expectedMatch.startSec, accuracy: 0.01)
        XCTAssertEqual(terminatorMatches[0].endSec, expectedMatch.endSec, accuracy: 0.01)
        XCTAssertEqual(terminatorMatches[0].probability, expectedMatch.probability, accuracy: 0.01)

        metadata.delete()
        eagle.delete()
    }

    func testIndexAndSearchData() throws {
        let bundle = Bundle(for: type(of: self))
        let fileURL:URL = bundle.url(forResource: "multiple_keywords", withExtension: "wav")!
        let audioData = try Data(contentsOf: fileURL)
        var pcm = Array<Int16>(repeating: 0, count: (audioData.count - 44) / 2)
        _ = pcm.withUnsafeMutableBytes {
            audioData.copyBytes(to: $0, from: 44..<audioData.count)
        }

        let eagle = try Eagle(accessKey: accessKey)
        let metadata = try eagle.indexAudioData(pcm: pcm)
        let matches = try eagle.search(metadata: metadata, phrases: phrases)
        XCTAssert(matches["gorilla"]!.count == 0)
        XCTAssert(matches["terminator"]!.count == 1)

        let terminatorMatches = matches["terminator"]!
        XCTAssertEqual(terminatorMatches[0].startSec, expectedMatch.startSec, accuracy: 0.01)
        XCTAssertEqual(terminatorMatches[0].endSec, expectedMatch.endSec, accuracy: 0.01)
        XCTAssertEqual(terminatorMatches[0].probability, expectedMatch.probability, accuracy: 0.01)

        metadata.delete()
        eagle.delete()
    }

    func testMetadataMarshalling() throws {
        let bundle = Bundle(for: type(of: self))
        let audioFilePath = bundle.path(forResource: "multiple_keywords", ofType: "wav")!

        let eagle = try Eagle(accessKey: accessKey)
        var metadata:EagleMetadata? = try eagle.indexAudioFile(path: audioFilePath)

        let metadataBytes = try metadata!.getBytes()
        XCTAssert(metadataBytes.count == 227360)
        metadata!.delete()
        metadata = nil
        XCTAssert(metadataBytes.count == 227360)

        metadata = EagleMetadata(metadataBytes: metadataBytes)
        let matches = try eagle.search(metadata: metadata!, phrases: phrases)
        XCTAssert(matches["gorilla"]!.count == 0)
        XCTAssert(matches["terminator"]!.count == 1)

        let terminatorMatches = matches["terminator"]!
        XCTAssertEqual(terminatorMatches[0].startSec, expectedMatch.startSec, accuracy: 0.01)
        XCTAssertEqual(terminatorMatches[0].endSec, expectedMatch.endSec, accuracy: 0.01)
        XCTAssertEqual(terminatorMatches[0].probability, expectedMatch.probability, accuracy: 0.01)

        metadata!.delete()
        eagle.delete()
    }

    func testEmptySearchPhrase() throws {
        let bundle = Bundle(for: type(of: self))
        let audioFilePath = bundle.path(forResource: "multiple_keywords", ofType: "wav")!

        let eagle = try Eagle(accessKey: accessKey)
        let metadata = try eagle.indexAudioFile(path: audioFilePath)

        let invalidPhrase: Set<String> = [""]
        var invalidArg = false
        do {
            let _ = try eagle.search(metadata: metadata, phrases: invalidPhrase)
        } catch is EagleInvalidArgumentError {
            invalidArg = true
        }

        XCTAssert(invalidArg)

        metadata.delete()
        eagle.delete()
    }

    func testWhitespaceSearchPhrase() throws {
        let bundle = Bundle(for: type(of: self))
        let audioFilePath = bundle.path(forResource: "multiple_keywords", ofType: "wav")!

        let eagle = try Eagle(accessKey: accessKey)
        let metadata = try eagle.indexAudioFile(path: audioFilePath)

        let invalidPhrase: Set<String> = ["    "]
        var invalidArg = false
        do {
            let _ = try eagle.search(metadata: metadata, phrases: invalidPhrase)
        } catch is EagleInvalidArgumentError {
            invalidArg = true
        }

        XCTAssert(invalidArg)

        metadata.delete()
        eagle.delete()
    }

    func testNumericSearchPhrase() throws {
        let bundle = Bundle(for: type(of: self))
        let audioFilePath = bundle.path(forResource: "multiple_keywords", ofType: "wav")!

        let eagle = try Eagle(accessKey: accessKey)
        let metadata = try eagle.indexAudioFile(path: audioFilePath)

        let invalidPhrase: Set<String> = ["12"]
        var invalidArg = false
        do {
            let _ = try eagle.search(metadata: metadata, phrases: invalidPhrase)
        } catch is EagleInvalidArgumentError {
            invalidArg = true
        }

        XCTAssert(invalidArg)

        metadata.delete()
        eagle.delete()
    }

    func testHyphenInSearchPhrase() throws {
        let bundle = Bundle(for: type(of: self))
        let audioFilePath = bundle.path(forResource: "multiple_keywords", ofType: "wav")!

        let eagle = try Eagle(accessKey: accessKey)
        let metadata = try eagle.indexAudioFile(path: audioFilePath)

        let invalidPhrase: Set<String> = ["real-time"]
        var invalidArg = false
        do {
            let _ = try eagle.search(metadata: metadata, phrases: invalidPhrase)
        } catch is EagleInvalidArgumentError {
            invalidArg = true
        }

        XCTAssert(invalidArg)

        metadata.delete()
        eagle.delete()
    }

    func testInvalidSearchPhrase() throws {
        let bundle = Bundle(for: type(of: self))
        let audioFilePath = bundle.path(forResource: "multiple_keywords", ofType: "wav")!

        let eagle = try Eagle(accessKey: accessKey)
        let metadata = try eagle.indexAudioFile(path: audioFilePath)

        let invalidPhrase: Set<String> = ["@@!%$"]
        var invalidArg = false
        do {
            let _ = try eagle.search(metadata: metadata, phrases: invalidPhrase)
        } catch is EagleInvalidArgumentError {
            invalidArg = true
        }

        XCTAssert(invalidArg)

        metadata.delete()
        eagle.delete()
    }

    func testSpacesInSearchPhrase() throws {
        let bundle = Bundle(for: type(of: self))
        let audioFilePath = bundle.path(forResource: "multiple_keywords", ofType: "wav")!

        let eagle = try Eagle(accessKey: accessKey)
        let metadata = try eagle.indexAudioFile(path: audioFilePath)

        let searchPhrase: Set<String> = [" americano     avocado    "]
        let normalizedSearchPhrase = "americano avocado"

        let matches = try eagle.search(metadata: metadata, phrases: searchPhrase)
        XCTAssert(matches[normalizedSearchPhrase]!.count == 1)

        let match = matches[normalizedSearchPhrase]![0]
        let expected = EagleMatch(startSec: 9.47, endSec: 12.25, probability: 0.43)
        XCTAssertEqual(match.startSec, expected.startSec, accuracy: 0.01)
        XCTAssertEqual(match.endSec, expected.endSec, accuracy: 0.01)
        XCTAssertEqual(match.probability, expected.probability, accuracy: 0.01)

        metadata.delete()
        eagle.delete()
    }
}
