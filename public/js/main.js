// Connect to WebSocket server
const socket = io();

// DOM Elements
const recordBtn = document.getElementById('recordBtn');
const importBtn = document.getElementById('importBtn');
const recordingModal = document.getElementById('recordingModal');
const uploadModal = document.getElementById('uploadModal');
const stopRecordingBtn = document.getElementById('stopRecording');
const pauseRecordingBtn = document.getElementById('pauseRecording');
const uploadForm = document.getElementById('uploadForm');
const audioFile = document.getElementById('audioFile');
const recordingTime = document.querySelector('.recording-time');
const playBtn = document.querySelector('.w-8.h-8.bg-neutral-darkest');
const progressBar = document.querySelector('.relative.flex-1.mx-3.h-1.bg-neutral-light');
const progressHandle = document.querySelector('.audio-progress-handle');
const progressIndicator = document.querySelector('.audio-progress-indicator');
const noteItems = document.querySelectorAll('.note-item');
const tabs = document.querySelectorAll('.tab');

// App state
let isRecording = false;
let recordingInterval = null;
let recordingSeconds = 0;
let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let audioContext = null;
let isPlaying = false;
let currentAudioTime = 0;

// Initialize audio context
try {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioContext();
} catch (e) {
  console.warn('Web Audio API is not supported in this browser');
}

// Event Listeners
recordBtn.addEventListener('click', startRecording);
importBtn.addEventListener('click', showImportModal);
stopRecordingBtn.addEventListener('click', stopRecording);
pauseRecordingBtn.addEventListener('click', pauseRecording);
uploadForm.addEventListener('submit', handleUpload);
playBtn.addEventListener('click', togglePlayback);
progressBar.addEventListener('click', seekAudio);

// Add click events to all note items
noteItems.forEach(note => {
  note.addEventListener('click', () => {
    noteItems.forEach(n => n.classList.remove('active'));
    note.classList.add('active');
  });
});

// Add click events to tabs
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });
});

// Recording functions
function startRecording() {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        // Show modal
        recordingModal.classList.remove('hidden');
        recordingModal.classList.add('flex');
        
        isRecording = true;
        recordingSeconds = 0;
        updateRecordingTime();
        
        // Start recording timer
        recordingInterval = setInterval(() => {
          recordingSeconds++;
          updateRecordingTime();
        }, 1000);
        
        // Create MediaRecorder
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = event => {
          audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = () => {
          // Create blob from recorded chunks
          audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          
          // Send to server for analysis
          sendAudioForAnalysis(audioBlob);
        };
        
        // Start recording
        mediaRecorder.start();
        animateRecording();
      })
      .catch(err => {
        console.error('Error accessing microphone:', err);
        alert('Could not access your microphone. Please check permissions.');
      });
  } else {
    alert('Your browser does not support audio recording.');
  }
}

function stopRecording() {
  if (isRecording && mediaRecorder) {
    mediaRecorder.stop();
    isRecording = false;
    clearInterval(recordingInterval);
    
    // Hide modal
    recordingModal.classList.add('hidden');
    recordingModal.classList.remove('flex');
  }
}

function pauseRecording() {
  if (isRecording && mediaRecorder) {
    if (mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
      pauseRecordingBtn.textContent = 'Resume';
      clearInterval(recordingInterval);
    } else if (mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
      pauseRecordingBtn.textContent = 'Pause';
      recordingInterval = setInterval(() => {
        recordingSeconds++;
        updateRecordingTime();
      }, 1000);
    }
  }
}

function updateRecordingTime() {
  const minutes = Math.floor(recordingSeconds / 60).toString().padStart(2, '0');
  const seconds = (recordingSeconds % 60).toString().padStart(2, '0');
  recordingTime.textContent = `${minutes}:${seconds}`;
}

function animateRecording() {
  // Simulate waveform animation
  const waveform = document.getElementById('waveform');
  let opacity = 1;
  let direction = -0.05;
  
  const animate = () => {
    if (!isRecording) return;
    
    opacity += direction;
    if (opacity <= 0.3 || opacity >= 1) {
      direction *= -1;
    }
    
    waveform.style.opacity = opacity;
    requestAnimationFrame(animate);
  };
  
  animate();
}

// Import functions
function showImportModal() {
  uploadModal.classList.remove('hidden');
  uploadModal.classList.add('flex');
}

function handleUpload(e) {
  e.preventDefault();
  
  if (!audioFile.files.length) {
    alert('Please select an audio file.');
    return;
  }
  
  const file = audioFile.files[0];
  const formData = new FormData();
  formData.append('audio', file);
  
  // Show loading state
  const submitBtn = uploadForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Uploading...';
  submitBtn.disabled = true;
  
  fetch('/upload', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Send to server for analysis
      sendAudioForAnalysis(file);
      uploadModal.classList.add('hidden');
      uploadModal.classList.remove('flex');
    } else {
      alert('Upload failed.');
    }
  })
  .catch(err => {
    console.error('Error uploading file:', err);
    alert('Error uploading file. Please try again.');
  })
  .finally(() => {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  });
}

// Analysis functions
function sendAudioForAnalysis(audioData) {
  socket.emit('analyze-speech', audioData);
  
  // Show loading state - you could add a loading indicator here
  
  // Listen for analysis results
  socket.once('analysis-results', handleAnalysisResults);
}

function handleAnalysisResults(results) {
  // Update UI with results
  document.querySelector('.metric-card:first-child .text-2xl').textContent = results.totalIssues;
  document.querySelector('.metric-card:last-child .text-2xl').textContent = results.duration;
  document.querySelector('.text-4xl.font-bold').textContent = results.speechRate;
  
  // Update top issues
  const issueItems = document.querySelectorAll('.space-y-2 .flex.items-center');
  issueItems[0].querySelector('.text-sm.font-medium').textContent = results.topIssues.syllable;
  issueItems[1].querySelector('.text-sm.font-medium').textContent = results.topIssues.filterWords;
  issueItems[2].querySelector('.text-sm.font-medium').textContent = results.topIssues.grammar;
  
  // We could update the transcript and conversation as well
  // but for simplicity we're keeping the mock content
}

// Playback functions
function togglePlayback() {
  if (isPlaying) {
    pausePlayback();
  } else {
    startPlayback();
  }
}

function startPlayback() {
  if (!audioBlob) return;
  
  const audioURL = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioURL);
  audio.currentTime = currentAudioTime;
  
  audio.onplay = () => {
    isPlaying = true;
    playBtn.innerHTML = '<i class="material-icons">pause</i>';
  };
  
  audio.onpause = () => {
    isPlaying = false;
    playBtn.innerHTML = '<i class="material-icons">play_arrow</i>';
    currentAudioTime = audio.currentTime;
  };
  
  audio.onended = () => {
    isPlaying = false;
    playBtn.innerHTML = '<i class="material-icons">play_arrow</i>';
    currentAudioTime = 0;
    updateProgressBar(0);
  };
  
  audio.ontimeupdate = () => {
    const percent = (audio.currentTime / audio.duration) * 100;
    updateProgressBar(percent);
  };
  
  audio.play();
}

function pausePlayback() {
  if (document.querySelector('audio')) {
    document.querySelector('audio').pause();
  }
}

function seekAudio(e) {
  if (!audioBlob) return;
  
  const percent = (e.offsetX / progressBar.offsetWidth) * 100;
  updateProgressBar(percent);
  
  if (document.querySelector('audio')) {
    const audio = document.querySelector('audio');
    audio.currentTime = (percent / 100) * audio.duration;
    currentAudioTime = audio.currentTime;
  }
}

function updateProgressBar(percent) {
  progressIndicator.style.width = `${percent}%`;
  progressHandle.style.left = `${percent}%`;
}

// Show/hide modals when clicking outside
window.addEventListener('click', (e) => {
  if (e.target === recordingModal) {
    // Don't close recording modal when clicking outside
    // as it might be an accidental click
  }
  
  if (e.target === uploadModal) {
    uploadModal.classList.add('hidden');
    uploadModal.classList.remove('flex');
  }
});

// Initialize the app
function init() {
  // Hide the modals
  recordingModal.classList.add('hidden');
  recordingModal.classList.remove('flex');
  
  uploadModal.classList.add('hidden');
  uploadModal.classList.remove('flex');
  
  // Listen for server events
  socket.on('connect', () => {
    console.log('Connected to server');
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });
}

// Start the app
init(); 