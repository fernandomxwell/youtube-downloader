module.exports = app => {
    app.use((err, req, res, next) => {
        return res.defaultError(err.stack);
    });
};