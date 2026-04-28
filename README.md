# Speech Emotion Recognition App

Responsive web UI for ONNX speech emotion prediction. The GitHub Pages version
runs the ONNX model in the browser. A FastAPI backend is also included for local
API testing.

## Project Structure

```text
Backend/
  main.py
  model_ser.onnx
  model_ser.onnx.data
  model_ser_labels.json
  requirements.txt
docs/
  index.html
  style.css
  script.js
  model/
    model_ser_embedded.onnx
    model_ser_labels.json
index.html
```

`docs/` is the GitHub Pages website folder. `Backend/` runs the optional local
prediction API.

## Run Locally

```powershell
python -m pip install -r Backend/requirements.txt
uvicorn main:app --reload
```

Open:

```text
http://127.0.0.1:8000/
```

Use this local FastAPI URL if you want to test the backend API. The GitHub Pages
site predicts directly in the browser from the files in `docs/model/`.

## Required Model Files

Keep these files in `Backend/`:

```text
model_ser.onnx
model_ser.onnx.data
model_ser_labels.json
```

## GitHub Pages

1. Push the repository to GitHub.
2. Open repository **Settings**.
3. Go to **Pages**.
4. Set **Source** to **GitHub Actions**.
5. Push to `main`; `.github/workflows/pages.yml` deploys the `docs/` folder.

The deployed page loads `docs/model/model_ser_embedded.onnx` with
`onnxruntime-web`, so prediction works on GitHub Pages without running Python.

## Labels

`model_ser_labels.json` defines the model output order:

```text
0: angry
1: happy
2: neutral
3: sad
```
