const router = express.Router();

// Controller
const youtubeDownloaderController = require(path.join(basepath.controller, 'YoutubeDownloaderController'));

// Form Request (Validation)
const getVideoInfoRequest = require(path.join(basepath.request, 'YoutubeDownloader', 'GetVideoInfoRequest'));
const prepareDownloadRequest = require(path.join(basepath.request, 'YoutubeDownloader', 'PrepareDownloadRequest'));

router.post(
    '/video-info',
    getVideoInfoRequest.rules,
    getVideoInfoRequest.validate,
    youtubeDownloaderController.getVideoInfo
);

router.post(
    '/prepare-download',
    prepareDownloadRequest.rules,
    prepareDownloadRequest.validate,
    youtubeDownloaderController.prepareDownload
);

router.get(
    '/get-file/:filename',
    youtubeDownloaderController.downloadFile
);

module.exports = router;