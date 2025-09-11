const router = express.Router();

router.use('/youtube-downloader', require('./youtube-downloader'));
// router.use('/karaoke-maker', require('./karaoke-maker'));

module.exports = router;