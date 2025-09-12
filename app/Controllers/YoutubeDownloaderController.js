const ffmpeg = require('fluent-ffmpeg');
const ytdl = require('ytdl-core');

// API Resource
const videoInfoResource = require(path.join(basepath.resource, 'YoutubeDownloader', 'VideoInfoResource'));
const prepareDownloadResource = require(path.join(basepath.resource, 'YoutubeDownloader', 'PrepareDownloadResource'));

const tempDir = path.join(basepath.storage, 'temp');

exports.getVideoInfo = async (req, res) => {
    try {
        const result = await ytdl.getInfo(req.body.url);

        return res.success(videoInfoResource(result));
    } catch (error) {
        return res.defaultError(error.stack);
    }
};

exports.prepareDownload = async (req, res) => {
    try {
        const { url, videoItag, audioItag, type, title } = req.body;

        const now = Date.now();

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        const outputFilename = `${title}_${now}.${type}`;
        const outputPath = path.join(tempDir, outputFilename);

        if (type === 'mp3') {
            await new Promise((resolve, reject) => {
                ytdl(url, { filter: format => format.itag == audioItag })
                    .pipe(fs.createWriteStream(outputPath))
                    .on('finish', resolve)
                    .on('error', reject);
            });
        } else { // MP4 Merging
            const videoPath = path.join(tempDir, `video_${now}.mp4`);
            const audioPath = path.join(tempDir, `audio_${now}.m4a`);

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
        return res.success(prepareDownloadResource(outputFilename));
    } catch (error) {
        return res.defaultError(error.stack);
    }
};

exports.downloadFile = async (req, res) => {
    try {
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
            return res.error(res.__('errors.404'), 404);
        }
    } catch (error) {
        return res.defaultError(error.stack);
    }
};