const helmet = require('helmet');

module.exports = app => {
    // https://www.npmjs.com/package/helmet
    const options = {
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "connect-src": ["'self'", "https://cdn.jsdelivr.net"],
                "img-src": ["'self'", "data:", "https://i.ytimg.com"],
            },
        }
    };

    app.use(helmet(options));
};