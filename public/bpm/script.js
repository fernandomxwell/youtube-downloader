const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('audio-file-input');
const initialState = document.getElementById('initial-state');
const loadingState = document.getElementById('loading-state');
const resultState = document.getElementById('result-state');
const bpmResult = document.getElementById('bpm-result');
const loadingFilename = document.getElementById('loading-filename');
const resultFilename = document.getElementById('result-filename');
const resetButton = document.getElementById('reset-button');
const notificationArea = document.getElementById('notification-area');
const chooseFileButton = document.getElementById('choose-file-button');
const audioFileInput = document.getElementById('audio-file-input');

if (chooseFileButton && audioFileInput) {
    chooseFileButton.addEventListener('click', () => {
        audioFileInput.click();
    });
}

let audioContext;

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drop-zone--over');
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drop-zone--over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drop-zone--over');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'audio/mpeg') {
        handleFile(files[0]);
    } else {
        showNotification('Please drop a valid MP3 file.');
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

resetButton.addEventListener('click', () => {
    resultState.classList.add('d-none');
    initialState.classList.remove('d-none');
    fileInput.value = ''; // Reset file input
    notificationArea.innerHTML = ''; // Clear notifications
});

function initializeAudioContext() {
    if (!audioContext) {
        try {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioContext();
        } catch (e) {
            showNotification('Web Audio API is not supported in this browser.');
            return false;
        }
    }
    return true;
}

function handleFile(file) {
    if (!initializeAudioContext()) return;
    if (!file) return;

    // Update UI to loading state
    initialState.classList.add('d-none');
    resultState.classList.add('d-none');
    loadingState.classList.remove('d-none');
    loadingFilename.textContent = file.name;
    notificationArea.innerHTML = ''; // Clear old notifications

    const reader = new FileReader();

    reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        audioContext.decodeAudioData(arrayBuffer, (buffer) => {
            processAudioBuffer(buffer, file.name);
        }, (error) => {
            console.error('Error decoding audio data:', error);
            showNotification('Could not decode the audio file. It might be corrupted.');
            resetToInitialState();
        });
    };

    reader.onerror = (e) => {
        console.error('FileReader error:', e);
        showNotification('An error occurred while reading the file.');
        resetToInitialState();
    };

    reader.readAsArrayBuffer(file);
}

function resetToInitialState() {
    loadingState.classList.add('d-none');
    resultState.classList.add('d-none');
    initialState.classList.remove('d-none');
}

function processAudioBuffer(buffer, fileName) {
    // The core BPM detection logic
    getTempo(buffer).then((tempo) => {
        if (tempo === 0) {
            showNotification('Could not determine a confident tempo. The song might be too complex or have an irregular beat.');
            resetToInitialState();
            return;
        }
        // Update UI with result
        loadingState.classList.add('d-none');
        resultState.classList.remove('d-none');
        bpmResult.textContent = Math.round(tempo);
        resultFilename.textContent = fileName;
    }).catch(error => {
        console.error("Error detecting tempo:", error);
        showNotification("An unexpected error occurred during tempo detection.");
        resetToInitialState();
    });
}

function showNotification(message, type = 'danger') {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = [
        `<div class="alert alert-${type} alert-dismissible fade show" role="alert">`,
        `   <div>${message}</div>`,
        '   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
        '</div>'
    ].join('');
    notificationArea.innerHTML = ''; // Clear previous messages
    notificationArea.append(wrapper);
}

/**
 * The main function to get the tempo from an AudioBuffer.
 * @param {AudioBuffer} buffer The decoded audio data.
 * @returns {Promise<number>} A promise that resolves with the tempo in BPM.
 */
async function getTempo(buffer) {
    const sampleRate = buffer.sampleRate;
    const offlineContext = new OfflineAudioContext(1, buffer.length, sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;

    const filter = offlineContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 140;
    filter.Q.value = 1;

    source.connect(filter);
    filter.connect(offlineContext.destination);
    source.start(0);

    const filteredBuffer = await offlineContext.startRendering();
    const data = filteredBuffer.getChannelData(0);
    const peaks = getPeaks(data, sampleRate);
    const tempo = countIntervalsAndGetBPM(peaks, sampleRate);

    return tempo;
}

/**
 * Identifies peaks in the audio data.
 * @param {Float32Array} data The audio data (after filtering).
 * @param {number} sampleRate The sample rate of the audio.
 * @returns {Array<number>} An array of peak positions in samples.
 */
function getPeaks(data, sampleRate) {
    const peaks = [];
    const threshold = 0.6;
    const minPeakDistance = sampleRate * 0.1; // 100ms
    let lastPeak = -Infinity;

    for (let i = 1; i < data.length - 1; i++) {
        if (data[i] > data[i - 1] && data[i] > data[i + 1] && data[i] > threshold) {
            if (i - lastPeak > minPeakDistance) {
                peaks.push(i);
                lastPeak = i;
            }
        }
    }
    return peaks;
}

/**
 * Counts the intervals between peaks and determines the most likely BPM.
 * @param {Array<number>} peaks Array of peak positions in samples.
 * @param {number} sampleRate The sample rate of the audio.
 * @returns {number} The calculated BPM.
 */
function countIntervalsAndGetBPM(peaks, sampleRate) {
    if (peaks.length < 2) {
        return 0; // Not enough data
    }

    const intervalCounts = [];

    for (let i = 1; i < peaks.length; i++) {
        const intervalInSamples = peaks[i] - peaks[i - 1];
        const intervalInSeconds = intervalInSamples / sampleRate;
        const bpm = 60 / intervalInSeconds;
        const tempoGroup = getTempoGroup(bpm);

        if (tempoGroup > 0) {
            const existingGroup = intervalCounts.find(group => group.tempo === tempoGroup);
            if (existingGroup) {
                existingGroup.count++;
            } else {
                intervalCounts.push({ tempo: tempoGroup, count: 1 });
            }
        }
    }

    if (intervalCounts.length === 0) {
        return 0;
    }

    const bestGroup = intervalCounts.sort((a, b) => b.count - a.count)[0];
    return bestGroup.tempo;
}

/**
 * Helper function to group tempos together in a reasonable range (e.g., 70-180 BPM).
 * @param {number} bpm The raw BPM calculated from an interval.
 * @returns {number} The closest "round" tempo, or 0 if out of range.
 */
function getTempoGroup(bpm) {
    let roundedBpm = Math.round(bpm);

    // Normalize tempo to a typical range
    while (roundedBpm > 180) roundedBpm /= 2;
    while (roundedBpm < 70) roundedBpm *= 2;

    if (roundedBpm >= 70 && roundedBpm <= 180) {
        return Math.round(roundedBpm);
    }
    return 0;
}
