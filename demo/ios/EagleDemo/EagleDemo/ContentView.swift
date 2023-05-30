//
//  Copyright 2023 Picovoice Inc.
//  You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
//  file accompanying this source.
//  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
//  an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
//  specific language governing permissions and limitations under the License.
//
import SwiftUI

struct ContentView: View {
    @StateObject var viewModel = ViewModel()

    let activeBlue = Color(red: 55/255, green: 125/255, blue: 1, opacity: 1)
    let detectionBlue = Color(red: 0, green: 229/255, blue: 195/255, opacity: 1)
    let dangerRed = Color(red: 1, green: 14/255, blue: 14/255, opacity: 1)

    func speakerRow(speakerName: String, score: Float) -> some View {
        return HStack {
            Text(speakerName)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(3)
            ProgressView(value: score)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(3)
        }
        .padding(3)
    }

    var body: some View {
        VStack(alignment: .center) {
            Spacer()

            HStack(alignment: .center) {
                Text("Eagle Demo")
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .font(.title)
                Button("Reset") {
                    viewModel.reset()
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .padding(12)
            .frame(maxWidth: .infinity)

            Spacer()

            VStack(alignment: .center) {
                HStack(alignment: .center) {
                    Text("Speaker Name")
                        .padding(3)
                        .font(.headline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("Score")
                        .padding(3)
                        .font(.headline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxWidth: .infinity)

                ScrollView {
                    VStack(alignment: .center) {
                        ForEach(Array(viewModel.scores.enumerated()), id: \.offset) { index, score in
                            speakerRow(speakerName: String(format: "Speaker %d", index),
                                       score: viewModel.state == UIState.ENROLLING ? 1.0 : score)
                        }
                        if viewModel.state == UIState.ENROLLING {
                            speakerRow(speakerName: "New Speaker", score: viewModel.enrollPercentage / 100.0)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(6)

            Spacer()

            VStack(alignment: .center) {
                Text(viewModel.statusText)
                Text(viewModel.errorMessage)
                if viewModel.state == UIState.ENROLLING {
                    Text(viewModel.enrollFeedback)
                }
            }

            Spacer()

            HStack(alignment: .center) {
                Button(
                    action: {
                        try? viewModel.enroll()
                    },
                    label: {
                        if viewModel.state == UIState.ENROLLING {
                            ProgressView()
                        } else {
                            Text("Enroll")
                        }
                    }
                )
                .disabled(viewModel.state != UIState.INTRO)
                .padding()

                Button(
                    action: {
                        if viewModel.state == UIState.TESTING {
                            viewModel.stopTest()
                        } else {
                            try? viewModel.test()
                        }
                    },
                    label: {
                        if viewModel.state == UIState.TESTING {
                            Text("Stop")
                        } else {
                            Text("Test")
                        }
                    }
                )
                .disabled(viewModel.state == UIState.ENROLLING || viewModel.scores.count == 0)
                .padding()
            }
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            ContentView()
        }
    }
}
