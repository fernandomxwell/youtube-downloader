document.addEventListener('DOMContentLoaded', () => {
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
    const resetBtn = document.getElementById('reset-btn');

    let videoFormats = [];
    let videoTitle = '';
    let validatedUrl = '';

    getInfoBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) return showError('Please paste a YouTube URL.');

        downloadOptions.classList.add('d-none');
        hideError();
        loaderContainer.classList.remove('d-none');
        processingMessage.textContent = '';

        try {
            const response = await fetch('/videoInfo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
            if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch video info.');
            const data = await response.json();
            videoFormats = data.formats;
            videoTitle = data.title;
            validatedUrl = url;
            videoTitleElem.textContent = data.title;
            videoThumbnailElem.src = data.thumbnailUrl;
            populateQualities();
            downloadOptions.classList.remove('d-none');
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
        } else {
            body.videoItag = qualitySelect.value;
            const bestAudio = videoFormats.filter(f => f.hasAudio && !f.hasVideo).sort((a, b) => b.audioBitrate - a.audioBitrate)[0];
            if (!bestAudio) {
                showError('No audio format found to merge.');
                setControlsDisabled(false);
                loaderContainer.classList.add('d-none');
                return;
            }
            body.audioItag = bestAudio.itag;
        }

        try {
            const response = await fetch('/prepare-download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (!response.ok) throw new Error((await response.json()).error || 'Server failed to prepare file.');
            const data = await response.json();
            window.location.href = data.downloadUrl;
        } catch (err) {
            showError(err.message);
        } finally {
            setControlsDisabled(false);
            loaderContainer.classList.add('d-none');
        }
    });

    function populateQualities() {
        qualitySelect.innerHTML = '';
        const selectedFormat = formatSelect.value;
        let filteredFormats = [];
        if (selectedFormat === 'mp4') {
            const uniqueQualities = {};
            filteredFormats = videoFormats.filter(f => {
                if (f.hasVideo && !f.hasAudio && f.container === 'mp4' && !uniqueQualities[f.qualityLabel]) {
                    uniqueQualities[f.qualityLabel] = true;
                    return true;
                }
                return false;
            }).sort((a, b) => parseInt(b.qualityLabel) - parseInt(a.qualityLabel));
        } else {
            filteredFormats = videoFormats.filter(f => !f.hasVideo && f.hasAudio).sort((a, b) => b.audioBitrate - a.audioBitrate);
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

    function setControlsDisabled(isDisabled) {
        urlInput.disabled = isDisabled;
        getInfoBtn.disabled = isDisabled;
        downloadBtn.disabled = isDisabled;
        resetBtn.disabled = isDisabled;
    }

    function showError(message) { errorMessage.textContent = message; errorMessage.classList.remove('d-none'); }
    function hideError() { errorMessage.classList.add('d-none'); }
});
