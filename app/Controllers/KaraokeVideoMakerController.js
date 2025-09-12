const { exec } = require('child_process');

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

        // Middleware to handle file uploads for this specific request
        req.uploadPath = requestPath;
        const uploader = upload.fields([{ name: 'images' }, { name: 'audio', maxCount: 1 }]);

        uploader(req, res, async (err) => {
            if (err) {
                console.error("Upload error:", err);
                return res.status(500).send('File upload failed.');
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

                // Pre-process each image using absolute paths
                const conversionPromises = imageFiles.map((image, index) => {
                    return new Promise((resolve, reject) => {
                        const inputImagePath = path.join(requestPath, image.filename);
                        const outputClipName = `clip_${index}.ts`;
                        const outputClipPath = path.join(requestPath, outputClipName);

                        const convertCmd = `ffmpeg -loop 1 -i "${inputImagePath}" -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p,fps=30" -c:v libx264 -t ${slideDuration} -y "${outputClipPath}"`;

                        exec(convertCmd, (error, stdout, stderr) => {
                            if (error) {
                                console.error(`Error converting ${image.filename}:`, stderr);
                                return reject(error);
                            }
                            resolve(outputClipPath); // Resolve with the full path to the new clip
                        });
                    });
                });

                // Wait for all images to be converted into clips
                Promise.all(conversionPromises)
                    .then(clipPaths => {
                        // Create a new input file listing the absolute paths to the generated video clips
                        const clipListContent = clipPaths.map(p => `file '${p}'`).join('\n');
                        const clipListPath = path.join(requestPath, 'clips.txt');
                        fs.writeFileSync(clipListPath, clipListContent);

                        // FFMpeg Command: Part 1 - Concatenate the pre-processed clips
                        const silentVideoFilename = 'slideshow.mp4';
                        const silentVideoPath = path.join(requestPath, silentVideoFilename);
                        const concatCmd = `ffmpeg -f concat -safe 0 -i "${clipListPath}" -c copy -y "${silentVideoPath}"`;

                        console.log(concatCmd);

                        console.log('Running FFMpeg command 1 (Concat)...');
                        exec(concatCmd, (error1, stdout1, stderr1) => {
                            if (error1) {
                                console.error('FFMpeg Error (Part 1 - Concat):', stderr1);
                                return res.status(500).send('Failed to generate video slideshow.');
                            }

                            // FFMpeg Command: Part 2 - Combine video, audio, and subtitles
                            const audioFilePath = path.join(requestPath, audioFile.filename);
                            const finalVideoFilename = 'output.mp4';
                            const finalVideoPath = path.join(requestPath, finalVideoFilename);
                            // The subtitles filter can be sensitive; using an absolute path is best.
                            const subtitlesFilter = `subtitles='${srtPath}'`;
                            const ffmpegCmd2 = `ffmpeg -i "${silentVideoPath}" -i "${audioFilePath}" -vf "${subtitlesFilter}" -c:v libx264 -c:a aac -b:a 192k -shortest -y "${finalVideoPath}"`;

                            console.log('Slideshow created. Running FFMpeg command 2 (Combine)...');
                            exec(ffmpegCmd2, (error2, stdout2, stderr2) => {
                                if (error2) {
                                    console.error('FFMpeg Error (Part 2):', stderr2);
                                    return res.status(500).send('Failed to combine video, audio, and lyrics.');
                                }
                                console.log('Final video created. Sending to client.');

                                res.download(finalVideoPath, 'karaoke.mp4', (err) => {
                                    console.log('Cleaning up temporary files...');
                                    fs.rm(requestPath, { recursive: true, force: true }, (rmErr) => {
                                        if (rmErr) console.error(`Error cleaning up directory ${requestPath}:`, rmErr);
                                    });
                                });
                            });
                        });
                    })
                    .catch(error => {
                        console.error("Image pre-processing failed:", error);
                        res.status(500).send('Failed to process one or more images.');
                    });

            } catch (e) {
                console.error("Processing error:", e);
                res.status(500).send('An error occurred on the server.');
            }
        });
    } catch (error) {
        return res.defaultError(error.stack);
    }
};