const router = express.Router();

// Controller
const karaokeVideoMakerController = require(basepath.controller + '/KaraokeVideoMakerController');

// Form Request (Validation)

router.post(
    '/generate-video',
    karaokeVideoMakerController.generateKaraokeVideo
);

module.exports = router;