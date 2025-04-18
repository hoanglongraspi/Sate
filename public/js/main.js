// Connect to WebSocket server
const socket = io();

// DOM Elements
const recordBtn = document.getElementById('recordBtn');
const importBtn = document.getElementById('importBtn');
const emptyStateRecordBtn = document.getElementById('emptyStateRecordBtn');
const emptyStateImportBtn = document.getElementById('emptyStateImportBtn');
const initialEmptyState = document.getElementById('initialEmptyState');
const contentArea = document.getElementById('contentArea');
const recordingModal = document.getElementById('recordingModal');
const uploadModal = document.getElementById('uploadModal');
const stopRecordingBtn = document.getElementById('stopRecording');
const pauseRecordingBtn = document.getElementById('pauseRecording');
const uploadForm = document.getElementById('uploadForm');
const audioFile = document.getElementById('audioFile');
const recordingTime = document.querySelector('.recording-time');
const playBtn = document.getElementById('playButton');
const prevBtn = document.getElementById('prevButton');
const nextBtn = document.getElementById('nextButton');
const progressBar = document.querySelector('.relative.flex-1.mx-3.h-1.bg-neutral-light');
const progressHandle = document.querySelector('.audio-progress-handle');
const progressIndicator = document.querySelector('.audio-progress-indicator');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const noteItems = document.querySelectorAll('.note-item');
const tabs = document.querySelectorAll('.tab');
const issueItems = document.querySelectorAll('.issue-item');

// Create audio element
const audioPlayer = new Audio('/sound/673_clip.wav');

// Annotation Elements
const annotateBtn = document.getElementById('annotateBtn');
const annotationModal = document.getElementById('annotationModal');
const closeAnnotationModal = document.getElementById('closeAnnotationModal');
const cancelAnnotation = document.getElementById('cancelAnnotation');
const saveAnnotation = document.getElementById('saveAnnotation');
const correctedText = document.getElementById('correctedText');
const annotationType = document.getElementById('annotationType');

// Annotation Detail Popup Elements
const annotationDetailPopup = document.getElementById('annotationDetailPopup');
const annotationDetailType = document.getElementById('annotationDetailType');
const annotationDetailStart = document.getElementById('annotationDetailStart');
const annotationDetailEnd = document.getElementById('annotationDetailEnd');
const annotationDetailDuration = document.getElementById('annotationDetailDuration');
const closeAnnotationDetail = document.getElementById('closeAnnotationDetail');

// Sidebar elements
const leftSidebar = document.getElementById('leftSidebar');
const rightSidebar = document.getElementById('rightSidebar');
const toggleLeftSidebar = document.getElementById('toggleLeftSidebar');
const toggleRightSidebar = document.getElementById('toggleRightSidebar');
const showLeftSidebar = document.getElementById('showLeftSidebar');
const showRightSidebar = document.getElementById('showRightSidebar');

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
let selectedTextForAnnotation = null;

// Annotation Filter Elements
let activeAnnotationFilters = ['all']; // Store multiple active filters

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
emptyStateRecordBtn && emptyStateRecordBtn.addEventListener('click', startRecording);
emptyStateImportBtn && emptyStateImportBtn.addEventListener('click', showImportModal);
stopRecordingBtn.addEventListener('click', stopRecording);
pauseRecordingBtn.addEventListener('click', pauseRecording);
uploadForm.addEventListener('submit', handleUpload);
playBtn.addEventListener('click', togglePlayback);
prevBtn.addEventListener('click', skipPrevious);
nextBtn.addEventListener('click', skipNext);
progressBar.addEventListener('click', seekAudio);

// Annotation event listeners
annotateBtn && annotateBtn.addEventListener('click', showAnnotationModal);
closeAnnotationModal && closeAnnotationModal.addEventListener('click', hideAnnotationModal);
cancelAnnotation && cancelAnnotation.addEventListener('click', hideAnnotationModal);
saveAnnotation && saveAnnotation.addEventListener('click', handleSaveAnnotation);

// Add event listeners to annotation filter buttons
document.querySelectorAll('.annotation-filter').forEach(btn => {
  btn.addEventListener('click', handleAnnotationFilter);
});

// Add event listener to the close button for the annotation detail popup
closeAnnotationDetail && closeAnnotationDetail.addEventListener('click', hideAnnotationDetailPopup);

// Close detail popup when clicking anywhere else on the page
document.addEventListener('click', (e) => {
  if (annotationDetailPopup && 
      !annotationDetailPopup.contains(e.target) && 
      !e.target.classList.contains('highlight')) {
    hideAnnotationDetailPopup();
  }
});

// Function to show the annotation detail popup
function showAnnotationDetailPopup(e) {
  if (!e) return;
  
  // Get highlight element and its data
  const highlight = e.currentTarget || e.target;
  if (!highlight) return;
  
  const type = highlight.getAttribute('data-type');
  const timestampData = highlight.getAttribute('data-timestamp');
  
  if (!timestampData) return;
  
  // Parse timestamp data (format: "start:end")
  const [start, end] = timestampData.split(':').map(Number);
  const duration = (end - start).toFixed(2);
  
  // Format times for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };
  
  // Update popup content
  annotationDetailType.textContent = type.charAt(0).toUpperCase() + type.slice(1);
  annotationDetailStart.textContent = formatTime(start);
  annotationDetailEnd.textContent = formatTime(end);
  annotationDetailDuration.textContent = `${duration}s`;
  
  // Position the popup near the highlight
  const rect = highlight.getBoundingClientRect();
  annotationDetailPopup.style.top = `${rect.bottom + window.scrollY + 8}px`;
  annotationDetailPopup.style.left = `${rect.left + window.scrollX}px`;
  
  // Add a class to highlight the currently selected annotation
  document.querySelectorAll('.highlight-selected').forEach(el => {
    el.classList.remove('highlight-selected');
  });
  highlight.classList.add('highlight-selected');
  
  // Show the popup
  annotationDetailPopup.classList.remove('hidden');
  annotationDetailPopup.classList.add('show');
}

// Function to hide the annotation detail popup
function hideAnnotationDetailPopup() {
  if (annotationDetailPopup) {
    annotationDetailPopup.classList.remove('show');
    annotationDetailPopup.classList.add('hidden');
    
    // Remove the highlight from any selected annotation
    document.querySelectorAll('.highlight-selected').forEach(el => {
      el.classList.remove('highlight-selected');
    });
  }
}

// Function to attach annotation click handlers
function attachAnnotationClickHandlers() {
  document.querySelectorAll('.highlight').forEach(highlight => {
    highlight.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Show annotation detail popup
      showAnnotationDetailPopup(e);
      
      // Jump to the audio position if there's timestamp data
      const timestampData = highlight.getAttribute('data-timestamp');
      if (timestampData) {
        const [start] = timestampData.split(':').map(Number);
        audioPlayer.currentTime = start;
        currentAudioTime = start;
        updateTimeDisplay();
        
        // Play the audio from that point
        if (!isPlaying) {
          startPlayback();
        }
      }
    });
  });
}

// Annotation filter handler - updated to allow multiple selections
function handleAnnotationFilter() {
  const filterType = this.getAttribute('data-type');
  const isCurrentlyActive = this.classList.contains('filter-active');
  
  // Get patient bubble
  const patientBubble = document.querySelector('.message-bubble.patient');
  if (!patientBubble) return;
  
  // Handle "All" button specially
  if (filterType === 'all') {
    // When "All" is clicked, deactivate all other filters
    document.querySelectorAll('.annotation-filter').forEach(btn => {
      btn.classList.remove('filter-active');
      const icon = btn.querySelector('.material-icons');
      if (icon) icon.textContent = 'visibility';
    });
    
    // Activate only "All"
    this.classList.add('filter-active');
    const icon = this.querySelector('.material-icons');
    if (icon) icon.textContent = 'visibility_on';
    
    // Show all annotations
    patientBubble.querySelectorAll('.highlight').forEach(highlight => {
      highlight.style.opacity = '1';
      highlight.style.display = '';
    });
    
    // Update active filters
    activeAnnotationFilters = ['all'];
  } else {
    // For regular filter buttons
    if (isCurrentlyActive) {
      // If it's already active, deactivate it
      this.classList.remove('filter-active');
      const icon = this.querySelector('.material-icons');
      if (icon) icon.textContent = 'visibility';
      
      // Remove from active filters
      activeAnnotationFilters = activeAnnotationFilters.filter(f => f !== filterType);
      
      // If no filters are active, activate "All"
      if (activeAnnotationFilters.length === 0 || (activeAnnotationFilters.length === 1 && activeAnnotationFilters[0] === 'all')) {
        const allBtn = document.querySelector('.annotation-filter[data-type="all"]');
        if (allBtn) {
          allBtn.classList.add('filter-active');
          const allIcon = allBtn.querySelector('.material-icons');
          if (allIcon) allIcon.textContent = 'visibility_on';
        }
        
        // Show all annotations
        patientBubble.querySelectorAll('.highlight').forEach(highlight => {
          highlight.style.opacity = '1';
          highlight.style.display = '';
        });
        
        activeAnnotationFilters = ['all'];
      } else {
        // Apply current filter combination
        applyFilters(patientBubble);
      }
    } else {
      // If it's not active, activate it
      this.classList.add('filter-active');
      const icon = this.querySelector('.material-icons');
      if (icon) icon.textContent = 'visibility_on';
      
      // When activating a specific filter, deactivate "All"
      const allBtn = document.querySelector('.annotation-filter[data-type="all"]');
      if (allBtn) {
        allBtn.classList.remove('filter-active');
        const allIcon = allBtn.querySelector('.material-icons');
        if (allIcon) allIcon.textContent = 'visibility';
        
        // Remove "all" from active filters if it's there
        activeAnnotationFilters = activeAnnotationFilters.filter(f => f !== 'all');
      }
      
      // Add to active filters
      if (!activeAnnotationFilters.includes(filterType)) {
        activeAnnotationFilters.push(filterType);
      }
      
      // Apply new filter combination
      applyFilters(patientBubble);
    }
  }
  
  console.log('Active filters:', activeAnnotationFilters);
}

// Apply the current set of active filters
function applyFilters(container) {
  const highlights = container.querySelectorAll('.highlight');
  
  // Hide all annotations first
  highlights.forEach(highlight => {
    highlight.style.opacity = '0';
    highlight.style.display = 'none';
  });
  
  // Then show only those that match active filters
  activeAnnotationFilters.forEach(filterType => {
    if (filterType !== 'all') {
      container.querySelectorAll(`.highlight-${filterType}`).forEach(highlight => {
        highlight.style.opacity = '1';
        highlight.style.display = '';
      });
    }
  });
}

// Improved sidebar toggle event listeners with animations
toggleLeftSidebar.addEventListener('click', () => {
  // Animate sidebar collapse
  leftSidebar.style.width = '0px';
  leftSidebar.classList.add('sidebar-collapsed');
  
  // Delay showing the restore button until animation completes
  setTimeout(() => {
    showLeftSidebar.classList.remove('hidden');
    showLeftSidebar.classList.add('flex');
  }, 300);
  
  // Save state to localStorage
  localStorage.setItem('leftSidebarVisible', 'false');
});

toggleRightSidebar.addEventListener('click', () => {
  // Animate sidebar collapse
  rightSidebar.style.width = '0px';
  rightSidebar.classList.add('sidebar-collapsed');
  
  // Delay showing the restore button until animation completes
  setTimeout(() => {
    showRightSidebar.classList.remove('hidden');
    showRightSidebar.classList.add('flex');
  }, 300);
  
  // Save state to localStorage
  localStorage.setItem('rightSidebarVisible', 'false');
});

showLeftSidebar.addEventListener('click', () => {
  // Hide restore button first
  showLeftSidebar.classList.add('hidden');
  showLeftSidebar.classList.remove('flex');
  
  // Set fixed width
  leftSidebar.style.width = '15rem'; // 60 * 0.25 = 15rem
  leftSidebar.classList.remove('sidebar-collapsed');
  
  // Save state to localStorage
  localStorage.setItem('leftSidebarVisible', 'true');
});

showRightSidebar.addEventListener('click', () => {
  // Hide restore button first
  showRightSidebar.classList.add('hidden');
  showRightSidebar.classList.remove('flex');
  
  // Set fixed width
  rightSidebar.style.width = '20rem'; // 80 * 0.25 = 20rem
  rightSidebar.classList.remove('sidebar-collapsed');
  
  // Save state to localStorage
  localStorage.setItem('rightSidebarVisible', 'true');
});

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
    // Update active tab
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Get the tab name from data attribute
    const tabName = tab.getAttribute('data-tab');
    
    // Show appropriate content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
      content.classList.remove('active');
    });
    
    const activeContent = document.getElementById(`${tabName}-tab`);
    if (activeContent) {
      activeContent.classList.remove('hidden');
      activeContent.classList.add('active');
    }
  });
});

// Recording functions
function startRecording() {
  recordingModal.classList.remove('hidden');
  recordingModal.classList.add('flex');
  
  // Show recording in progress
  isRecording = true;
  recordingSeconds = 0;
  updateRecordingTime();
  
  // Fake recording for 3 seconds
  recordingInterval = setInterval(() => {
    recordingSeconds++;
    updateRecordingTime();
    
    // After 3 seconds, stop "recording" and show content
    if (recordingSeconds >= 3) {
      stopRecording();
      showContent();
    }
  }, 1000);
}

function stopRecording() {
  if (isRecording) {
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
  
  // Hide upload modal
  uploadModal.classList.add('hidden');
  uploadModal.classList.remove('flex');
  
  // Show loading state
  const loadingIndicator = document.createElement('div');
  loadingIndicator.id = 'loadingIndicator';
  loadingIndicator.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  loadingIndicator.innerHTML = `
    <div class="bg-white p-8 rounded-lg shadow-lg text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p class="text-lg text-neutral-darkest">Analyzing speech patterns...</p>
    </div>
  `;
  document.body.appendChild(loadingIndicator);
  
  // Simulate processing delay and transition to content
  setTimeout(() => {
    // Remove loading indicator
    document.getElementById('loadingIndicator')?.remove();
    
    // Transition from empty state to content
    showContent();
  }, 2000);
}

// Function to transition from empty state to content
function showContent() {
  // Hide empty state
  initialEmptyState.classList.add('hidden');
  
  // Show content area
  contentArea.classList.remove('hidden');
  contentArea.classList.add('flex');
  
  // Make the left sidebar visible
  const leftSidebar = document.getElementById('leftSidebar');
  if (leftSidebar) {
    leftSidebar.classList.remove('hidden');
    leftSidebar.style.width = '15rem';
    leftSidebar.classList.remove('sidebar-collapsed');
    
    // Hide the show button if it's visible
    const showLeftSidebar = document.getElementById('showLeftSidebar');
    if (showLeftSidebar) {
      showLeftSidebar.classList.add('hidden');
      showLeftSidebar.classList.remove('flex');
    }
  }
  
  // Load demo data
  loadDemoData();
}

// Load demo data function
function loadDemoData() {
  console.log("Loading demo data...");
  
  // Ensure audio player is properly set up for the sample audio
  audioPlayer.currentTime = 0;
  
  // Attach click handlers to all word timestamps
  attachWordTimestampClickHandlers();
  
  // For demo purposes, fake receiving analysis results
  const demoResults = {
    duration: '1:17',
    totalIssues: 25,
    speechRate: 100,
    issues: [
      {type: 'Pauses', count: 14},
      {type: 'Filler words', count: 6},
      {type: 'Repetition', count: 4},
      {type: 'Mispronunciation', count: 1}
    ]
  };
  
  // Update Note date and info
  const noteDate = document.querySelector('.flex.items-center.mr-5:first-child');
  if (noteDate) {
    // Set today's date
    const today = new Date();
    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    noteDate.innerHTML = `<i class="material-icons text-sm mr-1">event</i> ${today.toLocaleDateString('en-US', options)}`;
  }
  
  // Make a note appear active in the sidebar to complete the demo experience
  const noteItems = document.querySelectorAll('.note-item');
  if (noteItems.length > 0) {
    noteItems.forEach(note => note.classList.remove('active'));
    noteItems[0].classList.add('active');
  }
  
  setTimeout(() => {
    handleAnalysisResults(demoResults);
    
    // Populate issues tab with items based on annotations
    populateIssueItems();
  }, 500);
}

// Initialize the app
function init() {
  // Hide the modals
  recordingModal.classList.add('hidden');
  recordingModal.classList.remove('flex');
  
  uploadModal.classList.add('hidden');
  uploadModal.classList.remove('flex');

  if (annotationModal) {
    annotationModal.classList.add('hidden');
    annotationModal.classList.remove('flex');
  }
  
  // Initialize annotation filters
  const annotationFilters = document.querySelectorAll('.annotation-filter');
  if (annotationFilters) {
    // Set "All" as default active filter
    const allFilter = document.querySelector('.annotation-filter[data-type="all"]');
    if (allFilter) {
      allFilter.classList.add('filter-active');
      const icon = allFilter.querySelector('.material-icons');
      if (icon) icon.textContent = 'visibility_on';
    }
    
    // Add click event listeners to filters
    annotationFilters.forEach(filter => {
      // Remove any existing listeners first to prevent duplicates
      filter.removeEventListener('click', handleAnnotationFilter);
      filter.addEventListener('click', handleAnnotationFilter);
    });
  }
  
  // Add click event listeners to all highlights for popup
  attachAnnotationClickHandlers();
  
  // Add click event listeners to issue items
  attachIssueItemClickHandlers();
  
  // Add click event listeners to issue filters
  attachIssueFilterHandlers();
  
  // Load saved sidebar state
  loadSidebarState();
  
  // Load audio metadata
  audioPlayer.addEventListener('loadedmetadata', () => {
    updateTimeDisplay();
  });
  
  // Preload audio for faster playback
  audioPlayer.load();
  
  // Start in empty state - don't load demo data until user action
  // loadDemoData();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Add click event handlers to issue items
function attachIssueItemClickHandlers() {
  document.querySelectorAll('.issue-item').forEach(item => {
    item.addEventListener('click', handleIssueItemClick);
  });
}

// Handle click on an issue item in the Issues tab
function handleIssueItemClick() {
  const timestamp = this.getAttribute('data-timestamp');
  if (!timestamp) return;
  
  // Find the corresponding annotation in the transcript
  const [start, end] = timestamp.split(':');
  let matchingHighlight = null;
  
  document.querySelectorAll('.highlight').forEach(highlight => {
    const highlightTimestamp = highlight.getAttribute('data-timestamp');
    if (highlightTimestamp === timestamp) {
      matchingHighlight = highlight;
      return;
    }
  });
  
  if (matchingHighlight) {
    // Scroll to the highlight
    matchingHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Flash highlight effect
    document.querySelectorAll('.highlight-selected').forEach(el => {
      el.classList.remove('highlight-selected');
    });
    
    matchingHighlight.classList.add('highlight-selected');
    
    // Show annotation details popup
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    matchingHighlight.dispatchEvent(event);
  }
}

// Function to populate issue items
function populateIssueItems(issues) {
  const container = document.querySelector('.issue-items-container');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Add color legend
  createColorLegend(container);
  
  if (!issues || issues.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'issues-empty-state text-center p-4';
    emptyState.innerHTML = `
      <div class="text-gray-500">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">No issues found</h3>
        <p class="mt-1 text-sm text-gray-500">Your speech is perfect or we haven't analyzed it yet.</p>
      </div>
    `;
    container.appendChild(emptyState);
    return;
  }

  // Sort issues by start time
  issues.sort((a, b) => a.start - b.start);
  
  // ... existing code ...
}

// Function to create color legend
function createColorLegend(container) {
  const legendContainer = document.createElement('div');
  legendContainer.className = 'color-legend flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 rounded-md';
  
  const issueTypes = [
    { type: 'pause', label: 'Pause', color: '#FEF3C7' },
    { type: 'filler', label: 'Filler', color: '#DBEAFE' },
    { type: 'repetition', label: 'Repetition', color: '#E0E7FF' },
    { type: 'mispronunciation', label: 'Mispronunciation', color: '#FEE2E2' },
    { type: 'grammar', label: 'Grammar', color: '#D1FAE5' }
  ];
  
  issueTypes.forEach(item => {
    const legendItem = document.createElement('div');
    legendItem.className = 'color-legend-item flex items-center text-xs gap-1';
    legendItem.setAttribute('data-type', item.type);
    legendItem.innerHTML = `
      <div class="w-3 h-3 rounded-full" style="background-color: ${item.color}"></div>
      <span>${item.label}</span>
    `;
    legendContainer.appendChild(legendItem);
  });
  
  container.appendChild(legendContainer);
}

// Add click handlers for issue filters
function attachIssueFilterHandlers() {
  document.querySelectorAll('.issue-filter').forEach(filter => {
    filter.addEventListener('click', handleIssueFilterClick);
  });
}

function handleIssueFilterClick() {
  document.querySelectorAll('.issue-filter').forEach(filter => {
    filter.classList.remove('active');
  });
  this.classList.add('active');
  applyIssueFilter();
}

function applyIssueFilter() {
  const activeFilter = document.querySelector('.issue-filter.active');
  const filterValue = activeFilter ? activeFilter.getAttribute('data-filter') : 'all';
  const issueItems = document.querySelectorAll('.issue-item');
  
  // Keep track of how many items are visible
  let visibleCount = 0;
  
  issueItems.forEach(item => {
    const itemType = item.getAttribute('data-type');
    
    if (filterValue === 'all' || filterValue === itemType) {
      item.classList.remove('hidden');
      visibleCount++;
    } else {
      item.classList.add('hidden');
    }
  });
  
  // Update the color legend items opacity based on the filter
  const legendItems = document.querySelectorAll('.color-legend-item');
  legendItems.forEach(legendItem => {
    const legendType = legendItem.getAttribute('data-type');
    
    if (filterValue === 'all' || filterValue === legendType) {
      legendItem.classList.remove('opacity-50');
    } else {
      legendItem.classList.add('opacity-50');
    }
  });
  
  // Update the visible count badge
  const countBadge = document.querySelector('.issues-count-badge');
  if (countBadge) {
    countBadge.textContent = visibleCount;
  }
  
  // Show/hide empty state message
  const emptyState = document.querySelector('.issues-empty-state');
  if (emptyState) {
    if (visibleCount === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
    }
  }
}

// Initialize the color legend items
function initializeColorLegend() {
  const legendItems = document.querySelectorAll('.color-legend-item');
  
  legendItems.forEach(item => {
    item.addEventListener('click', function() {
      const type = this.getAttribute('data-type');
      const filterButtons = document.querySelectorAll('.issue-filter');
      
      // Find the filter button corresponding to this type
      const targetButton = Array.from(filterButtons).find(btn => 
        btn.getAttribute('data-filter') === type || 
        (btn.getAttribute('data-filter') === 'all' && type === null));
      
      if (targetButton) {
        // Simulate a click on the corresponding filter button
        targetButton.click();
      }
    });
  });
  
  // Apply initial filter state
  const activeFilter = document.querySelector('.issue-filter.active');
  if (!activeFilter && document.querySelector('.issue-filter[data-filter="all"]')) {
    document.querySelector('.issue-filter[data-filter="all"]').classList.add('active');
  }
  
  applyIssueFilter();
}

// Add event listeners for issue filter buttons
document.addEventListener('DOMContentLoaded', function() {
  const filterButtons = document.querySelectorAll('.issue-filter');
  
  filterButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Remove active class from all filter buttons
      filterButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to the clicked button
      button.classList.add('active');
      
      // Apply the filter
      applyIssueFilter();
    });
  });
  
  // Initialize the color legend
  initializeColorLegend();
});

// Helper function to calculate total duration from issues
function calculateTotalDuration(issues) {
  let maxEnd = 0;
  
  // Check all issue types and find the maximum end time
  const checkIssues = (issueArray) => {
    if (!issueArray) return;
    issueArray.forEach(issue => {
      if (issue.end && issue.end > maxEnd) {
        maxEnd = issue.end;
      }
    });
  };
  
  checkIssues(issues.fillers);
  checkIssues(issues.pauses);
  checkIssues(issues.repetitions);
  checkIssues(issues.mispronunciation);
  checkIssues(issues.grammar);
  
  // If no issues with timestamps, default to 60 seconds
  return maxEnd > 0 ? maxEnd : 60;
}

// Function to skip to previous section
function skipPrevious() {
  // Skip back 10 seconds
  audioPlayer.currentTime = Math.max(0, audioPlayer.currentTime - 10);
  currentAudioTime = audioPlayer.currentTime;
  updateTimeDisplay();
}

// Function to skip to next section
function skipNext() {
  // Skip forward 10 seconds
  audioPlayer.currentTime = Math.min(audioPlayer.duration, audioPlayer.currentTime + 10);
  currentAudioTime = audioPlayer.currentTime;
  updateTimeDisplay();
}

// Function to highlight the section of transcript currently being played
function highlightCurrentTranscriptSection() {
  const currentTime = audioPlayer.currentTime;
  let foundActiveElement = false;
  
  // Clear previous active highlights
  clearActiveHighlights();
  
  // First, check for exact word matches by time
  document.querySelectorAll('.word-timestamp').forEach(element => {
    const timestampData = element.getAttribute('data-timestamp');
    if (timestampData) {
      const [start, end] = timestampData.split(':').map(Number);
      
      if (currentTime >= start && currentTime <= end) {
        element.classList.add('currently-playing');
        foundActiveElement = true;
      }
    }
  });
  
  // If no word is active, check for annotations (pauses, fillers, etc.)
  if (!foundActiveElement) {
    document.querySelectorAll('.highlight:not(.word-timestamp)').forEach(element => {
      const timestampData = element.getAttribute('data-timestamp');
      if (timestampData) {
        const [start, end] = timestampData.split(':').map(Number);
        
        if (currentTime >= start && currentTime <= end) {
          element.classList.add('currently-playing');
          foundActiveElement = true;
        }
      }
    });
  }
  
  // When active elements change, scroll to keep them in view
  const activeElement = document.querySelector('.currently-playing');
  if (activeElement) {
    // Only scroll if the element is not already in the visible area
    const container = document.querySelector('.flex-1.overflow-y-auto.px-6.pb-36');
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const elementRect = activeElement.getBoundingClientRect();
      
      // Check if element is not fully visible
      if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
}

// Function to clear active highlights
function clearActiveHighlights() {
  document.querySelectorAll('.currently-playing, .word-active').forEach(el => {
    el.classList.remove('currently-playing');
    el.classList.remove('word-active');
  });
}

// Add event listeners to all word timestamps
function attachWordTimestampClickHandlers() {
  document.querySelectorAll('.word-timestamp').forEach(word => {
    word.addEventListener('click', handleWordTimestampClick);
  });
}

// Handle word timestamp click
function handleWordTimestampClick(e) {
  e.stopPropagation();
  
  const timestampData = this.getAttribute('data-timestamp');
  if (timestampData) {
    const [start] = timestampData.split(':').map(Number);
    
    // Jump to the audio position
    audioPlayer.currentTime = start;
    currentAudioTime = start;
    updateTimeDisplay();
    
    // Play the audio from that point
    if (!isPlaying) {
      startPlayback();
    }
    
    // Add visual indicator to show which word was clicked
    document.querySelectorAll('.word-active').forEach(el => {
      el.classList.remove('word-active');
    });
    this.classList.add('word-active');
  }
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
  // Use the actual audio file in the sound directory
  audioPlayer.currentTime = currentAudioTime;
  
  audioPlayer.onplay = () => {
    isPlaying = true;
    playBtn.innerHTML = '<i class="material-icons">pause</i>';
  };
  
  audioPlayer.onpause = () => {
    isPlaying = false;
    playBtn.innerHTML = '<i class="material-icons">play_arrow</i>';
    currentAudioTime = audioPlayer.currentTime;
  };
  
  audioPlayer.onended = () => {
    isPlaying = false;
    playBtn.innerHTML = '<i class="material-icons">play_arrow</i>';
    currentAudioTime = 0;
    updateProgressBar(0);
    clearActiveHighlights();
  };
  
  audioPlayer.ontimeupdate = () => {
    const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    updateProgressBar(percent);
    updateTimeDisplay();
    highlightCurrentTranscriptSection();
  };

  // Load audio duration once it's available
  audioPlayer.onloadedmetadata = () => {
    updateTimeDisplay();
  };
  
  audioPlayer.play();
}

function pausePlayback() {
  audioPlayer.pause();
}

function seekAudio(e) {
  const percent = (e.offsetX / progressBar.offsetWidth) * 100;
  updateProgressBar(percent);
  
  audioPlayer.currentTime = (percent / 100) * audioPlayer.duration;
  currentAudioTime = audioPlayer.currentTime;
  updateTimeDisplay();
}

function updateProgressBar(percent) {
  progressIndicator.style.width = `${percent}%`;
  progressHandle.style.left = `${percent}%`;
}

// Function to update the time display
function updateTimeDisplay() {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (currentTimeEl) {
    currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
  }
  
  if (durationEl) {
    durationEl.textContent = formatTime(audioPlayer.duration);
  }
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

  if (e.target === annotationModal) {
    hideAnnotationModal();
  }
});

// Enable text selection in patient speech
document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  if (selection.toString().trim() && selection.anchorNode) {
    // Check if selection is within a patient message bubble
    let containerElement = selection.anchorNode;
    while (containerElement && containerElement.nodeName !== 'DIV') {
      containerElement = containerElement.parentNode;
    }
    
    if (containerElement && containerElement.classList.contains('patient')) {
      // Make the annotate button more visible when text is selected
      annotateBtn.classList.add('animate-pulse');
      setTimeout(() => {
        annotateBtn.classList.remove('animate-pulse');
      }, 1500);
    }
  }
});

// Load saved sidebar state with improved animation
function loadSidebarState() {
  try {
    // Load left sidebar state
    const leftSidebarVisible = localStorage.getItem('leftSidebarVisible');
    if (leftSidebarVisible === 'false') {
      leftSidebar.style.width = '0px';
      leftSidebar.classList.add('sidebar-collapsed');
      showLeftSidebar.classList.remove('hidden');
      showLeftSidebar.classList.add('flex');
    } else {
      // Ensure fixed width
      leftSidebar.style.width = '15rem'; // 60 * 0.25 = 15rem
    }
    
    // Load right sidebar state
    const rightSidebarVisible = localStorage.getItem('rightSidebarVisible');
    if (rightSidebarVisible === 'false') {
      rightSidebar.style.width = '0px';
      rightSidebar.classList.add('sidebar-collapsed');
      showRightSidebar.classList.remove('hidden');
      showRightSidebar.classList.add('flex');
    } else {
      // Ensure fixed width
      rightSidebar.style.width = '20rem'; // 80 * 0.25 = 20rem
    }
  } catch (e) {
    console.warn('Failed to load sidebar state from localStorage', e);
    // Reset to defaults on error
    leftSidebar.style.width = '15rem';
    rightSidebar.style.width = '20rem';
  }
}

// Analysis functions
function sendAudioForAnalysis(audioData) {
  socket.emit('analyze-speech', audioData);
  
  // Show loading state - you could add a loading indicator here
  
  // Listen for analysis results
  socket.once('analysis-results', handleAnalysisResults);
}

function handleAnalysisResults(results) {
  console.log('Analysis results:', results);
  
  // Update metrics
  document.querySelector('.metric-card:nth-child(1) .text-2xl').textContent = results.totalIssues || '25';
  document.querySelector('.metric-card:nth-child(2) .text-2xl').textContent = results.duration || '1:17';
  
  const speechRateElement = document.querySelector('.bg-white.rounded-lg.p-5.text-center .text-4xl');
  const rateQualityElement = document.querySelector('.rate-quality');
  
  if (speechRateElement) {
    speechRateElement.textContent = results.speechRate || '100';
  }
  
  if (rateQualityElement) {
    // Set quality indicator based on speech rate
    const speechRate = results.speechRate || 100;
    let qualityText = 'Average';
    let qualityClass = 'bg-yellow-100 text-yellow-800';
    
    if (speechRate > 90 && speechRate < 110) {
      qualityText = 'Good';
      qualityClass = 'bg-green-100 text-green-800';
    } else if (speechRate >= 110) {
      qualityText = 'Fast';
      qualityClass = 'bg-blue-100 text-blue-800';
    } else if (speechRate <= 70) {
      qualityText = 'Slow';
      qualityClass = 'bg-red-100 text-red-800';
    }
    
    rateQualityElement.textContent = qualityText;
    rateQualityElement.className = `rate-quality ${qualityClass}`;
  }
  
  // Update issue counts
  if (results.issues) {
    const pauseCount = results.issues.find(i => i.type === 'Pauses')?.count || 14;
    const fillerCount = results.issues.find(i => i.type === 'Filler words')?.count || 6;
    const repetitionCount = results.issues.find(i => i.type === 'Repetition')?.count || 4;
    
    // Update progress bars
    const totalIssues = pauseCount + fillerCount + repetitionCount;
    
    // Pause progress
    const pauseBar = document.querySelector('.space-y-2 .flex:nth-child(1) .flex-1 .h-full');
    const pauseCount_el = document.querySelector('.space-y-2 .flex:nth-child(1) .text-sm.font-medium');
    if (pauseBar && pauseCount_el) {
      pauseBar.style.width = `${(pauseCount / totalIssues) * 100}%`;
      pauseCount_el.textContent = pauseCount;
    }
    
    // Filler words progress
    const fillerBar = document.querySelector('.space-y-2 .flex:nth-child(2) .flex-1 .h-full');
    const fillerCount_el = document.querySelector('.space-y-2 .flex:nth-child(2) .text-sm.font-medium');
    if (fillerBar && fillerCount_el) {
      fillerBar.style.width = `${(fillerCount / totalIssues) * 100}%`;
      fillerCount_el.textContent = fillerCount;
    }
    
    // Repetition progress
    const repetitionBar = document.querySelector('.space-y-2 .flex:nth-child(3) .flex-1 .h-full');
    const repetitionCount_el = document.querySelector('.space-y-2 .flex:nth-child(3) .text-sm.font-medium');
    if (repetitionBar && repetitionCount_el) {
      repetitionBar.style.width = `${(repetitionCount / totalIssues) * 100}%`;
      repetitionCount_el.textContent = repetitionCount;
    }
  }
}

// Annotation functions
function showAnnotationModal() {
  // Get current selection if any, otherwise use default example
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  // Update the modal with the selected text
  const originalTextElement = document.querySelector('#annotationModal .p-3.bg-neutral-lightest');
  
  if (selectedText) {
    selectedTextForAnnotation = {
      text: selectedText,
      range: selection.getRangeAt(0).cloneRange()
    };
    originalTextElement.textContent = selectedText;
    correctedText.value = selectedText; // Start with the selected text
  }
  
  // Show the modal
  annotationModal.classList.remove('hidden');
  annotationModal.classList.add('flex');
}

function hideAnnotationModal() {
  annotationModal.classList.add('hidden');
  annotationModal.classList.remove('flex');
  selectedTextForAnnotation = null;
}

function handleSaveAnnotation() {
  const correction = correctedText.value.trim();
  const type = annotationType.value;
  
  if (!correction) {
    alert('Please enter a correction.');
    return;
  }
  
  if (selectedTextForAnnotation) {
    // Create a span element for the corrected text
    const span = document.createElement('span');
    span.className = `highlight highlight-${type}`;
    span.textContent = correction;
    span.title = `Original: ${selectedTextForAnnotation.text}`;
    
    // If we have a selected range, replace it with our new element
    const range = selectedTextForAnnotation.range;
    range.deleteContents();
    range.insertNode(span);
    
    // Update the total issue count
    const totalIssuesElement = document.querySelector('.metric-card:nth-child(1) .text-2xl');
    if (totalIssuesElement) {
      const currentCount = parseInt(totalIssuesElement.textContent);
      totalIssuesElement.textContent = (currentCount + 1).toString();
    }
    
    // Update the issue count for the specific type
    updateIssueCount(type);
  } else {
    // If no selection, just close the modal
    console.log('No text selected for annotation');
  }
  
  // Close the modal
  hideAnnotationModal();
}

function updateIssueCount(type) {
  // Map the type to the corresponding element
  let countElement;
  
  switch (type) {
    case 'grammar':
      countElement = document.querySelector('.space-y-2 .flex:nth-child(3) .text-sm.font-medium');
      break;
    case 'filler':
      countElement = document.querySelector('.space-y-2 .flex:nth-child(2) .text-sm.font-medium');
      break;
    case 'repetition':
      countElement = document.querySelector('.space-y-2 .flex:nth-child(3) .text-sm.font-medium');
      break;
    case 'mispronunciation':
      // We don't have a specific element for this in the top issues, could add one
      break;
  }
  
  if (countElement) {
    const currentCount = parseInt(countElement.textContent);
    countElement.textContent = (currentCount + 1).toString();
    
    // Also update the progress bar
    const bar = countElement.previousElementSibling.querySelector('.h-full');
    if (bar) {
      // Recalculate percentages based on new values
      const pauseCount = parseInt(document.querySelector('.space-y-2 .flex:nth-child(1) .text-sm.font-medium')?.textContent || '14');
      const fillerCount = parseInt(document.querySelector('.space-y-2 .flex:nth-child(2) .text-sm.font-medium')?.textContent || '6');
      const repetitionCount = parseInt(document.querySelector('.space-y-2 .flex:nth-child(3) .text-sm.font-medium')?.textContent || '4');
      
      const totalCount = pauseCount + fillerCount + repetitionCount;
      
      document.querySelector('.space-y-2 .flex:nth-child(1) .flex-1 .h-full').style.width = `${Math.round((pauseCount / totalCount) * 100)}%`;
      document.querySelector('.space-y-2 .flex:nth-child(2) .flex-1 .h-full').style.width = `${Math.round((fillerCount / totalCount) * 100)}%`;
      document.querySelector('.space-y-2 .flex:nth-child(3) .flex-1 .h-full').style.width = `${Math.round((repetitionCount / totalCount) * 100)}%`;
    }
  }
}

// Process speech text and add highlighting
function processSpeechText(text, issues) {
  if (!text || !issues) return text;
  
  let processedText = text;
  
  // Calculate total duration for timestamp positioning
  const totalDuration = calculateTotalDuration(issues);
  
  // Process fillers
  if (issues.fillers && issues.fillers.length > 0) {
    issues.fillers.forEach((word, index) => {
      const regex = new RegExp(`\\b${word.text}\\b`, 'gi');
      processedText = processedText.replace(regex, `<span class="highlight highlight-filler filler${index+1}" data-timestamp="${word.start}:${word.end}" data-type="filler">${word.text}</span>`);
    });
  }
  
  // Process repetitions
  if (issues.repetitions && issues.repetitions.length > 0) {
    issues.repetitions.forEach((repetition, index) => {
      const regex = new RegExp(`\\b${repetition.text}\\b`, 'gi');
      processedText = processedText.replace(regex, `<span class="highlight highlight-repetition repetition${index+1}" data-timestamp="${repetition.start}:${repetition.end}" data-type="repetition">${repetition.text}</span>`);
    });
  }
  
  // Process mispronunciations
  if (issues.mispronunciation && issues.mispronunciation.length > 0) {
    issues.mispronunciation.forEach((word, index) => {
      const regex = new RegExp(`\\b${word.text}\\b`, 'gi');
      processedText = processedText.replace(regex, `<span class="highlight highlight-mispronunciation mispronunciation${index+1}" data-timestamp="${word.start}:${word.end}" data-type="mispronunciation">${word.text}</span>`);
    });
  }
  
  // Process grammar issues
  if (issues.grammar && issues.grammar.length > 0) {
    issues.grammar.forEach((word, index) => {
      const regex = new RegExp(`\\b${word.text}\\b`, 'gi');
      processedText = processedText.replace(regex, `<span class="highlight highlight-grammar grammar${index+1}" data-timestamp="${word.start}:${word.end}" data-type="grammar">${word.text}</span>`);
    });
  }
  
  // Process pauses
  if (issues.pauses && issues.pauses.length > 0) {
    // Sort pauses by start time
    const sortedPauses = [...issues.pauses].sort((a, b) => a.start - b.start);
    
    // Calculate suitable positions for pauses
    const textChunks = processedText.split('. '); // Split by sentence
    
    // If we have more pauses than sentences, some will be placed after spaces
    let currentPosition = 0;
    let positions = [];
    
    // First, try to place pauses after sentences
    for (let i = 0; i < textChunks.length - 1 && i < sortedPauses.length; i++) {
      currentPosition += textChunks[i].length + 2; // +2 for the '. '
      positions.push(currentPosition - 1); // -1 to place right after the period
    }
    
    // If we need more positions, try to place after spaces
    if (positions.length < sortedPauses.length) {
      const words = processedText.split(' ');
      currentPosition = 0;
      
      for (let i = 0; i < words.length - 1 && positions.length < sortedPauses.length; i++) {
        currentPosition += words[i].length + 1; // +1 for the space
        // Skip if this position is already after a sentence
        if (!positions.includes(currentPosition - 1)) {
          positions.push(currentPosition);
        }
      }
    }
    
    // Ensure positions are sorted and unique
    positions = [...new Set(positions)].sort((a, b) => a - b);
    
    // Limit positions to the number of pauses we have
    positions = positions.slice(0, sortedPauses.length);
    
    // Insert pauses at the calculated positions
    // Insert from end to beginning to avoid changing positions
    for (let i = positions.length - 1; i >= 0; i--) {
      const pause = sortedPauses[i];
      const pauseElement = `<span class="highlight highlight-pause pause${i+1}" data-timestamp="${pause.start}:${pause.end}" data-type="pause">...</span>`;
      
      const position = positions[i];
      if (position < processedText.length) {
        processedText = processedText.substring(0, position) + 
                        pauseElement + 
                        processedText.substring(position);
      }
    }
  }
  
  return processedText;
}

function displayTranscript(transcript) {
  const conversationContainer = document.querySelector('.flex-1.overflow-y-auto.px-6.pb-36 .space-y-5');
  if (!conversationContainer || !transcript) return;
  
  // Clear existing conversation
  conversationContainer.innerHTML = '';
  
  // Add each segment to the conversation
  transcript.forEach(segment => {
    const speakerType = segment.speaker.toLowerCase() === 'child' ? 'patient' : 'doctor';
    const speakerName = segment.speaker.toLowerCase() === 'child' ? 'Patient' : 'Examiner';
    const issueHighlightedText = speakerType === 'patient' ? processSpeechText(segment.text, segment) : segment.text;
    
    const segmentHTML = `
      <div class="relative">
        <div class="font-medium mb-1">${speakerName}</div>
        <div class="message-bubble ${speakerType}">
          ${issueHighlightedText}
        </div>
      </div>
    `;
    
    conversationContainer.innerHTML += segmentHTML;
  });
  
  // Attach click handlers to newly added highlights
  attachAnnotationClickHandlers();
  
  // Populate the Issues tab with the new highlights
  populateIssueItems();
} 