/**
 * ==============================
 * API Resources
 * ==============================
 * 
 * This is a transformation layer that sits between your object models 
 * and the JSON responses that are actually returned to your application's users.
 */

module.exports = outputFilename => {
    return {
        downloadUrl: `/api/youtube-downloader/get-file/${outputFilename}`,
    };
};