if [ ! -d "./eagle-demo-app/src/androidTest/assets/test_resources/audio_samples" ]
then
    echo "Creating test audio samples directory..."
    mkdir -p ./eagle-demo-app/src/androidTest/assets/test_resources/audio_samples
fi

echo "Copying test audio samples..."
cp ../../../resources/audio_samples/*.wav ./eagle-demo-app/src/androidTest/assets/test_resources/audio_samples

if [ ! -d "./eagle-demo-app/src/androidTest/assets/test_resources/model_files" ]
then
    echo "Creating test model files directory..."
    mkdir -p ./eagle-demo-app/src/androidTest/assets/test_resources/model_files
fi

echo "Copying eagle model files ..."
cp ../../../lib/common/*.pv ./eagle-demo-app/src/androidTest/assets/test_resources/model_files
