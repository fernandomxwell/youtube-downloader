/**
 * ==============================
 * API Resources
 * ==============================
 * 
 * This is a transformation layer that sits between your object models 
 * and the JSON responses that are actually returned to your application's users.
 */

module.exports = item => {
    const thumbnail = item.videoDetails.thumbnails.pop();

    return {
        title: item.videoDetails.title,
        formats: item.formats,
        thumbnailUrl: thumbnail.url
    };
};