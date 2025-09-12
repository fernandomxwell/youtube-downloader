const router = express.Router();

// Controller
const karaokeVideoMakerController = require(path.join(basepath.controller, 'KaraokeVideoMakerController'));

// Form Request (Validation)

router.post(
    '/generate-video',
    karaokeVideoMakerController.generateKaraokeVideo
);

module.exports = router;