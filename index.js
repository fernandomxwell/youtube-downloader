const express = require('express');
const ytdl = require('ytdl-core');
const multer = require('multer');
const { exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// Create a temporary directory for downloads if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Create a unique directory for each processing request
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // The unique directory is created in the main endpoint logic
        cb(null, req.uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- HELPER FUNCTIONS ---
// Converts seconds (e.g., 123.45) to SRT time format (00:02:03,450)
function toSrtTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);

    const pad = (num) => num.toString().padStart(2, '0');
    const padMs = (num) => num.toString().padStart(3, '0');

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${padMs(milliseconds)}`;
}

// Endpoint to get video information
app.post('/videoInfo', async (req, res) => {
    try {
        const url = req.body.url;
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }
        const info = await ytdl.getInfo(url);
        const thumbnail = info.videoDetails.thumbnails.pop();
        res.json({
            title: info.videoDetails.title,
            formats: info.formats,
            thumbnailUrl: thumbnail.url
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch video information.' });
    }
});

// Prepare the file and return a link
app.post('/prepare-download', async (req, res) => {
    try {
        const { url, videoItag, audioItag, type, title } = req.body;

        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        const sanitizedTitle = title.replace(/[<>:"/\\|?*]+/g, '_');
        const outputFilename = `${sanitizedTitle}_${Date.now()}.${type}`;
        const outputPath = path.join(tempDir, outputFilename);

        if (type === 'mp3') {
            await new Promise((resolve, reject) => {
                ytdl(url, { filter: format => format.itag == audioItag })
                    .pipe(fs.createWriteStream(outputPath))
                    .on('finish', resolve)
                    .on('error', reject);
            });
        } else { // MP4 Merging
            const videoPath = path.join(tempDir, `video_${Date.now()}.mp4`);
            const audioPath = path.join(tempDir, `audio_${Date.now()}.m4a`);

            const downloadVideo = new Promise((resolve, reject) => {
                ytdl(url, { filter: format => format.itag == videoItag }).pipe(fs.createWriteStream(videoPath)).on('finish', resolve).on('error', reject);
            });
            const downloadAudio = new Promise((resolve, reject) => {
                ytdl(url, { filter: format => format.itag == audioItag }).pipe(fs.createWriteStream(audioPath)).on('finish', resolve).on('error', reject);
            });

            await Promise.all([downloadVideo, downloadAudio]);

            await new Promise((resolve, reject) => {
                ffmpeg().input(videoPath).input(audioPath).outputOptions('-c:v copy').outputOptions('-c:a aac').save(outputPath).on('end', resolve).on('error', reject);
            });

            // Clean up temporary video/audio files
            fs.unlinkSync(videoPath);
            fs.unlinkSync(audioPath);
        }

        // Send back the link to the prepared file
        res.json({ downloadUrl: `/get-file/${outputFilename}` });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to process video.' });
    }
});

// Download the prepared file and clean up
app.get('/get-file/:filename', (req, res) => {
    const filePath = path.join(tempDir, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            if (err) console.error(err);
            // Cleanup the final merged file after sending it
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) console.error(unlinkErr);
            });
        });
    } else {
        res.status(404).send('File not found or has already been downloaded.');
    }
});

app.post('/generate-video', (req, res) => {
    // 1. Create a unique temporary directory for this request
    const requestId = `job-${Date.now()}`;
    const requestPath = path.join(uploadDir, requestId);
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

            // 2. Create an SRT subtitle file from the lyric timings
            const srtPath = path.join(requestPath, 'lyrics.srt');
            const srtContent = lyrics.map((line, index) => {
                const start = toSrtTime(line.startTime);
                const end = toSrtTime(line.endTime);
                return `${index + 1}\n${start} --> ${end}\n${line.text}\n`;
            }).join('\n');
            fs.writeFileSync(srtPath, srtContent);

            // --- UPDATED: Pre-process each image using absolute paths ---
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
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});