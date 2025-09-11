// Config
const { validation, urlencoded } = require(path.join(basepath.config, 'app'));

module.exports = app => {
    app.use(express.json({ limit: validation.max_post_size }));
    app.use(express.urlencoded({ extended: urlencoded.extended }));
};