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
const filesListContainer = document.getElementById('filesListContainer');
const filesList = document.getElementById('filesList');
const predictBtn = document.getElementById('predictBtn');
const loadingSpinner = document.getElementById('loadingSpinner');
const loadingProgress = document.getElementById('loadingProgress');
const resultsContainer = document.getElementById('resultsContainer');
const resultsList = document.getElementById('resultsList');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');

// Store uploaded files
let uploadedFiles = [];
let currentAudioPlayer = null;
let currentPlayingIndex = null;

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
    handleMultipleFiles(Array.from(files));
  }
});

// Handle file selection
function handleFileSelect() {
  const files = Array.from(audioFile.files);
  handleMultipleFiles(files);
}

function handleMultipleFiles(files) {
  // Validate files
  const validTypes = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/flac', 'audio/x-wav', 'audio/mp3'];
  
  const validFiles = files.filter(file => {
    const isValid = validTypes.includes(file.type) || 
                    file.name.match(/\.(wav|mp3|ogg|flac)$/i);
    if (!isValid) {
      showError(`"${file.name}" is not a valid audio format`);
    }
    return isValid;
  });

  if (validFiles.length === 0) return;

  // Add to uploaded files
  uploadedFiles = validFiles;

  // Display files list
  displayFilesList();
  hideError();
  predictBtn.disabled = false;
}

function displayFilesList() {
  filesList.innerHTML = '';
  uploadedFiles.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.id = `file-item-${index}`;
    
    // Create URL for audio preview
    const audioUrl = URL.createObjectURL(file);
    
    fileItem.innerHTML = `
      <div class="file-item-info">
        <button class="file-item-play" id="play-btn-${index}" onclick="togglePlayback(${index}, '${audioUrl}')">
          <span class="play-icon">▶</span>
          <span class="playing-indicator"></span>
        </button>
        <div class="file-item-details">
          <span class="file-item-name">🎵 ${file.name}</span>
          <span class="file-item-size">${formatFileSize(file.size)}</span>
        </div>
      </div>
      <button class="file-item-remove" onclick="removeFile(${index})">✕ Remove</button>
    `;
    filesList.appendChild(fileItem);
  });

  filesListContainer.style.display = uploadedFiles.length > 0 ? 'block' : 'none';
}

function removeFile(index) {
  uploadedFiles.splice(index, 1);
  displayFilesList();
  if (uploadedFiles.length === 0) {
    predictBtn.disabled = true;
    resultsContainer.style.display = 'none';
  }
}

// Audio playback functions
function togglePlayback(index, audioUrl) {
  const playBtn = document.getElementById(`play-btn-${index}`);
  const fileItem = document.getElementById(`file-item-${index}`);
  
  // Stop current playback if different file
  if (currentPlayingIndex !== null && currentPlayingIndex !== index) {
    stopPlayback(currentPlayingIndex);
  }
  
  // If same file is already playing, stop it
  if (currentPlayingIndex === index && currentAudioPlayer) {
    stopPlayback(index);
    return;
  }
  
  // Start playback
  if (!currentAudioPlayer) {
    currentAudioPlayer = new Audio();
    currentAudioPlayer.addEventListener('ended', () => {
      if (currentPlayingIndex !== null) {
        stopPlayback(currentPlayingIndex);
      }
    });
  }
  
  currentAudioPlayer.src = audioUrl;
  currentAudioPlayer.play();
  currentPlayingIndex = index;
  
  // Update UI
  playBtn.classList.add('playing');
  fileItem.classList.add('playing');
  playBtn.querySelector('.play-icon').textContent = '⏸';
}

function stopPlayback(index) {
  if (currentAudioPlayer) {
    currentAudioPlayer.pause();
    currentAudioPlayer.currentTime = 0;
  }
  
  const playBtn = document.getElementById(`play-btn-${index}`);
  const fileItem = document.getElementById(`file-item-${index}`);
  
  if (playBtn) {
    playBtn.classList.remove('playing');
    playBtn.querySelector('.play-icon').textContent = '▶';
  }
  
  if (fileItem) {
    fileItem.classList.remove('playing');
  }
  
  currentPlayingIndex = null;
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Analyze all files
async function analyzeAllFiles() {
  if (uploadedFiles.length === 0) {
    showError('Please select audio files first');
    return;
  }

  // Show loading state
  loadingSpinner.style.display = 'flex';
  resultsContainer.style.display = 'none';
  hideError();
  hideSuccess();
  predictBtn.disabled = true;

  const results = [];
  const totalFiles = uploadedFiles.length;

  try {
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      
      // Update progress
      loadingProgress.textContent = `Processing ${i + 1} of ${totalFiles}...`;

      try {
        const result = await analyzeFile(file);
        results.push({
          fileName: file.name,
          ...result
        });
      } catch (error) {
        console.error(`Error analyzing ${file.name}:`, error);
        results.push({
          fileName: file.name,
          error: error.message
        });
      }

      // Small delay between requests
      if (i < uploadedFiles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Display results
    displayResults(results);
    showSuccess(`Successfully analyzed ${results.filter(r => !r.error).length} out of ${totalFiles} files!`);
  } catch (error) {
    console.error('Error:', error);
    showError(`Failed to analyze files: ${error.message}`);
  } finally {
    loadingSpinner.style.display = 'none';
    predictBtn.disabled = false;
  }
}

// Analyze single file
async function analyzeFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('http://127.0.0.1:8000/predict', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.statusText}`);
  }

  return await response.json();
}

// Display results
function displayResults(results) {
  resultsList.innerHTML = '';

  results.forEach((result, index) => {
    const resultItem = document.createElement('div');
    resultItem.className = `result-item ${result.error ? '' : emotionConfig[result.emotion.toLowerCase()].color}`;
    resultItem.style.animationDelay = `${index * 0.1}s`;

    if (result.error) {
      resultItem.innerHTML = `
        <div class="result-file-name">${result.fileName}</div>
        <div style="color: #dc2626; font-weight: 600;">❌ Error: ${result.error}</div>
      `;
    } else {
      const emotion = result.emotion.toLowerCase();
      const config = emotionConfig[emotion];
      
      resultItem.innerHTML = `
        <div class="result-file-name">${result.fileName}</div>
        <div class="result-emotion">
          <span class="emotion-emoji-large">${config.emoji}</span>
          <div class="emotion-info">
            <div class="emotion-label">Detected Emotion</div>
            <div class="emotion-name">${emotion}</div>
          </div>
        </div>
      `;
    }

    resultsList.appendChild(resultItem);
  });

  resultsContainer.style.display = 'block';
  setTimeout(() => {
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
}

// Reset analysis
function resetAnalysis() {
  audioFile.value = '';
  uploadedFiles = [];
  filesList.innerHTML = '';
  filesListContainer.style.display = 'none';
  resultsContainer.style.display = 'none';
  loadingSpinner.style.display = 'none';
  hideError();
  hideSuccess();
  predictBtn.disabled = true;
  uploadArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Message handling
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'flex';
}

function hideError() {
  errorMessage.style.display = 'none';
}

function showSuccess(message) {
  successMessage.textContent = message;
  successMessage.style.display = 'flex';
}

function hideSuccess() {
  successMessage.style.display = 'none';
}

// Keyboard support
document.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && predictBtn && !predictBtn.disabled) {
    analyzeAllFiles();
  }
});
