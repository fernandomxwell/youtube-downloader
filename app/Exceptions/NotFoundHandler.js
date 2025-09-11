module.exports = app => {
    app.use((req, res, next) => {
        return res.error(res.__('errors.404'), 404);
    });
};