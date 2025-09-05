const urlInput = document.getElementById('youtube-url');
const getInfoBtn = document.getElementById('get-info-btn');
const loader = document.getElementById('loader');
const downloadLoader = document.getElementById('download-loader');
const errorMessage = document.getElementById('error-message');

const downloadOptions = document.getElementById('download-options');
const videoThumbnailElem = document.getElementById('video-thumbnail');
const videoTitleElem = document.getElementById('video-title');
const formatSelect = document.getElementById('format-select');
const qualitySelect = document.getElementById('quality-select');
const downloadBtn = document.getElementById('download-btn');
const processingMessage = document.getElementById('processing-message');
const refreshBtn = document.getElementById('refresh-btn');

let videoFormats = [];
let videoTitle = '';
let validatedUrl = '';

getInfoBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
        showError('Please paste a YouTube URL.');
        return;
    }

    downloadOptions.classList.add('hidden');
    refreshBtn.classList.add('hidden');
    hideError();

    loader.style.display = 'block';

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
        downloadOptions.classList.remove('hidden');
        refreshBtn.classList.remove('hidden');
    } catch (err) {
        showError(err.message);
    } finally {
        loader.style.display = 'none';
    }
});

formatSelect.addEventListener('change', populateQualities);

downloadBtn.addEventListener('click', async () => {
    // Show processing message and disable the button
    processingMessage.classList.remove('hidden');
    downloadLoader.style.display = 'block';
    downloadBtn.disabled = true;
    getInfoBtn.disabled = true;
    refreshBtn.disabled = true;
    urlInput.disabled = true;
    hideError();

    const type = formatSelect.value;
    let body = {
        url: validatedUrl,
        type: type,
        title: videoTitle
    };

    if (type === 'mp3') {
        body.audioItag = qualitySelect.value;
    } else { // MP4
        body.videoItag = qualitySelect.value;
        const bestAudio = videoFormats
            .filter(f => f.hasAudio && !f.hasVideo)
            .sort((a, b) => b.audioBitrate - a.audioBitrate)[0];

        if (!bestAudio) {
            showError('No audio format found to merge with video.');
            processingMessage.classList.add('hidden');
            downloadLoader.style.display = 'none';
            downloadBtn.disabled = false;
            getInfoBtn.disabled = false;
            refreshBtn.disabled = false;
            urlInput.disabled = false;
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

        // NOW that the file is ready, trigger the download
        window.location.href = data.downloadUrl;

        // Hide the message after starting the download
        processingMessage.classList.add('hidden');
    } catch (err) {
        showError(err.message);
        processingMessage.classList.add('hidden');
    } finally {
        // Re-enable buttons
        downloadLoader.style.display = 'none';
        downloadBtn.disabled = false;
        getInfoBtn.disabled = false;
        refreshBtn.disabled = false;
    }
});

refreshBtn.addEventListener('click', () => {
    resetUIState();
    getInfoBtn.disabled = false;
    refreshBtn.disabled = false;
    urlInput.disabled = false;
});

// Helper Functions
function populateQualities() {
    qualitySelect.innerHTML = '';
    const selectedFormat = formatSelect.value;
    let filteredFormats = [];

    if (selectedFormat === 'mp4') {
        filteredFormats = videoFormats
            .filter(f => f.hasVideo && !f.hasAudio && f.container === 'mp4')
            .filter((format, index, self) => index === self.findIndex(f => f.qualityLabel === format.qualityLabel))
            .sort((a, b) => parseInt(b.qualityLabel) - parseInt(a.qualityLabel));
    } else if (selectedFormat === 'mp3') {
        filteredFormats = videoFormats
            .filter(f => !f.hasVideo && f.hasAudio)
            .sort((a, b) => b.audioBitrate - a.audioBitrate);
    }

    if (filteredFormats.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'No options available';
        qualitySelect.appendChild(option);
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
    downloadOptions.classList.add('hidden');
    refreshBtn.classList.add('hidden');
    processingMessage.classList.add('hidden');
    videoThumbnailElem.src = '';
    hideError();
    videoFormats = [];
    videoTitle = '';
    validatedUrl = '';
    urlInput.focus();
}

function showError(message) {
    errorMessage.textContent = message;
}

function hideError() {
    errorMessage.textContent = '';
}