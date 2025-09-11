const ffmpeg = require('fluent-ffmpeg');
const ytdl = require('ytdl-core');

// API Resource
const videoInfoResource = require(basepath.resource + '/YoutubeDownloader/VideoInfoResource');
const prepareDownloadResource = require(basepath.resource + '/YoutubeDownloader/PrepareDownloadResource');

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

        const tempDir = path.join(basepath.storage, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        const now = Date.now();

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
            await Promise.all([
                fs.unlink(videoPath),
                fs.unlink(audioPath)
            ]);
        }

        // Send back the link to the prepared file
        return res.success(prepareDownloadResource(outputFilename));
    } catch (error) {
        return res.defaultError(error.stack);
    }
};

exports.downloadFile = async (req, res) => {
    try {
        // 
    } catch (error) {
        return res.defaultError(error.stack);
    }
};