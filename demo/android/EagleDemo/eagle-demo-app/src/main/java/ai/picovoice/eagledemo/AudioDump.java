package ai.picovoice.eagledemo;

import android.content.Context;
import android.os.Environment;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

public class AudioDump {
    private final File tmpFile;
    private FileOutputStream tmpStream;

    public AudioDump(Context context, String filename) {
        File tmpDir = context.getCacheDir();
        this.tmpFile = new File(tmpDir, filename);
    }

    public void add(short[] pcm) {
        try {
            if (!this.tmpFile.exists()) {
                this.tmpFile.createNewFile();
            }
            if (this.tmpStream == null) {
                this.tmpStream = new FileOutputStream(this.tmpFile, true);
            }

            byte[] bytes = new byte[pcm.length * 2];
            ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().put(pcm);

            tmpStream.write(bytes);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public void saveFile(String filename) {
        int length = (int) this.tmpFile.length();
        byte[] bytes = new byte[length];

        if (length == 0) {
            return;
        }

        try {
            this.tmpStream.close();
            this.tmpStream = null;

            FileInputStream fileInputStream = new FileInputStream(this.tmpFile);
            fileInputStream.read(bytes);
            fileInputStream.close();
            this.tmpFile.delete();

            File outputFile = new File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                    filename);
            FileOutputStream outputStream = new FileOutputStream(outputFile);
            writeWavFile(outputStream, bytes);
            outputStream.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private void writeWavFile(FileOutputStream outputStream, byte[] data) throws IOException {
        byte[] header = new byte[44];

        int sampleRate = 16000;
        int channels = 1;
        int format = 16;

        long totalDataLen = data.length + 36;
        long bitrate = sampleRate * channels * format;

        header[0] = 'R';
        header[1] = 'I';
        header[2] = 'F';
        header[3] = 'F';
        header[4] = (byte) (totalDataLen & 0xff);
        header[5] = (byte) ((totalDataLen >> 8) & 0xff);
        header[6] = (byte) ((totalDataLen >> 16) & 0xff);
        header[7] = (byte) ((totalDataLen >> 24) & 0xff);
        header[8] = 'W';
        header[9] = 'A';
        header[10] = 'V';
        header[11] = 'E';
        header[12] = 'f';
        header[13] = 'm';
        header[14] = 't';
        header[15] = ' ';
        header[16] = (byte) format;
        header[17] = 0;
        header[18] = 0;
        header[19] = 0;
        header[20] = 1;
        header[21] = 0;
        header[22] = (byte) channels;
        header[23] = 0;
        header[24] = (byte) (sampleRate & 0xff);
        header[25] = (byte) ((sampleRate >> 8) & 0xff);
        header[26] = (byte) ((sampleRate >> 16) & 0xff);
        header[27] = (byte) ((sampleRate >> 24) & 0xff);
        header[28] = (byte) ((bitrate / 8) & 0xff);
        header[29] = (byte) (((bitrate / 8) >> 8) & 0xff);
        header[30] = (byte) (((bitrate / 8) >> 16) & 0xff);
        header[31] = (byte) (((bitrate / 8) >> 24) & 0xff);
        header[32] = (byte) ((channels * format) / 8);
        header[33] = 0;
        header[34] = 16;
        header[35] = 0;
        header[36] = 'd';
        header[37] = 'a';
        header[38] = 't';
        header[39] = 'a';
        header[40] = (byte) (data.length  & 0xff);
        header[41] = (byte) ((data.length >> 8) & 0xff);
        header[42] = (byte) ((data.length >> 16) & 0xff);
        header[43] = (byte) ((data.length >> 24) & 0xff);

        outputStream.write(header);
        outputStream.write(data);
    }

}
