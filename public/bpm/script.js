// --- DOM Element Selection ---
const initialState = document.getElementById("initial-state");
const loadingState = document.getElementById("loading-state");
const resultState = document.getElementById("result-state");
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("audio-file-input");
const loadingFilename = document.getElementById("loading-filename");
const bpmResult = document.getElementById("bpm-result");
const resultFilename = document.getElementById("result-filename");
const resetButton = document.getElementById("reset-button");
const notificationArea = document.getElementById("notification-area");
const chooseFileButton = document.getElementById('choose-file-button');
const audioFileInput = document.getElementById('audio-file-input');

if (chooseFileButton && audioFileInput) {
    chooseFileButton.addEventListener('click', () => {
        audioFileInput.click();
    });
}

// --- Event Listeners ---
dropZone.addEventListener("dragover", handleDragOver);
dropZone.addEventListener("dragleave", handleDragLeave);
dropZone.addEventListener("drop", handleDrop);
fileInput.addEventListener("change", handleFileSelect);
resetButton.addEventListener("click", resetUI);

// --- Event Handlers ---
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add("dragging");
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("dragging");
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("dragging");
    const files = e.dataTransfer.files;
    if (files.length) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length) {
        handleFile(files[0]);
    }
}

// --- UI Functions ---
function showLoading(filename) {
    initialState.classList.add("d-none");
    resultState.classList.add("d-none");
    loadingState.classList.remove("d-none");
    loadingFilename.textContent = filename;
}

function showResult(bpm, filename) {
    loadingState.classList.add("d-none");
    initialState.classList.add("d-none");
    resultState.classList.remove("d-none");
    bpmResult.textContent = bpm;
    resultFilename.textContent = filename;
}

function resetUI() {
    resultState.classList.add("d-none");
    loadingState.classList.add("d-none");
    initialState.classList.remove("d-none");
    fileInput.value = ""; // Clear the file input
    notificationArea.innerHTML = ""; // Clear any old notifications
}

function showNotification(message, type = 'danger') {
    const notification = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    notificationArea.innerHTML = notification;
}

// --- Main File Handling Logic ---
async function handleFile(file) {
    if (!file.type.startsWith("audio/mpeg")) {
        showNotification("Error: Please select an MP3 audio file.");
        return;
    }
    notificationArea.innerHTML = ""; // Clear previous errors
    showLoading(file.name);

    // --- NEW BACKEND-FOCUSED LOGIC ---
    const formData = new FormData();
    formData.append('audiofile', file);

    try {
        const response = await fetch('/api/bpm-detector/analyze-bpm', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Server responded with an error.');
        }

        const data = await response.json();
        showResult(data.bpm, file.name);

    } catch (error) {
        console.error("Error sending file to backend:", error);
        showNotification(`Error: Could not connect to the analysis server. Please ensure it's running. (${error.message})`);
        resetUI();
    }

    /*
    // --- OLD CLIENT-SIDE LOGIC (COMMENTED OUT) ---
    const reader = new FileReader();
    reader.onload = (e) => {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContext.decodeAudioData(e.target.result, 
        (buffer) => {
          getBPM(buffer)
            .then(bpm => {
              showResult(bpm, file.name);
            })
            .catch(err => {
              console.error(err);
              showNotification("Error: Could not process the audio file. It might be corrupted or in an unsupported format.");
              resetUI();
            });
        }, 
        (error) => {
          console.error("Error decoding audio data:", error);
          showNotification("Error: Could not decode the audio file. Please try a different MP3.");
          resetUI();
        }
      );
    };
    reader.onerror = () => {
        console.error("Error reading file");
        showNotification("Error: There was a problem reading the file.");
        resetUI();
    };
    reader.readAsArrayBuffer(file);
    */
}

// --- BPM DETECTION ALGORITHM (Improved) ---
/**
 * Processes the audio buffer and returns the calculated BPM.
 * @param {AudioBuffer} buffer The audio buffer from the decoded file.
 * @returns {Promise<number>} A promise that resolves with the BPM.
 */
// function getBPM(buffer) {
//     return new Promise((resolve) => {
//         // We run this in a promise to not block the main thread,
//         // though for most modern browsers this is fast enough.
//         const offlineContext = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
//         const source = offlineContext.createBufferSource();
//         source.buffer = buffer;

//         // Create a low-pass filter to isolate bass and drums.
//         // This is a key step to focus on the rhythm.
//         const filter = offlineContext.createBiquadFilter();
//         filter.type = "lowpass";
//         filter.frequency.value = 150; // Keep frequencies below 150Hz
//         filter.Q.value = 1;

//         source.connect(filter);
//         filter.connect(offlineContext.destination);

//         source.start(0);
//         offlineContext.startRendering();

//         offlineContext.oncomplete = (e) => {
//             const filteredBuffer = e.renderedBuffer;
//             const audioData = filteredBuffer.getChannelData(0);
//             const peaks = getPeaks(audioData, filteredBuffer.sampleRate);
//             const intervals = getIntervals(peaks);
//             const topInterval = groupIntervals(intervals);

//             // Calculate BPM from the most common interval
//             const bpm = Math.round(60 / topInterval);
//             resolve(bpm);
//         };
//     });
// }

/**
 * Identifies peaks in the audio data.
 * A "peak" is a point where the signal is louder than its neighbors.
 * @param {Float32Array} data The audio data.
 * @param {number} sampleRate The sample rate of the audio.
 * @returns {Array<number>} An array of peak times in seconds.
 */
// function getPeaks(data, sampleRate) {
//     const peaks = [];
//     const threshold = 0.6; // Dynamic threshold could be an improvement
//     let lastPeakTime = 0;

//     for (let i = 1; i < data.length - 1; i++) {
//         // Find a point higher than its neighbors
//         if (data[i] > data[i - 1] && data[i] > data[i + 1] && data[i] > threshold) {
//             const peakTime = i / sampleRate;
//             // Debounce peaks to avoid detecting multiple peaks for a single drum hit
//             if (peakTime - lastPeakTime > 0.1) { // 100ms debounce
//                 peaks.push(peakTime);
//                 lastPeakTime = peakTime;
//             }
//         }
//     }
//     return peaks;
// }

/**
 * Calculates the time intervals between consecutive peaks.
 * @param {Array<number>} peaks An array of peak times.
 * @returns {Array<number>} An array of interval lengths in seconds.
 */
// function getIntervals(peaks) {
//     const intervals = [];
//     for (let i = 0; i < peaks.length - 1; i++) {
//         const interval = peaks[i + 1] - peaks[i];
//         intervals.push(interval);
//     }
//     return intervals;
// }

/**
 * Groups similar intervals together to find the most common one.
 * This is the core of making the detection robust.
 * @param {Array<number>} intervals An array of interval lengths.
 * @returns {number} The most common interval.
 */
// function groupIntervals(intervals) {
//     const intervalGroups = [];
//     const tempoThreshold = 0.05; // 50ms threshold for grouping

//     intervals.forEach(interval => {
//         let found = false;
//         for (const group of intervalGroups) {
//             if (Math.abs(interval - group.interval) < tempoThreshold) {
//                 group.count++;
//                 found = true;
//                 break;
//             }
//         }
//         if (!found) {
//             intervalGroups.push({ interval: interval, count: 1 });
//         }
//     });

//     // Find the group with the highest count
//     if (intervalGroups.length === 0) return 0.5; // Default if no groups found

//     const topGroup = intervalGroups.sort((a, b) => b.count - a.count)[0];
//     return topGroup.interval;
// }