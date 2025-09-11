const i18n = require('i18n');

// Config
const { locale } = require(path.join(basepath.config, 'app'));

module.exports = app => {
    // https://www.npmjs.com/package/i18n#list-of-all-configuration-options
    i18n.configure({
        locales: [
            'en',
            'id',
        ],
        defaultLocale: locale,
        directory: basepath.locale,
        objectNotation: true, // Enable nested JSON files
    });

    app.use(i18n.init);
};