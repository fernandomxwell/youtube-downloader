const { analyze } = require('web-audio-beat-detector');
const { Lame } = require('node-lame');

// Libraries
const { upload } = require(path.join(basepath.library, 'Multer'));

const uploadDir = path.join(basepath.storage, 'uploads');

const decodeAudio = (filePath) => {
    // This function now uses the promise-based .decode() method as per the documentation
    return new Promise((resolve, reject) => {
        const decoder = new Lame({
            output: "buffer",
        }).setFile(filePath);

        decoder
            .decode()
            .then(() => {
                const buffer = decoder.getBuffer();
                if (!buffer || buffer.length === 0) {
                    return reject(new Error('Failed to decode audio file. Buffer is empty.'));
                }

                // The beat detector needs the data in a specific format (mock AudioBuffer)
                const float32Array = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Float32Array.BYTES_PER_ELEMENT);
                const mockAudioBuffer = {
                    getChannelData: () => float32Array,
                    sampleRate: decoder.sampleRate, // The decoder instance provides the sampleRate
                };
                resolve(mockAudioBuffer);
            })
            .catch((error) => {
                reject(new Error(`Decoding error: ${error.message}`));
            });
    });
};

exports.analyzeBPM = async (req, res) => {
    try {
        // Create a unique temporary directory for this request
        const requestId = `job-${Date.now()}`;
        const requestPath = path.join(uploadDir, requestId);

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        fs.mkdirSync(requestPath);

        req.uploadPath = requestPath;
        const uploader = upload.fields([{ name: 'audiofile', maxCount: 1 }]);

        uploader(req, res, async (err) => {
            if (err) {
                console.error("Upload error:", err);
                return res.defaultError(err.stack);
            }

            const audioFile = req.files['audiofile'] ? req.files['audiofile'][0] : null;
            if (!audioFile) {
                return res.status(400).json({ error: 'No audio file uploaded.' });
            }

            const filePath = audioFile.path;

            try {
                // 1. Decode the uploaded MP3 file to a raw audio buffer
                const audioBuffer = await decodeAudio(filePath);

                // 2. Use web-audio-beat-detector to analyze the buffer
                const bpm = await analyze(audioBuffer);

                console.log(`Detected BPM: ${bpm} for file: ${audioFile.originalname}`);
                res.json({ bpm: Math.round(bpm) });

            } catch (error) {
                console.error('Error processing file:', error);
                res.status(500).json({ error: 'Failed to analyze the audio file. It might be corrupted or unsupported.' });
            } finally {
                // Clean up the temporary folder
                if (filePath) {
                    const requestPath = path.dirname(filePath);
                    fs.rmSync(requestPath, { recursive: true, force: true });
                }
            }
        });
    } catch (error) {
        return res.defaultError(error.message);
    }
};