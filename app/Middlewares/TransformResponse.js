// Config
const { debug } = require(path.join(basepath.config, 'app'));

module.exports = app => {
    app.use((req, res, next) => {
        res.success = (data = {}, code = 200) => {
            res.status(code).json({
                status: true,
                data,
            });
        };

        res.error = (message, code = 400, errors = {}) => {
            res.status(code).json({
                status: false,
                message,
                errors,
            });
        };

        res.defaultError = (errors) => {
            errors = debug ? errors : {};

            res.status(500).json({
                status: false,
                message: res.__('errors.500'),
                errors,
            });
        };

        next();
    });
};