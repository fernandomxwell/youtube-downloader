const router = express.Router();

// Controller
const bpmDetectorController = require(path.join(basepath.controller, 'BPMDetectorController'));

// Form Request (Validation)

router.post(
    '/analyze-bpm',
    bpmDetectorController.analyzeBPM
);

module.exports = router;