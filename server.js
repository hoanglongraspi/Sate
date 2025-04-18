const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Set up middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configure multer for audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public/uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an audio file!'), false);
    }
  }
});

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.post('/upload', upload.single('audio'), (req, res) => {
  // Process the uploaded audio file
  res.json({ 
    success: true, 
    filename: req.file.filename,
    path: `/uploads/${req.file.filename}`
  });
});

// WebSocket for real-time speech analysis
io.on('connection', (socket) => {
  console.log('A user connected');
  
  socket.on('analyze-speech', (audioData) => {
    // Mock analysis results
    const results = {
      duration: '5:41',
      totalIssues: 12,
      speechRate: 100,
      topIssues: {
        syllable: 3,
        filterWords: 3,
        grammar: 2
      },
      transcript: [
        {role: 'Doctor', text: 'So, how have your classes been going this semester?'},
        {role: 'Patient', text: 'Um, it\'s been... okay, I guess. I\'ve had some trouble with, uh, communimacation—communication in presentations.'},
        {role: 'Doctor', text: 'Presentations? Can you explain more?'},
        {role: 'Patient', text: 'Yeah, like... when I speak, sometimes I say the same thing again, I say the same thing again without noticing. And I pause a lot. Like I\'ll be mid-sentence and just...stop...and, uh....yeah.'},
        {role: 'Doctor', text: 'That sounds stressful. Anything else?'},
        {role: 'Patient', text: 'I also get stuck on w-w-w-words sometimes. Especially when I\'m nervous. And my grammar\'s weird when I\'m under pressure—like I\'ll say things like, "He don\'t know what happened" instead of the right way.'}
      ],
      issues: [
        {type: 'Mispronunciation', time: '1:15'},
        {type: 'Grammar', time: '2:30'},
        {type: 'Pauses', time: '3:20'},
        {type: 'Repetition', time: '3:45'},
        {type: 'Filler words', time: '4:10'}
      ]
    };
    
    socket.emit('analysis-results', results);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Create uploads directory if it doesn't exist
const fs = require('fs');
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 