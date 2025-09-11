module.exports = app => {
    app.use(express.static(basepath.public));
};