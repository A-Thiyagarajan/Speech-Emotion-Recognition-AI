# Speech Emotion Recognition App

Responsive web UI plus a FastAPI backend for ONNX speech emotion prediction.

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
  config.js
  script.js
index.html
```

`docs/` is the GitHub Pages website folder. `Backend/` runs the prediction API.

## Run Locally

```powershell
python -m pip install -r Backend/requirements.txt
uvicorn main:app --reload
```

Open:

```text
http://127.0.0.1:8000/
```

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
4. Set **Source** to **Deploy from a branch**.
5. Select your branch and choose `/docs`.
6. Save, then open the Pages link GitHub gives you.

GitHub Pages hosts only the static website. It cannot run the FastAPI backend or
the ONNX model. For predictions from the Pages link, deploy `Backend/` to a
Python hosting service and set `SER_API_BASE_URL` in `docs/config.js` to that
backend URL.

## Labels

`model_ser_labels.json` defines the model output order:

```text
0: angry
1: happy
2: neutral
3: sad
```
