from fastapi import FastAPI, UploadFile, File, HTTPException, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import onnxruntime as ort
import numpy as np
import librosa
import json
from pathlib import Path

app = FastAPI()


@app.middleware("http")
async def add_cors_headers(request, call_next):
    if request.method == "OPTIONS":
        return Response(status_code=204, headers=cors_headers())

    response = await call_next(request)
    for header, value in cors_headers().items():
        response.headers[header] = value
    return response


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Private-Network": "true",
    }

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "docs"
MODEL_PATH = BASE_DIR / "model_ser.onnx"
MODEL_DATA_PATH = BASE_DIR / "model_ser.onnx.data"
LABELS_PATH = BASE_DIR / "model_ser_labels.json"
session = None
labels = None


def missing_model_files():
    required_files = (MODEL_PATH, MODEL_DATA_PATH, LABELS_PATH)
    return [path for path in required_files if not path.exists()]


def load_model():
    global session, labels

    if session is not None and labels is not None:
        return session, labels

    missing_files = missing_model_files()
    if missing_files:
        missing_names = ", ".join(path.name for path in missing_files)
        raise RuntimeError(
            f"Missing required model file(s): {missing_names}. "
            f"Place model_ser.onnx, model_ser.onnx.data, and "
            f"model_ser_labels.json in {BASE_DIR}."
        )

    session = ort.InferenceSession(str(MODEL_PATH))
    with open(LABELS_PATH, "r") as f:
        labels = json.load(f)

    return session, labels


try:
    load_model()
except RuntimeError as exc:
    print(f"Model not loaded: {exc}")


@app.get("/")
async def index():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)


@app.get("/style.css", include_in_schema=False)
async def styles():
    return FileResponse(FRONTEND_DIR / "style.css")


@app.get("/script.js", include_in_schema=False)
async def script():
    return FileResponse(FRONTEND_DIR / "script.js")


@app.get("/config.js", include_in_schema=False)
async def config():
    return Response('window.SER_API_BASE_URL = "";', media_type="application/javascript")


# FEATURE EXTRACTION (SAME AS TRAINING)
def extract(audio):
    audio = librosa.util.normalize(audio)

    mel = librosa.feature.melspectrogram(y=audio, sr=22050, n_mels=128)
    mel = librosa.power_to_db(mel)

    if mel.shape[1] < 128:
        mel = np.pad(mel, ((0,0),(0,128-mel.shape[1])))
    else:
        mel = mel[:, :128]

    mel = (mel - mel.mean()) / (mel.std() + 1e-6)
    return mel.astype(np.float32)


def softmax(values):
    values = values - np.max(values)
    exp_values = np.exp(values)
    return exp_values / np.sum(exp_values)


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        model_session, emotion_labels = load_model()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    audio, sr = librosa.load(file.file, sr=22050, duration=3, offset=0.5)

    x = extract(audio)
    x = np.expand_dims(x, axis=0)

    logits = model_session.run(None, {"input": x})[0][0]
    probs = softmax(logits)
    pred = np.argmax(probs)

    emotion = emotion_labels[pred]
    confidence = float(np.max(probs))

    return {
        "emotion": emotion,
        "confidence": confidence
    }


app.mount("/model", StaticFiles(directory=FRONTEND_DIR / "model"), name="model")
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
