const form = document.getElementById("uploadForm");
const fileInput = document.getElementById("audioFile");
const fileTitle = document.getElementById("fileTitle");
const fileHelp = document.getElementById("fileHelp");
const predictButton = document.getElementById("predictButton");
const result = document.getElementById("result");

const CONFIGURED_API_BASE_URL = (window.SER_API_BASE_URL || "").replace(/\/$/, "");
const IS_GITHUB_PAGES = location.hostname.endsWith("github.io");
const emotionEmoji = {
    angry: "\u{1F620}",
    happy: "\u{1F60A}",
    neutral: "\u{1F610}",
    sad: "\u{1F622}",
    fear: "\u{1F628}"
};

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

    const formData = new FormData();
    formData.append("file", file);

    predictButton.disabled = true;
    setResult("Analyzing audio...", "loading");

    try {
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/predict`, {
            method: "POST",
            body: formData
        });

        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
            ? await response.json()
            : {};

        if (!response.ok) {
            throw new Error(data.detail || "Prediction failed.");
        }

        const emotion = String(data.emotion || "").toLowerCase();
        const emoji = emotionEmoji[emotion] || "\u{1F3A7}";
        setResult(`Emotion: ${data.emotion} ${emoji}`, "success");
    } catch (error) {
        setResult(getPredictionErrorMessage(error), "error");
    } finally {
        predictButton.disabled = false;
    }
}

function getApiBaseUrl() {
    if (CONFIGURED_API_BASE_URL) {
        return CONFIGURED_API_BASE_URL;
    }

    if (IS_GITHUB_PAGES) {
        throw new Error(
            "GitHub Pages cannot run the Python model backend. Start uvicorn and open http://127.0.0.1:8000/, or deploy the backend and set docs/config.js."
        );
    }

    return window.location.origin;
}

function getPredictionErrorMessage(error) {
    if (error && error.message) {
        return error.message;
    }

    return "Prediction API is not reachable. Start FastAPI with uvicorn, then open http://127.0.0.1:8000/.";
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
