const ffmpeg = require('fluent-ffmpeg');
const http = require('http');

// Video URLs to stream in sequence
const videoURLs = [
  'http://www.vidce.net/d/qU9r-oSj_GYS1Ekb6G336Q/1737585246/video/Tom_and_Jerry_Magical_Misadventures/1x01.mp4',
  'http://www.cdn.vidce.net/d/AHCO4D-Jx6advRYe94Yj1w/1738450425/video/Grizzy_and_the_Lemmings/1x01.mp4',
  'http://www.cdn.vidce.net/d/bI1zX41i_NaNPisIG-89HA/1737504319/video/Lego_Friends/1x01.mp4'
];

// Stream index to loop through videos
let currentVideoIndex = 0;
let ffmpegProcess = null;
let clients = []; // To track clients that are connected

// Function to create a persistent stream
const createContinuousStream = () => {
  if (ffmpegProcess) return; // Ensure we don't create multiple FFmpeg processes

  // Create the FFmpeg process and begin streaming
  ffmpegProcess = ffmpeg();

  // Add the video in sequence to the stream
  ffmpegProcess.input(videoURLs[currentVideoIndex]);

  ffmpegProcess
    .outputFormat('mpegts')
    .videoCodec('libx264')
    .audioCodec('aac')
    .outputOptions('-f', 'mpegts', '-tune', 'zerolatency', '-preset', 'fast') // Optimize for streaming with lower latency
    .on('end', () => {
      console.log('Video completed, moving to next video');
      // Move to the next video in the sequence after one ends
      currentVideoIndex = (currentVideoIndex + 1) % videoURLs.length; // Loop to the first video after the last one
      createContinuousStream(); // Restart the stream
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err);
      // Try restarting the stream in case of failure
      ffmpegProcess = null; // Reset FFmpeg process
      createContinuousStream(); // Restart the stream
    });

  // Start the FFmpeg process and pipe to a writable stream
  const streamOutput = ffmpegProcess.pipe();
  streamOutput.on('data', (chunk) => {
    // When data is available from the FFmpeg process, pipe it to all connected clients
    clients.forEach(client => client.write(chunk));
  });

  ffmpegProcess.run(); // Ensure the process runs independently
};

// Start the continuous stream in the background
createContinuousStream(); // This ensures the video keeps playing 24/7

// Start the HTTP server to serve the stream
const server = http.createServer((req, res) => {
  if (req.url === '/stream') {
    console.log("Client connected to stream");

    res.writeHead(200, {
      'Content-Type': 'video/mp2t',
      'Transfer-Encoding': 'chunked'
    });

    // Store the response stream for each client
    clients.push(res);

    // Pipe the persistent video stream to all connected clients
    if (!ffmpegProcess) {
      res.end();
    }

    // Handle disconnection
    req.on('close', () => {
      console.log('Client disconnected');
      // Remove the client from the list
      clients = clients.filter(client => client !== res);
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Start the server on port 3000
const port = process.env.PORT || 3000; // Use PORT from environment variable, default to 3000 if not set
server.listen(port, '0.0.0.0', () => {
  console.log(`Streaming server running at:`);
  console.log(`👉 MPEG-TS Stream: http://your-app-url.herokuapp.com:${port}/stream`);
});

