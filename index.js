const express = require('express');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.json());

// Create a temporary directory for downloads if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
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

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});