const ffmpeg = require('fluent-ffmpeg');

// Libraries
const { toSrtTime } = require(path.join(basepath.library, 'Time'));
const { upload } = require(path.join(basepath.library, 'Multer'));

const uploadDir = path.join(basepath.storage, 'uploads');

exports.generateKaraokeVideo = async (req, res) => {
    try {
        // Create a unique temporary directory for this request
        const requestId = `job-${Date.now()}`;
        const requestPath = path.join(uploadDir, requestId);

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        fs.mkdirSync(requestPath);

        req.uploadPath = requestPath;
        const uploader = upload.fields([{ name: 'images' }, { name: 'audio', maxCount: 1 }]);

        uploader(req, res, async (err) => {
            if (err) {
                console.error("Upload error:", err);
                return res.defaultError(err.stack);
            }

            try {
                const lyrics = JSON.parse(req.body.lyrics);
                const audioFile = req.files.audio[0];
                const imageFiles = req.files.images;
                const audioDuration = parseFloat(req.body.duration);
                const slideDuration = audioDuration / imageFiles.length;

                // Create an SRT subtitle file from the lyric timings
                const srtPath = path.join(requestPath, 'lyrics.srt');
                const srtContent = lyrics.map((line, index) => {
                    const start = toSrtTime(line.startTime);
                    const end = toSrtTime(line.endTime);
                    return `${index + 1}\n${start} --> ${end}\n${line.text}\n`;
                }).join('\n');
                fs.writeFileSync(srtPath, srtContent);

                // Stage 1 - Pre-process each image using absolute paths
                const conversionPromises = imageFiles.map((image, index) => {
                    return new Promise((resolve, reject) => {
                        const inputImagePath = path.join(requestPath, image.filename);
                        const outputClipPath = path.join(requestPath, `clip_${index}.ts`);

                        ffmpeg(inputImagePath)
                            .loop(slideDuration)
                            .videoFilters([
                                'scale=1280:720:force_original_aspect_ratio=decrease',
                                'pad=1280:720:(ow-iw)/2:(oh-ih)/2',
                                'format=yuv420p',
                                'fps=30'
                            ])
                            .videoCodec('libx264')
                            .on('end', () => resolve(outputClipPath))
                            .on('error', (err) => reject(err))
                            .save(outputClipPath);
                    });
                });

                const clipPaths = await Promise.all(conversionPromises);

                // --- Stage 2: Concatenate clips into a silent slideshow ---
                const silentVideoPath = path.join(requestPath, 'slideshow.mp4');
                const merger = ffmpeg();
                clipPaths.forEach(clip => merger.input(clip));

                merger.on('end', () => {
                    // --- Stage 3: Combine slideshow, audio, and subtitles ---
                    const finalVideoPath = path.join(requestPath, 'output.mp4');
                    const audioFilePath = path.join(requestPath, audioFile.filename);

                    ffmpeg(silentVideoPath)
                        .input(audioFilePath)
                        .videoCodec('libx264')
                        .audioCodec('aac')
                        .audioBitrate('192k')
                        .outputOptions('-vf', `subtitles='${srtPath}'`)
                        .outputOptions('-shortest') // Ensure video ends with the shortest input (audio)
                        .on('end', () => {
                            res.download(finalVideoPath, 'karaoke.mp4', (err) => {
                                fs.rm(requestPath, { recursive: true, force: true }, (rmErr) => {
                                    if (rmErr) console.error(`Error cleaning up directory ${requestPath}:`, rmErr);
                                });
                            });
                        })
                        .on('error', (error) => {
                            console.error('FFMpeg Error (Stage 3):', error.message);
                            return res.defaultError(err.stack);
                        })
                        .save(finalVideoPath);
                }).on('error', (error) => {
                    console.error('FFMpeg Error (Stage 2 - Concat):', error.message);
                    return res.defaultError(error.stack);
                }).mergeToFile(silentVideoPath, requestPath);
            } catch (error) {
                console.error("Processing error:", error);
                return res.defaultError(error.stack);
            }
        });
    } catch (error) {
        return res.defaultError(error.stack);
    }
};