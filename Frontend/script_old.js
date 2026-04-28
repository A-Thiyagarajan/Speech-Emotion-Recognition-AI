// Emotion configuration with emojis and colors
const emotionConfig = {
  angry: { emoji: '😠', color: 'emotion-angry' },
  disgust: { emoji: '🤮', color: 'emotion-disgust' },
  fear: { emoji: '😨', color: 'emotion-fear' },
  happy: { emoji: '😊', color: 'emotion-happy' },
  neutral: { emoji: '😐', color: 'emotion-neutral' },
  sad: { emoji: '😢', color: 'emotion-sad' },
  surprise: { emoji: '😲', color: 'emotion-surprise' }
};

// DOM Elements
const audioFile = document.getElementById('audioFile');
const selectBtn = document.getElementById('selectBtn');
const uploadArea = document.getElementById('uploadArea');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const predictBtn = document.getElementById('predictBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const resultCard = document.getElementById('resultCard');
const emotionDisplay = document.getElementById('emotionDisplay');
const confidenceBar = document.getElementById('confidenceBar');
const confidenceText = document.getElementById('confidenceText');
const errorMessage = document.getElementById('errorMessage');

// Event Listeners
selectBtn.addEventListener('click', () => audioFile.click());

audioFile.addEventListener('change', handleFileSelect);

// Drag and drop
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    audioFile.files = files;
    handleFileSelect();
  }
});

// Handle file selection
function handleFileSelect() {
  const file = audioFile.files[0];
  if (!file) return;

  // Validate file type
  const validTypes = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/flac'];
  if (!validTypes.includes(file.type)) {
    showError('Please upload a valid audio file (WAV, MP3, OGG, or FLAC)');
    audioFile.value = '';
    return;
  }

  // Show file info
  fileName.textContent = file.name;
  fileSize.textContent = formatFileSize(file.size);
  fileInfo.style.display = 'block';
  predictBtn.disabled = false;
  hideError();
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Send audio for analysis
async function sendAudio() {
  const file = audioFile.files[0];
  if (!file) {
    showError('Please select an audio file first');
    return;
  }

  // Show loading state
  loadingSpinner.style.display = 'flex';
  resultCard.style.display = 'none';
  hideError();
  predictBtn.disabled = true;

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('http://127.0.0.1:8000/predict', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      throw new Error(`Server error: ${res.statusText}`);
    }

    const data = await res.json();

    // Simulate a brief delay for better UX (show processing)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Display results
    displayResults(data);
  } catch (error) {
    console.error('Error:', error);
    showError(`Failed to analyze: ${error.message}`);
  } finally {
    loadingSpinner.style.display = 'none';
    predictBtn.disabled = false;
  }
}

// Display emotion results
function displayResults(data) {
  const emotion = data.emotion.toLowerCase();
  const confidence = (data.confidence * 100).toFixed(1);
  const config = emotionConfig[emotion];

  // Update emotion display
  emotionDisplay.innerHTML = `
    <span class="emotion-emoji">${config.emoji}</span>
    <div class="emotion-name">${emotion}</div>
    <div class="emotion-label">Detected Emotion</div>
  `;
  emotionDisplay.className = `emotion-display ${config.color}`;

  // Show result card with animation
  resultCard.style.display = 'block';

  // Scroll to results
  setTimeout(() => {
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
}

// Reset analysis
function resetAnalysis() {
  audioFile.value = '';
  fileInfo.style.display = 'none';
  resultCard.style.display = 'none';
  loadingSpinner.style.display = 'none';
  hideError();
  predictBtn.disabled = true;
  uploadArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Error handling
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'flex';
}

function hideError() {
  errorMessage.style.display = 'none';
}

// Real-time file validation feedback
audioFile.addEventListener('change', () => {
  handleFileSelect();
});

// Optional: Keyboard support
document.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && predictBtn && !predictBtn.disabled) {
    sendAudio();
  }
});