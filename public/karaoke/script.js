// --- CONFIG ---
const API_ENDPOINT = 'http://localhost:3000/api/karaoke-maker/generate-video';

// --- STATE MANAGEMENT ---
let images = [];
let audioFile = null;
let lyrics = []; // { text: "...", startTime: null, endTime: null }
let currentLyricIndex = 0;
let isMarkingStart = true;

// --- DOM ELEMENTS ---
const step1Div = document.getElementById('step1');
const step2Div = document.getElementById('step2');
const step3Div = document.getElementById('step3');
const goToStep2Btn = document.getElementById('goToStep2Btn');
const goToStep3Btn = document.getElementById('goToStep3Btn');
const backToStep1Btn = document.getElementById('backToStep1Btn');
const imageUpload = document.getElementById('imageUpload');
const audioUpload = document.getElementById('audioUpload');
const lyricsUpload = document.getElementById('lyricsUpload');
const audioPlayer = document.getElementById('audioPlayer');
const lyricsList = document.getElementById('lyricsList');
const currentLyricLine = document.getElementById('currentLyricLine');
const syncBtn = document.getElementById('syncBtn');
const generateBtn = document.getElementById('generateBtn');
const progressLog = document.getElementById('progressLog');
const resultDiv = document.getElementById('result');
const downloadLink = document.getElementById('downloadLink');

// --- STEP NAVIGATION ---
function updateStepIndicator(step) {
    document.querySelectorAll('.step-indicator').forEach((el, index) => {
        const circle = el.querySelector('div');
        const isCompleted = index < step - 1;
        const isActive = index === step - 1;

        el.classList.toggle('text-success', isCompleted);
        el.classList.toggle('text-primary', isActive);
        el.classList.toggle('text-muted', !isCompleted && !isActive);

        circle.classList.toggle('bg-success', isCompleted);
        circle.classList.toggle('bg-primary', isActive);
        circle.classList.toggle('bg-secondary-subtle', !isCompleted && !isActive);
    });
}

function navigateToStep(step) {
    step1Div.classList.add('d-none');
    step2Div.classList.add('d-none');
    step3Div.classList.add('d-none');
    document.getElementById(`step${step}`).classList.remove('d-none');
    updateStepIndicator(step);
}

goToStep2Btn.addEventListener('click', () => {
    prepareSyncStep();
    navigateToStep(2);
});
goToStep3Btn.addEventListener('click', () => navigateToStep(3));
backToStep1Btn.addEventListener('click', () => navigateToStep(1));

// --- INPUT VALIDATION ---
function validateStep1() {
    const allValid = images.length > 0 && audioFile && lyricsUpload.value.trim().length > 0;
    goToStep2Btn.disabled = !allValid;
}

// --- STEP 1: UPLOAD LOGIC ---
imageUpload.addEventListener('change', (e) => {
    images = Array.from(e.target.files);
    const imagePreview = document.getElementById('imagePreview');
    imagePreview.innerHTML = '';
    images.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target.result;
            img.className = 'rounded image-preview-item';
            imagePreview.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
    validateStep1();
});

audioUpload.addEventListener('change', (e) => {
    audioFile = e.target.files[0];
    document.getElementById('audioName').textContent = audioFile ? audioFile.name : '';
    validateStep1();
});

lyricsUpload.addEventListener('input', validateStep1);

// --- STEP 2: SYNC LOGIC ---
function prepareSyncStep() {
    const url = URL.createObjectURL(audioFile);
    audioPlayer.src = url;

    lyrics = lyricsUpload.value.trim().split('\n').map(line => ({
        text: line.trim(),
        startTime: null,
        endTime: null
    })).filter(line => line.text.length > 0);

    currentLyricIndex = 0;
    isMarkingStart = true;
    renderLyricsList();
    updateSyncUI();
}

function renderLyricsList() {
    lyricsList.innerHTML = '';
    lyrics.forEach((lyric, index) => {
        const div = document.createElement('div');
        div.className = `lyric-item p-2 rounded-2 transition ${index === currentLyricIndex ? 'active' : ''}`;
        const timeText = (lyric.startTime !== null && lyric.endTime !== null)
            ? `<small class="font-monospace float-end opacity-75">${lyric.startTime.toFixed(2)}s - ${lyric.endTime.toFixed(2)}s</small>`
            : '';
        div.innerHTML = `<span>${lyric.text}</span> ${timeText}`;
        lyricsList.appendChild(div);
    });
}

function updateSyncUI() {
    if (currentLyricIndex < lyrics.length) {
        currentLyricLine.textContent = lyrics[currentLyricIndex].text;
        syncBtn.textContent = isMarkingStart ? 'Mark Start' : 'Mark End';
        syncBtn.classList.toggle('btn-danger', !isMarkingStart);
        syncBtn.classList.toggle('btn-success', isMarkingStart);
    } else {
        currentLyricLine.textContent = "All lyrics synced!";
        syncBtn.textContent = 'Finished';
        syncBtn.disabled = true;
        goToStep3Btn.disabled = false;
    }
    renderLyricsList();
}

function handleSync() {
    if (currentLyricIndex >= lyrics.length) return;
    const currentTime = audioPlayer.currentTime;

    if (isMarkingStart) {
        lyrics[currentLyricIndex].startTime = currentTime;
        isMarkingStart = false;
    } else {
        lyrics[currentLyricIndex].endTime = currentTime;
        if (lyrics[currentLyricIndex].endTime <= lyrics[currentLyricIndex].startTime) {
            lyrics[currentLyricIndex].endTime = lyrics[currentLyricIndex].startTime + 0.1; // Ensure end time is after start
        }
        isMarkingStart = true;
        currentLyricIndex++;
    }
    updateSyncUI();
}

syncBtn.addEventListener('click', handleSync);
document.body.onkeyup = function (e) {
    if (e.key === ' ' && !step2Div.classList.contains('d-none')) {
        e.preventDefault();
        handleSync();
    }
}

// --- STEP 3: GENERATION LOGIC ---
generateBtn.addEventListener('click', async () => {
    const spinner = generateBtn.querySelector('.spinner-border');

    generateBtn.disabled = true;
    generateBtn.classList.add('btn-processing');
    spinner.style.display = 'inline-block';
    progressLog.textContent = 'Uploading files and starting process... Please wait.';
    resultDiv.classList.add('d-none');

    const formData = new FormData();
    images.forEach(img => {
        formData.append('images', img);
    });
    formData.append('audio', audioFile);
    formData.append('lyrics', JSON.stringify(lyrics));
    formData.append('duration', audioPlayer.duration);

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${errorText}`);
        }

        progressLog.textContent = 'Processing complete! Preparing download...';

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        downloadLink.href = url;
        downloadLink.download = 'karaoke.mp4';

        resultDiv.classList.remove('d-none');

    } catch (error) {
        console.error('Generation Error:', error);
        progressLog.textContent = `An error occurred: ${error.message}. Please check the server console.`;
    } finally {
        generateBtn.disabled = false;
        generateBtn.classList.remove('btn-processing');
        spinner.style.display = 'none';
    }
});

// Initialize first step
navigateToStep(1);