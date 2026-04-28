const form = document.getElementById("uploadForm");
const fileInput = document.getElementById("audioFile");
const fileTitle = document.getElementById("fileTitle");
const fileHelp = document.getElementById("fileHelp");
const predictButton = document.getElementById("predictButton");
const result = document.getElementById("result");

const API_BASE_URL = window.SER_API_BASE_URL || "http://127.0.0.1:8000";
const emotionEmoji = {
    angry: "😠",
    happy: "😊",
    neutral: "😐",
    sad: "😢",
    fear: "😨"
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
        const response = await fetch(`${API_BASE_URL}/predict`, {
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
        const emoji = emotionEmoji[emotion] || "🎧";
        setResult(`Emotion: ${data.emotion} ${emoji}`, "success");
    } catch (error) {
        setResult(
            "Prediction API is not reachable. Start the FastAPI backend with uvicorn, then refresh this page.",
            "error"
        );
    } finally {
        predictButton.disabled = false;
    }
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
