const helmet = require('helmet');

module.exports = app => {
    // https://www.npmjs.com/package/helmet
    const options = {
        crossOriginOpenerPolicy: false,

        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "connect-src": ["'self'", "https://cdn.jsdelivr.net"],
                "img-src": ["'self'", "data:", "https://i.ytimg.com"],
                "media-src": ["'self'", "blob:"],
                "script-src": ["'self'", "https://cdn.jsdelivr.net"],
            },
        }
    };

    app.use(helmet(options));
};