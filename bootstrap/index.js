module.exports = app => {
    // Set basepath
    global.basepath = {
        config: path.join(dirname, 'config'),
        controller: path.join(dirname, 'app', 'Controllers'),
        exception: path.join(dirname, 'app', 'Exceptions'),
        library: path.join(dirname, 'app', 'Libraries'),
        locale: path.join(dirname, 'locales'),
        middleware: path.join(dirname, 'app', 'Middlewares'),
        public: path.join(dirname, 'public'),
        request: path.join(dirname, 'app', 'Requests'),
        resource: path.join(dirname, 'app', 'Resources'),
        route: path.join(dirname, 'routes'),
        service: path.join(dirname, 'app', 'Services'),
        storage: path.join(dirname, 'storage'),
    };

    // Load middleware
    require(path.join(basepath.middleware, 'Cors'))(app);
    require(path.join(basepath.middleware, 'Helmet'))(app);
    require(path.join(basepath.middleware, 'Localization'))(app);
    require(path.join(basepath.middleware, 'ParseRequest'))(app);
    require(path.join(basepath.middleware, 'ReduceFingerprinting'))(app);
    require(path.join(basepath.middleware, 'StaticFiles'))(app);
    require(path.join(basepath.middleware, 'TransformResponse'))(app);

    // Load router
    require(basepath.route)(app);

    // Exception handler
    require(path.join(basepath.exception, 'NotFoundHandler'))(app);
    require(path.join(basepath.exception, 'DefaultErrorHandler'))(app);
};