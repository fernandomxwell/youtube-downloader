// Get all necessary DOM elements
const urlInput = document.getElementById('youtube-url');
const getInfoBtn = document.getElementById('get-info-btn');
const loaderContainer = document.getElementById('loader-container');
const processingMessage = document.getElementById('processing-message');
const errorMessage = document.getElementById('error-message');
const downloadOptions = document.getElementById('download-options');
const videoThumbnailElem = document.getElementById('video-thumbnail');
const videoTitleElem = document.getElementById('video-title');
const formatSelect = document.getElementById('format-select');
const qualitySelect = document.getElementById('quality-select');
const downloadBtn = document.getElementById('download-btn');
const refreshBtn = document.getElementById('refresh-btn');

// State variables
let videoFormats = [];
let videoTitle = '';
let validatedUrl = '';

// Event Listeners
getInfoBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
        showError('Please paste a YouTube URL.');
        return;
    }

    downloadOptions.classList.add('d-none');
    refreshBtn.classList.add('d-none');
    hideError();

    loaderContainer.classList.remove('d-none');
    processingMessage.textContent = ''; // Clear download message

    try {
        const response = await fetch('/videoInfo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch video information.');
        }

        const data = await response.json();
        videoFormats = data.formats;
        videoTitle = data.title;
        validatedUrl = url;

        videoTitleElem.textContent = videoTitle;
        videoThumbnailElem.src = data.thumbnailUrl;

        populateQualities();
        downloadOptions.classList.remove('d-none');
        refreshBtn.classList.remove('d-none');

    } catch (err) {
        showError(err.message);
    } finally {
        loaderContainer.classList.add('d-none');
    }
});

formatSelect.addEventListener('change', populateQualities);

downloadBtn.addEventListener('click', async () => {
    processingMessage.textContent = 'Processing your download, please wait...';
    loaderContainer.classList.remove('d-none');
    setControlsDisabled(true);
    hideError();

    const type = formatSelect.value;
    let body = { url: validatedUrl, type, title: videoTitle };

    if (type === 'mp3') {
        body.audioItag = qualitySelect.value;
    } else { // MP4
        body.videoItag = qualitySelect.value;
        const bestAudio = videoFormats.filter(f => f.hasAudio && !f.hasVideo).sort((a, b) => b.audioBitrate - a.audioBitrate)[0];

        if (!bestAudio) {
            showError('No audio format found to merge with video.');
            setControlsDisabled(false);
            loaderContainer.classList.add('d-none');
            return;
        }
        body.audioItag = bestAudio.itag;
    }

    try {
        const response = await fetch('/prepare-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Server failed to prepare the file.');
        }

        const data = await response.json();
        window.location.href = data.downloadUrl;

    } catch (err) {
        showError(err.message);
    } finally {
        setControlsDisabled(false);
        loaderContainer.classList.add('d-none');
    }
});

refreshBtn.addEventListener('click', resetUIState);

// Helper Functions
function populateQualities() {
    qualitySelect.innerHTML = '';
    const selectedFormat = formatSelect.value;
    let filteredFormats = [];

    if (selectedFormat === 'mp4') {
        const uniqueQualities = {};
        filteredFormats = videoFormats
            .filter(f => {
                if (f.hasVideo && !f.hasAudio && f.container === 'mp4' && !uniqueQualities[f.qualityLabel]) {
                    uniqueQualities[f.qualityLabel] = true;
                    return true;
                }
                return false;
            })
            .sort((a, b) => parseInt(b.qualityLabel) - parseInt(a.qualityLabel));
    } else { // mp3
        filteredFormats = videoFormats
            .filter(f => !f.hasVideo && f.hasAudio)
            .sort((a, b) => b.audioBitrate - a.audioBitrate);
    }

    if (filteredFormats.length === 0) {
        qualitySelect.innerHTML = '<option>No options available</option>';
        downloadBtn.disabled = true;
        return;
    }

    filteredFormats.forEach(format => {
        const option = document.createElement('option');
        option.value = format.itag;
        option.textContent = selectedFormat === 'mp4' ? format.qualityLabel : `${format.audioBitrate}kbps`;
        qualitySelect.appendChild(option);
    });
    downloadBtn.disabled = false;
}

function resetUIState() {
    urlInput.value = '';
    urlInput.disabled = false;
    downloadOptions.classList.add('d-none');
    refreshBtn.classList.add('d-none');
    hideError();
    videoFormats = [];
    videoTitle = '';
    validatedUrl = '';
    urlInput.focus();
}

function setControlsDisabled(isDisabled) {
    urlInput.disabled = isDisabled;
    getInfoBtn.disabled = isDisabled;
    downloadBtn.disabled = isDisabled;
    refreshBtn.disabled = isDisabled;
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('d-none');
}

function hideError() {
    errorMessage.classList.add('d-none');
}