const cors = require('cors');

module.exports = app => {
    // https://www.npmjs.com/package/cors#configuration-options
    const options = {};

    app.use(cors(options));
};