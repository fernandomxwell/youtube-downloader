// Converts seconds (e.g., 123.45) to SRT time format (00:02:03,450)
exports.toSrtTime = totalSeconds => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);

    const pad = (num) => num.toString().padStart(2, '0');
    const padMs = (num) => num.toString().padStart(3, '0');

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${padMs(milliseconds)}`;
};