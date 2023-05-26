/*
    Copyright 2023 Picovoice Inc.

    You may not use this file except in compliance with the license. A copy of the license is
    located in the "LICENSE" file accompanying this source.

    Unless required by applicable law or agreed to in writing, software distributed under the
    License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
    express or implied. See the License for the specific language governing permissions and
    limitations under the License.
*/

package ai.picovoice.eagledemo;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.PorterDuff;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Bundle;
import android.os.Process;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TableLayout;
import android.widget.TableRow;
import android.widget.TextView;
import android.widget.ToggleButton;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.core.app.ActivityCompat;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import ai.picovoice.eagle.*;

public class MainActivity extends AppCompatActivity {
    private static final String ACCESS_KEY = "${YOUR_ACCESS_KEY_HERE}";

    private final MicrophoneReader microphoneReader = new MicrophoneReader();

    private final List<Integer> progressBarIds = new ArrayList<>();

    private UIState currentState;
    private Eagle eagle = null;
    private EagleProfiler eagleProfiler;
    private final List<EagleProfile> profiles = new ArrayList<>();

    private float[] smoothScores;

    private final boolean enableDump = false;
    private AudioDump eagleDump;

    private void setUIState(UIState state) {
        currentState = state;

        runOnUiThread(() -> {
            TextView errorText = findViewById(R.id.errorTextView);
            TextView recordingTextView = findViewById(R.id.recordingTextView);
            ToggleButton enrollButton = findViewById(R.id.enrollButton);
            ProgressBar enrollProgress = findViewById(R.id.enrollProgress);
            ToggleButton testButton = findViewById(R.id.testButton);

            switch (state) {
                case IDLE:
                    if (profiles.size() == 0) {
                        recordingTextView.setText("Enroll a speaker to start testing Eagle");
                    } else {
                        recordingTextView.setText(
                                "- Press 'ENROLL' to add more speakers\n- 'TEST' to test voice recognition");
                    }
                    enrollButton.setEnabled(true);
                    enrollProgress.setVisibility(View.GONE);
                    testButton.setEnabled(profiles.size() > 0);
                    break;
                case ENROLLING:
                    errorText.setVisibility(View.INVISIBLE);
                    recordingTextView.setText("Start speaking to enroll speaker...");
                    enrollButton.setEnabled(false);
                    enrollProgress.setVisibility(View.VISIBLE);
                    testButton.setEnabled(false);
                    break;
                case INITIALIZING:
                    errorText.setVisibility(View.INVISIBLE);
                    recordingTextView.setText("Initializing Eagle with current speakers...");
                    enrollButton.setEnabled(false);
                    testButton.setEnabled(false);
                    break;
                case TESTING:
                    errorText.setVisibility(View.INVISIBLE);
                    recordingTextView.setText("Identifying speaker...");
                    enrollButton.setEnabled(false);
                    testButton.setEnabled(true);
                    break;
                case ERROR:
                    enrollButton.setEnabled(false);
                    testButton.setChecked(false);
                    break;
                default:
                    break;
            }
        });
    }

    private void handleEagleException(EagleException e) {
        if (e instanceof EagleInvalidArgumentException) {
            displayError(String.format("%s\nEnsure your AccessKey '%s' is valid", e.getMessage(), ACCESS_KEY));
        } else if  (e instanceof EagleActivationException) {
            displayError("AccessKey activation error");
        } else if (e instanceof EagleActivationLimitException) {
            displayError("AccessKey reached its device limit");
        } else if (e instanceof EagleActivationRefusedException) {
            displayError("AccessKey refused");
        } else if (e instanceof EagleActivationThrottledException) {
            displayError("AccessKey has been throttled");
        } else {
            displayError("Failed to initialize Eagle " + e.getMessage());
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.eagle_demo);

        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setTitleTextColor(Color.WHITE);
        setSupportActionBar(toolbar);

        eagleDump = new AudioDump(getApplicationContext(), "eagle_demo.wav");

        try {
            EagleProfiler.Builder builder = new EagleProfiler.Builder()
                    .setAccessKey(ACCESS_KEY);

            eagleProfiler = builder.build(getApplicationContext());
        } catch (EagleException e) {
            handleEagleException(e);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        eagleProfiler.delete();
    }

    private void displayError(String message) {
        setUIState(UIState.ERROR);

        TextView errorText = findViewById(R.id.errorTextView);
        errorText.setText(message);
        errorText.setVisibility(View.VISIBLE);

        ToggleButton enrollButton = findViewById(R.id.enrollButton);
        enrollButton.setEnabled(false);

        ToggleButton testButton = findViewById(R.id.testButton);
        testButton.setEnabled(false);
    }

    private boolean hasRecordPermission() {
        return ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestRecordPermission() {
        ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.RECORD_AUDIO}, 0);
    }

    @SuppressLint("SetTextI18n")
    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            @NonNull String[] permissions,
            @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        ToggleButton enrollButton = findViewById(R.id.enrollButton);
        ToggleButton testButton = findViewById(R.id.testButton);

        if (grantResults.length == 0 || grantResults[0] == PackageManager.PERMISSION_DENIED) {
            if (enrollButton.isChecked()) {
                enrollButton.toggle();
            }
            if (testButton.isChecked()) {
                testButton.toggle();
            }
        } else {
            if (enrollButton.isChecked()) {
                setUIState(UIState.ENROLLING);
            } else if (testButton.isChecked()) {
                setUIState(UIState.TESTING);
            }
            microphoneReader.start();
        }
    }

    @SuppressLint({"SetTextI18n", "DefaultLocale"})
    public void onEnrollClick(View view) {
        ToggleButton enrollButton = findViewById(R.id.enrollButton);

        if (eagleProfiler == null) {
            displayError("Eagle is not initialized");
            enrollButton.setChecked(false);
            return;
        }

        if (enrollButton.isChecked()) {
            if (hasRecordPermission()) {
                setUIState(UIState.ENROLLING);
                createSpeaker();
                microphoneReader.start();
            } else {
                requestRecordPermission();
            }
        } else {
            try {
                setUIState(UIState.IDLE);
                microphoneReader.stop();
            } catch (InterruptedException e) {
                displayError("Audio stop command interrupted\n" + e);
            }
        }
    }

    @SuppressLint({"SetTextI18n", "DefaultLocale"})
    public void onTestClick(View view) {
        ToggleButton testButton = findViewById(R.id.testButton);

        if (testButton.isChecked()) {
            try {
                EagleProfile[] e = new EagleProfile[profiles.size()];
                for (int i = 0; i < profiles.size(); i++) {
                    e[i] = profiles.get(i);
                }

                eagle = new Eagle.Builder()
                        .setSpeakerProfiles(e)
                        .setAccessKey(ACCESS_KEY)
                        .build(getApplicationContext());

                smoothScores = new float[profiles.size()];

                if (hasRecordPermission()) {
                    setUIState(UIState.TESTING);
                    microphoneReader.start();
                } else {
                    requestRecordPermission();
                }
            } catch (EagleException e) {
                handleEagleException(e);
            }
        } else {
            try {
                setUIState(UIState.IDLE);
                microphoneReader.stop();
            } catch (InterruptedException e) {
                displayError("Audio stop command interrupted\n" + e);
            }

            eagle.delete();
            eagle = null;
        }
    }

    public void onResetClick(View view) {
        try {
            microphoneReader.stop();

            ToggleButton enrollButton = findViewById(R.id.enrollButton);
            if (enrollButton.isChecked()) {
                enrollButton.performClick();
            }

            ToggleButton testButton = findViewById(R.id.testButton);
            if (testButton.isChecked()) {
                testButton.performClick();
            }

            TableLayout speakerTableLayout = findViewById(R.id.speakerTableLayout);
            speakerTableLayout.removeViews(1, progressBarIds.size());

            profiles.clear();
            progressBarIds.clear();

            setUIState(UIState.IDLE);
        } catch (InterruptedException e) {
            displayError("Audio stop command interrupted\n" + e);
        }
    }

    private String getFeedback(EagleProfilerEnrollFeedback feedback) {
        switch (feedback) {
            case AUDIO_OK:
                return "Enrolling speaker..";
            case AUDIO_TOO_SHORT:
                return "Insufficient audio length";
            case UNKNOWN_SPEAKER:
                return "Different speaker in audio";
            case NO_VOICE_FOUND:
                return "Unable to detect voice in audio";
            case QUALITY_ISSUE:
                return "Audio quality too low to use for enrollment";
            default:
                return "Unrecognized feedback";
        }
    }

    @SuppressLint("DefaultLocale")
    private void createSpeaker() {
        runOnUiThread(() -> {
            int padding = (int) (5 * this.getResources().getDisplayMetrics().density);

            TableRow row = new TableRow(this);
            row.setPadding(padding, padding, padding, padding);

            TableRow.LayoutParams params = new TableRow.LayoutParams();
            params.weight = 1;

            TextView speakerText = new TextView(this);
            speakerText.setText(String.format("Speaker %d", profiles.size() + 1));
            speakerText.setTextColor(Color.WHITE);
            speakerText.setLayoutParams(params);

            ProgressBar progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
            int id = LinearLayout.generateViewId();
            progressBar.setId(id);
            progressBar.setLayoutParams(params);
            progressBar.setPadding(padding, 0, padding, 0);
            progressBar.getProgressDrawable().setColorFilter(Color.WHITE, PorterDuff.Mode.MULTIPLY);
            progressBarIds.add(id);

            row.addView(speakerText);
            row.addView(progressBar);

            TableLayout speakerTableLayout = findViewById(R.id.speakerTableLayout);
            speakerTableLayout.addView(row);
        });
    }

    @SuppressLint("DefaultLocale")
    private void enrollSpeaker(short[] pcmData) {
        try {
            EagleProfilerEnrollResult result = eagleProfiler.enroll(pcmData);

            if (result.getFeedback() == EagleProfilerEnrollFeedback.AUDIO_OK && result.getPercentage() == 100) {
                EagleProfile profile = eagleProfiler.export();
                profiles.add(profile);

                runOnUiThread(() -> {
                    if (progressBarIds.size() == 0) {
                        return;
                    }

                    ProgressBar progressBar = findViewById(progressBarIds.get(progressBarIds.size() - 1));
                    progressBar.setProgress(Math.round(result.getPercentage()));

                    ToggleButton enrollButton = findViewById(R.id.enrollButton);
                    enrollButton.performClick();
                });

                microphoneReader.stop.set(true);
            } else {
                String finalMessage = String.format(
                        "%s. Keep speaking until the enrollment percentage reaches 100%%.",
                        getFeedback(result.getFeedback()));
                runOnUiThread(() -> {
                    if (progressBarIds.size() == 0) {
                        return;
                    }

                    ProgressBar progressBar = findViewById(progressBarIds.get(progressBarIds.size() - 1));
                    progressBar.setProgress(Math.round(result.getPercentage()));

                    TextView recordingTextView = findViewById(R.id.recordingTextView);
                    recordingTextView.setText(finalMessage);
                });
            }
        } catch (EagleException e) {
            runOnUiThread(() -> displayError("Failed to enroll\n" + e));
        }
    }

    private enum UIState {
        IDLE,
        ENROLLING,
        INITIALIZING,
        TESTING,
        ERROR
    }

    private class MicrophoneReader {
        private final AtomicBoolean started = new AtomicBoolean(false);
        private final AtomicBoolean stop = new AtomicBoolean(false);
        private final AtomicBoolean stopped = new AtomicBoolean(false);

        void start() {
            if (started.get()) {
                return;
            }

            started.set(true);

            if (currentState == UIState.ENROLLING) {
                Executors.newSingleThreadExecutor().submit((Callable<Void>) () -> {
                    Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO);
                    enroll();
                    return null;
                });
            } else if (currentState == UIState.TESTING) {
                Executors.newSingleThreadExecutor().submit((Callable<Void>) () -> {
                    Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO);
                    read();
                    return null;
                });
            }
        }

        void stop() throws InterruptedException {
            if (!started.get()) {
                return;
            }

            stop.set(true);

            synchronized (stopped) {
                while (!stopped.get()) {
                    stopped.wait(500);
                }
            }

            started.set(false);
            stop.set(false);
            stopped.set(false);
        }

        @SuppressLint("DefaultLocale")
        private void enroll() throws EagleException {
            final int bufferSize = AudioRecord.getMinBufferSize(
                    eagleProfiler.getSampleRate(),
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT);

            AudioRecord audioRecord = null;

            short[] buffer = new short[bufferSize];

            eagleProfiler.reset();
            int numEnrollFrames = (eagleProfiler.getMinEnrollSamples() / bufferSize) + 1;
            short[] pcmData = new short[bufferSize * numEnrollFrames];

            try {
                audioRecord = new AudioRecord(
                        MediaRecorder.AudioSource.MIC,
                        eagleProfiler.getSampleRate(),
                        AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT,
                        bufferSize);
                audioRecord.startRecording();

                while (!stop.get()) {
                    int i = 0;
                    while (i < numEnrollFrames) {
                        if (stop.get()) {
                            break;
                        }
                        if (audioRecord.read(buffer, 0, buffer.length) == buffer.length) {
                            System.arraycopy(buffer, 0, pcmData, i * buffer.length, buffer.length);
                            if (enableDump) {
                                Executors.newSingleThreadExecutor().submit((Callable<Void>) () -> {
                                    eagleDump.add(buffer);
                                    return null;
                                });
                            }
                        }
                        i++;
                    }
                    enrollSpeaker(pcmData);
                }

                audioRecord.stop();
                if (enableDump) {
                    eagleDump.saveFile(String.format("eagle_enroll_speaker_%d.wav", profiles.size()));
                }
            } catch (IllegalArgumentException | IllegalStateException | SecurityException e) {
                throw new EagleException(e);
            } finally {
                if (audioRecord != null) {
                    audioRecord.release();
                }

                stopped.set(true);
                stopped.notifyAll();
            }
        }

        private void read() throws EagleException {
            final int minBufferSize = AudioRecord.getMinBufferSize(
                    eagle.getSampleRate(),
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT);
            final int bufferSize = Math.max(eagle.getSampleRate() / 2, minBufferSize);

            AudioRecord audioRecord = null;

            short[] buffer = new short[eagle.getFrameLength()];

            try {
                audioRecord = new AudioRecord(
                        MediaRecorder.AudioSource.MIC,
                        eagle.getSampleRate(),
                        AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT,
                        bufferSize);
                audioRecord.startRecording();


                while (!stop.get()) {
                    if (audioRecord.read(buffer, 0, buffer.length) == buffer.length) {
                        float[] scores = eagle.process(buffer);
                        for (int i = 0; i < scores.length; i++) {
                            float alpha = 0.25f;
                            smoothScores[i] = alpha * smoothScores[i] + (1 - alpha) * scores[i];
                        }
                        runOnUiThread(() -> {
                            if (progressBarIds.size() == 0) {
                                return;
                            }

                            for (int i = 0; i < smoothScores.length; i++) {
                                ProgressBar progressBar = findViewById(progressBarIds.get(i));
                                progressBar.setProgress(Math.round(smoothScores[i] * 100));
                            }
                        });
                        if (enableDump) {
                            Executors.newSingleThreadExecutor().submit((Callable<Void>) () -> {
                                eagleDump.add(buffer);
                                return null;
                            });
                        }
                    }
                }

                audioRecord.stop();
                if (enableDump) {
                    eagleDump.saveFile("eagle_test.wav");
                }
            } catch (IllegalArgumentException | IllegalStateException | SecurityException e) {
                throw new EagleException(e);
            } finally {
                if (audioRecord != null) {
                    audioRecord.release();
                }

                stopped.set(true);
                stopped.notifyAll();
            }
        }
    }
}
