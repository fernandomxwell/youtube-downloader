const multer = require('multer');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // The unique directory is created in the main endpoint logic
        cb(null, req.uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

exports.upload = multer({ storage: storage });