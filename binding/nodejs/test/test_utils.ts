//
// Copyright 2024 Picovoice Inc.
//
// You may not use this file except in compliance with the license. A copy of the license is located in the "LICENSE"
// file accompanying this source.
//
// Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
// an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//
import * as path from 'path';
import * as fs from 'fs';
import { WaveFile } from 'wavefile';

const ROOT_DIR = path.join(__dirname, '../../..');

function getAudioFile(audioFile: string): string {
  return path.join(ROOT_DIR, 'resources/audio_samples', audioFile);
}

export const loadPcm = (audioFile: string): Int16Array => {
  const waveFilePath = getAudioFile(audioFile);
  const waveBuffer = fs.readFileSync(waveFilePath);
  const waveAudioFile = new WaveFile(waveBuffer);

  const pcm: any = waveAudioFile.getSamples(false, Int16Array);
  return pcm;
};

export function getModelPath(): string {
  return path.join(
    ROOT_DIR,
    `lib/common/eagle_params.pv`
  );
}
