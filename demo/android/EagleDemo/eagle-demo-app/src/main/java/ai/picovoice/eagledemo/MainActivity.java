/*
    Copyright 2026 Picovoice Inc.

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
import android.os.Bundle;
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

import ai.picovoice.android.voiceprocessor.VoiceProcessor;
import ai.picovoice.android.voiceprocessor.VoiceProcessorException;
import ai.picovoice.eagle.Eagle;
import ai.picovoice.eagle.EagleActivationException;
import ai.picovoice.eagle.EagleActivationLimitException;
import ai.picovoice.eagle.EagleActivationRefusedException;
import ai.picovoice.eagle.EagleActivationThrottledException;
import ai.picovoice.eagle.EagleException;
import ai.picovoice.eagle.EagleInvalidArgumentException;
import ai.picovoice.eagle.EagleProfile;
import ai.picovoice.eagle.EagleProfiler;

public class MainActivity extends AppCompatActivity {
    private static final String ACCESS_KEY = "${YOUR_ACCESS_KEY_HERE}";

    private final VoiceProcessor voiceProcessor = VoiceProcessor.getInstance();
    private final List<Integer> progressBarIds = new ArrayList<>();
    private final ArrayList<Short> processPcm = new ArrayList<>();
    private final List<EagleProfile> profiles = new ArrayList<>();
    private final boolean enableDump = false;
    private Eagle eagle = null;
    private EagleProfiler eagleProfiler = null;
    private float[] smoothScores;
    private AudioDump eagleDump;

    @SuppressLint("SetTextI18n")
    private void setUIState(UIState state) {

        runOnUiThread(() -> {
            TextView errorText = findViewById(R.id.errorTextView);
            TextView recordingTextView = findViewById(R.id.recordingTextView);
            ToggleButton enrollButton = findViewById(R.id.enrollButton);
            ProgressBar enrollProgress = findViewById(R.id.enrollProgress);
            ToggleButton testButton = findViewById(R.id.testButton);

            switch (state) {
                case IDLE:
                    if (profiles.isEmpty()) {
                        recordingTextView.setText("Enroll a speaker to start testing Eagle");
                    } else {
                        recordingTextView.setText(
                                "- Press 'ENROLL' to add more speakers\n- 'TEST' to test voice recognition");

                        for (Integer id : progressBarIds) {
                            ProgressBar progressBar = findViewById(id);
                            progressBar.setProgress(100);
                        }
                    }

                    enrollButton.setEnabled(true);
                    enrollProgress.setVisibility(View.GONE);
                    testButton.setEnabled(!profiles.isEmpty());
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
                    for (Integer id : progressBarIds) {
                        ProgressBar progressBar = findViewById(id);
                        progressBar.setProgress(0);
                    }

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
            displayError(e.getMessage());
        } else if (e instanceof EagleActivationException) {
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

        voiceProcessor.addErrorListener(error -> runOnUiThread(() -> displayError(error.toString())));
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

    private void startEnrolling() {
        try {
            eagleProfiler.reset();
        } catch (EagleException e) {
            displayError("Failed to reset Eagle\n" + e.getMessage());
            return;
        }

        final int frameLength = eagleProfiler.getFrameLength();

        voiceProcessor.addFrameListener(this::enrollSpeaker);

        try {
            voiceProcessor.start(frameLength, eagleProfiler.getSampleRate());
        } catch (VoiceProcessorException e) {
            displayError("Failed to start recording\n" + e.getMessage());
        }
    }

    private void startTesting() {
        processPcm.clear();
        int minProcessSamples = eagle.getMinProcessSamples();

        voiceProcessor.addFrameListener(frame -> {
            for (short sample : frame) {
                processPcm.add(sample);
            }
            if (processPcm.size() > minProcessSamples) {
                short[] processFrame = new short[processPcm.size()];
                for (int i = 0; i < processPcm.size(); i++) {
                    processFrame[i] = processPcm.get(i);
                }
                processPcm.clear();
                if (enableDump) {
                    eagleDump.add(processFrame);
                }

                try {
                    synchronized (voiceProcessor) {
                        if (eagle == null) {
                            return;
                        }

                        EagleProfile[] e = new EagleProfile[profiles.size()];
                        for (int i = 0; i < profiles.size(); i++) {
                            e[i] = profiles.get(i);
                        }

                        float[] scores = eagle.process(processFrame, e);
                        if (scores != null) {
                            System.arraycopy(scores, 0, smoothScores, 0, profiles.size());
                        } else {
                            for (int i = 0; i < profiles.size(); i++) {
                                smoothScores[i] = 0.0f;
                            }
                        }
                    }
                    runOnUiThread(() -> {
                        if (progressBarIds.isEmpty()) {
                            return;
                        }

                        for (int i = 0; i < smoothScores.length; i++) {
                            ProgressBar progressBar = findViewById(progressBarIds.get(i));
                            progressBar.setProgress(Math.round(smoothScores[i] * 100));
                        }
                    });
                } catch (EagleException e) {
                    runOnUiThread(() -> displayError("Failed to process audio\n" + e.getMessage()));
                }
            }
        });

        try {
            voiceProcessor.start(eagle.getMinProcessSamples(), eagleProfiler.getSampleRate());
        } catch (VoiceProcessorException e) {
            displayError("Failed to start recording\n" + e.getMessage());
        }
    }

    private void stop() {
        try {
            voiceProcessor.stop();
            voiceProcessor.clearFrameListeners();
            setUIState(UIState.IDLE);
        } catch (VoiceProcessorException e) {
            displayError("Failed to stop recording\n" + e.getMessage());
        }
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
                createSpeaker();
                startEnrolling();
            } else if (testButton.isChecked()) {
                setUIState(UIState.TESTING);
                startTesting();
            }
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
            if (voiceProcessor.hasRecordAudioPermission(this)) {
                setUIState(UIState.ENROLLING);
                createSpeaker();
                startEnrolling();
            } else {
                requestRecordPermission();
            }
        } else {
            stop();
        }
    }

    @SuppressLint({"SetTextI18n", "DefaultLocale"})
    public void onTestClick(View view) {
        ToggleButton testButton = findViewById(R.id.testButton);

        if (testButton.isChecked()) {
            try {
                eagle = new Eagle.Builder()
                        .setAccessKey(ACCESS_KEY)
                        .build(getApplicationContext());

                smoothScores = new float[profiles.size()];

                if (voiceProcessor.hasRecordAudioPermission(this)) {
                    setUIState(UIState.TESTING);
                    startTesting();
                } else {
                    requestRecordPermission();
                }
            } catch (EagleException e) {
                handleEagleException(e);
            }
        } else {
            setUIState(UIState.IDLE);
            synchronized (voiceProcessor) {
                stop();
                if (enableDump) {
                    eagleDump.saveFile("eagle_test.wav");
                }
                eagle.delete();
                eagle = null;
            }
        }
    }

    public void onResetClick(View view) {
        stop();

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
    private void enrollSpeaker(short[] enrollFrame) {
        try {
            float percentage = eagleProfiler.enroll(enrollFrame);

            if (percentage == 100) {
                EagleProfile profile = eagleProfiler.export();
                eagleProfiler.reset();
                profiles.add(profile);

                runOnUiThread(() -> {
                    if (progressBarIds.isEmpty()) {
                        return;
                    }

                    ToggleButton enrollButton = findViewById(R.id.enrollButton);
                    enrollButton.performClick();
                });

                if (enableDump) {
                    eagleDump.saveFile(String.format("eagle_enroll_speaker_%d.wav", profiles.size()));
                }
            } else {
                String finalMessage = "Keep speaking until the enrollment percentage reaches 100%.";
                runOnUiThread(() -> {
                    if (progressBarIds.isEmpty()) {
                        return;
                    }

                    ProgressBar progressBar = findViewById(progressBarIds.get(progressBarIds.size() - 1));
                    progressBar.setProgress(Math.round(percentage));

                    TextView recordingTextView = findViewById(R.id.recordingTextView);
                    recordingTextView.setText(finalMessage);
                });
            }
        } catch (EagleException e) {
            runOnUiThread(() -> displayError("Failed to enroll\n" + e.getMessage()));
        }
    }

    private enum UIState {
        IDLE,
        ENROLLING,
        INITIALIZING,
        TESTING,
        ERROR
    }
}
