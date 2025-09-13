require('dotenv').config();

module.exports = {
    // For validation
    validation: {
        max_keyword_size: 255,
        max_post_size: '16mb',
        min_password_length: 8,
    },

    // For middleware
    urlencoded: {
        extended: true,
    },

    // Others
    debug: process.env.APP_DEBUG === 'true',
    env: process.env.NODE_ENV || 'production',
    key: process.env.APP_KEY,
    locale: process.env.APP_LOCALE || 'en',
    url: process.env.APP_URL || 'http://localhost',
};