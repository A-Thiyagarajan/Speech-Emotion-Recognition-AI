const form = document.getElementById("uploadForm");
const fileInput = document.getElementById("audioFile");
const fileTitle = document.getElementById("fileTitle");
const fileHelp = document.getElementById("fileHelp");
const predictButton = document.getElementById("predictButton");
const result = document.getElementById("result");

const SAMPLE_RATE = 22050;
const N_MELS = 128;
const N_FFT = 2048;
const HOP_LENGTH = 512;
const TARGET_FRAMES = 128;
const MODEL_PATH = "model/model_ser_embedded.onnx";
const LABELS_PATH = "model/model_ser_labels.json";
const emotionEmoji = {
    angry: "\u{1F620}",
    happy: "\u{1F60A}",
    neutral: "\u{1F610}",
    sad: "\u{1F622}",
    fear: "\u{1F628}"
};

let sessionPromise;
let labelsPromise;
let melFilterBank;
let hannWindow;

resetUpload();

window.addEventListener("pageshow", resetUpload);
fileInput.addEventListener("change", updateSelectedFile);
form.addEventListener("submit", sendAudio);

function resetUpload() {
    form.reset();
    fileTitle.textContent = "Choose a file";
    fileHelp.textContent = "No file selected";
    result.textContent = "Ready for upload.";
    result.className = "result idle";
    predictButton.disabled = false;
}

function updateSelectedFile() {
    const file = fileInput.files[0];

    if (!file) {
        fileTitle.textContent = "Choose a file";
        fileHelp.textContent = "No file selected";
        return;
    }

    fileTitle.textContent = file.name;
    fileHelp.textContent = `${formatFileSize(file.size)} selected`;
}

async function sendAudio(event) {
    event.preventDefault();

    const file = fileInput.files[0];

    if (!file) {
        setResult("Please choose a WAV file first.", "error");
        return;
    }

    predictButton.disabled = true;
    setResult("Loading model and analyzing audio...", "loading");

    try {
        const [session, labels, audio] = await Promise.all([
            getSession(),
            getLabels(),
            decodeAudio(file)
        ]);
        const input = extractFeatures(audio);
        const inputName = session.inputNames[0];
        const outputName = session.outputNames[0];
        const feeds = {
            [inputName]: new ort.Tensor("float32", input, [1, N_MELS, TARGET_FRAMES])
        };
        const output = await session.run(feeds);
        const probs = softmax(Array.from(output[outputName].data));
        const pred = argmax(probs);
        const emotion = labels[pred] || `class ${pred}`;
        const emoji = emotionEmoji[String(emotion).toLowerCase()] || "\u{1F3A7}";

        setResult(`Emotion: ${emotion} ${emoji}`, "success");
    } catch (error) {
        setResult(`Prediction failed: ${error.message || error}`, "error");
    } finally {
        predictButton.disabled = false;
    }
}

function getSession() {
    if (!sessionPromise) {
        ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";
        sessionPromise = ort.InferenceSession.create(MODEL_PATH, {
            executionProviders: ["wasm"]
        });
    }

    return sessionPromise;
}

function getLabels() {
    if (!labelsPromise) {
        labelsPromise = fetch(LABELS_PATH).then((response) => {
            if (!response.ok) {
                throw new Error("Could not load model labels.");
            }

            return response.json();
        });
    }

    return labelsPromise;
}

async function decodeAudio(file) {
    const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(arrayBuffer);
    const mono = mixToMono(decoded);
    const resampled = decoded.sampleRate === SAMPLE_RATE
        ? mono
        : resampleLinear(mono, decoded.sampleRate, SAMPLE_RATE);
    await audioContext.close();

    return cropAndNormalize(resampled);
}

function mixToMono(audioBuffer) {
    const channels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const mono = new Float32Array(length);

    for (let channel = 0; channel < channels; channel += 1) {
        const data = audioBuffer.getChannelData(channel);
        for (let i = 0; i < length; i += 1) {
            mono[i] += data[i] / channels;
        }
    }

    return mono;
}

function resampleLinear(input, fromRate, toRate) {
    const outputLength = Math.max(1, Math.round(input.length * toRate / fromRate));
    const output = new Float32Array(outputLength);
    const ratio = fromRate / toRate;

    for (let i = 0; i < outputLength; i += 1) {
        const position = i * ratio;
        const index = Math.floor(position);
        const fraction = position - index;
        const current = input[index] || 0;
        const next = input[index + 1] || current;
        output[i] = current + (next - current) * fraction;
    }

    return output;
}

function cropAndNormalize(input) {
    const offset = Math.min(Math.floor(0.5 * SAMPLE_RATE), input.length);
    const targetLength = Math.floor(3 * SAMPLE_RATE);
    const cropped = new Float32Array(targetLength);
    cropped.set(input.slice(offset, offset + targetLength));

    let peak = 0;
    for (const sample of cropped) {
        peak = Math.max(peak, Math.abs(sample));
    }

    if (peak > 0) {
        for (let i = 0; i < cropped.length; i += 1) {
            cropped[i] /= peak;
        }
    }

    return cropped;
}

function extractFeatures(audio) {
    const mel = melSpectrogram(audio);
    const db = powerToDb(mel);
    const fixed = fixFrames(db);
    return standardize(flattenMatrix(fixed));
}

function melSpectrogram(audio) {
    if (!melFilterBank) {
        melFilterBank = createMelFilterBank();
    }

    if (!hannWindow) {
        hannWindow = createHannWindow();
    }

    const padded = new Float32Array(audio.length + N_FFT);
    padded.set(audio, N_FFT / 2);
    const frameCount = Math.max(1, Math.floor((padded.length - N_FFT) / HOP_LENGTH) + 1);
    const spectrogram = Array.from({ length: N_MELS }, () => new Float32Array(frameCount));

    for (let frame = 0; frame < frameCount; frame += 1) {
        const start = frame * HOP_LENGTH;
        const power = powerSpectrum(padded, start);

        for (let mel = 0; mel < N_MELS; mel += 1) {
            let sum = 0;
            const filter = melFilterBank[mel];
            for (let bin = 0; bin < filter.length; bin += 1) {
                sum += filter[bin] * power[bin];
            }
            spectrogram[mel][frame] = sum;
        }
    }

    return spectrogram;
}

function powerSpectrum(audio, start) {
    const bins = N_FFT / 2 + 1;
    const real = new Float32Array(N_FFT);
    const imag = new Float32Array(N_FFT);
    const power = new Float32Array(bins);

    for (let i = 0; i < N_FFT; i += 1) {
        real[i] = (audio[start + i] || 0) * hannWindow[i];
    }

    fft(real, imag);

    for (let k = 0; k < bins; k += 1) {
        power[k] = real[k] * real[k] + imag[k] * imag[k];
    }

    return power;
}

function fft(real, imag) {
    const n = real.length;
    let j = 0;

    for (let i = 1; i < n; i += 1) {
        let bit = n >> 1;
        while (j & bit) {
            j ^= bit;
            bit >>= 1;
        }
        j ^= bit;

        if (i < j) {
            const tempReal = real[i];
            const tempImag = imag[i];
            real[i] = real[j];
            imag[i] = imag[j];
            real[j] = tempReal;
            imag[j] = tempImag;
        }
    }

    for (let length = 2; length <= n; length <<= 1) {
        const angle = -2 * Math.PI / length;
        const wLengthReal = Math.cos(angle);
        const wLengthImag = Math.sin(angle);

        for (let i = 0; i < n; i += length) {
            let wReal = 1;
            let wImag = 0;

            for (let k = 0; k < length / 2; k += 1) {
                const evenReal = real[i + k];
                const evenImag = imag[i + k];
                const oddReal = real[i + k + length / 2] * wReal - imag[i + k + length / 2] * wImag;
                const oddImag = real[i + k + length / 2] * wImag + imag[i + k + length / 2] * wReal;

                real[i + k] = evenReal + oddReal;
                imag[i + k] = evenImag + oddImag;
                real[i + k + length / 2] = evenReal - oddReal;
                imag[i + k + length / 2] = evenImag - oddImag;

                const nextWReal = wReal * wLengthReal - wImag * wLengthImag;
                wImag = wReal * wLengthImag + wImag * wLengthReal;
                wReal = nextWReal;
            }
        }
    }
}

function createHannWindow() {
    const window = new Float32Array(N_FFT);
    for (let i = 0; i < N_FFT; i += 1) {
        window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N_FFT);
    }
    return window;
}

function createMelFilterBank() {
    const bins = N_FFT / 2 + 1;
    const filters = Array.from({ length: N_MELS }, () => new Float32Array(bins));
    const melMin = hzToMel(0);
    const melMax = hzToMel(SAMPLE_RATE / 2);
    const melPoints = [];

    for (let i = 0; i < N_MELS + 2; i += 1) {
        melPoints.push(melMin + (melMax - melMin) * i / (N_MELS + 1));
    }

    const fftBins = melPoints.map((mel) => Math.floor((N_FFT + 1) * melToHz(mel) / SAMPLE_RATE));

    for (let mel = 1; mel <= N_MELS; mel += 1) {
        const left = fftBins[mel - 1];
        const center = fftBins[mel];
        const right = fftBins[mel + 1];
        const filter = filters[mel - 1];

        for (let bin = left; bin < center; bin += 1) {
            filter[bin] = (bin - left) / Math.max(1, center - left);
        }

        for (let bin = center; bin < right; bin += 1) {
            filter[bin] = (right - bin) / Math.max(1, right - center);
        }
    }

    return filters;
}

function hzToMel(hz) {
    return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel) {
    return 700 * (10 ** (mel / 2595) - 1);
}

function powerToDb(mel) {
    let maxDb = -Infinity;
    const db = mel.map((row) => {
        const converted = new Float32Array(row.length);
        for (let i = 0; i < row.length; i += 1) {
            converted[i] = 10 * Math.log10(Math.max(row[i], 1e-10));
            maxDb = Math.max(maxDb, converted[i]);
        }
        return converted;
    });

    for (const row of db) {
        for (let i = 0; i < row.length; i += 1) {
            row[i] = Math.max(row[i], maxDb - 80);
        }
    }

    return db;
}

function fixFrames(matrix) {
    return matrix.map((row) => {
        const fixed = new Float32Array(TARGET_FRAMES);
        fixed.set(row.slice(0, TARGET_FRAMES));
        return fixed;
    });
}

function flattenMatrix(matrix) {
    const output = new Float32Array(N_MELS * TARGET_FRAMES);
    let offset = 0;

    for (const row of matrix) {
        output.set(row, offset);
        offset += TARGET_FRAMES;
    }

    return output;
}

function standardize(values) {
    let sum = 0;
    for (const value of values) {
        sum += value;
    }

    const mean = sum / values.length;
    let variance = 0;
    for (const value of values) {
        variance += (value - mean) ** 2;
    }

    const std = Math.sqrt(variance / values.length) + 1e-6;
    for (let i = 0; i < values.length; i += 1) {
        values[i] = (values[i] - mean) / std;
    }

    return values;
}

function softmax(values) {
    const max = Math.max(...values);
    const exps = values.map((value) => Math.exp(value - max));
    const sum = exps.reduce((total, value) => total + value, 0);
    return exps.map((value) => value / sum);
}

function argmax(values) {
    let bestIndex = 0;
    for (let i = 1; i < values.length; i += 1) {
        if (values[i] > values[bestIndex]) {
            bestIndex = i;
        }
    }
    return bestIndex;
}

function setResult(message, state) {
    result.textContent = message;
    result.className = `result ${state}`;
}

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
