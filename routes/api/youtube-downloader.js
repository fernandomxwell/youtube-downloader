const router = express.Router();

// Controller
const youtubeDownloaderController = require(basepath.controller + '/YoutubeDownloaderController');

// Form Request (Validation)
const getVideoInfoRequest = require(basepath.request + '/YoutubeDownloader/GetVideoInfoRequest');
const prepareDownloadRequest = require(basepath.request + '/YoutubeDownloader/PrepareDownloadRequest');

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