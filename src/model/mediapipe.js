import { Holistic, POSE_CONNECTIONS, HAND_CONNECTIONS } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { io } from "socket.io-client";


const socket = io('http://127.0.0.1:5000') 

class PoseTracker {
  constructor() {
    // Get thre video reference from html to where video will be streamed
    this.perArea = document.querySelector('.performPrediction')
    this.videoElement = document.getElementById('videoElement'); 
    
    // Canvas element to dynamically draw the lines and landmarks of mediapipe model
    this.canvasElement = document.createElement('canvas');

    // Same thing?
    this.canvasCtx = this.canvasElement.getContext('2d');

    // Button references. Used to disable one when one is active and vice verse
    this.startButton = document.getElementById('startButton');
    this.stopButton = document.getElementById('stopButton');
    this.backButton = document.getElementById('backButton')

    this.detailsSection = document.querySelector('.signDetails')
    
    // Get the right-column div to append the canvas as that it's displayed there
    const rightColumn = document.querySelector('.right-column .top-section');
    rightColumn.appendChild(this.canvasElement);

    // Holds the current video stream
    this.currentStream = null;

    // The mediapipe pose model instance
    this.model = null

    // The camera instance that handles the video feed.
    this.camera = null;

    // A flag to check if the pose detection is currently active.
    this.isTracking = false;
    // this.gestureModel = null

    this.frameBuffer = [];
    this.maxFrames = 30;

    // Method that sets up event listeners for the start and stop buttons, to trigger the camera start/stop logic.
    this.initializeEventListeners();
  }

  // Self_Explanatory
  initializeEventListeners() {
    this.startButton.addEventListener('click', () => this.startCamera());
    this.stopButton.addEventListener('click', () => this.stopCamera());
  }

  // Initializes the mediapipe pose model
  async initializeModel() {
    // If pose model is already initialized, destroy it first
    if (this.model) {
      await this.model.close();
        this.model = null
    }

    // Creates a new instance of the pose model
    this.model = new Holistic({
      // Locates the necessary model files
      locateFile: (file) => {
        return `/node_modules/@mediapipe/holistic/${file}`;
      }
    });
    

    // Model Parameters
    this.model.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      enableFaceGeometry: false
    });

    // The callback function that will handle the results from the pose model. When pose landmarks are detected, the onPoseResults method will be called.
    this.model.onResults(this.onModelResults.bind(this));

    // Wait for the model to be loaded, ensures model is ready before processing any frames
    await this.model.initialize();
  }
  
  captureAndStoreModelLandmarks(modelLandmarks) {
    if (this.isTracking) {
      // Process the pose landmarks (flatten them to match the model input)
      const flattenedLandmarks = modelLandmarks.map(landmark => [
        landmark.x, landmark.y, landmark.z, landmark.visibility
      ]).flat();

      this.frameBuffer.push(flattenedLandmarks);

      // If the buffer exceeds the maximum frame count, remove the oldest frame
      if (this.frameBuffer.length > this.maxFrames) {
        this.frameBuffer.shift();
      }

      // If the buffer is full (30 frames), send the landmarks to the server
      if (this.frameBuffer.length === this.maxFrames) {
        this.sendPoseLandmarksToServer();
      }
    }
  }

  // Send pose landmarks to the server
  sendPoseLandmarksToServer() {
    socket.emit("process", { landmarks: this.frameBuffer });

    // Clear the buffer after sending
    this.frameBuffer = [];
  }
  

  async recognizeGesture() {
    socket.on('processed_data', (response) => {
      this.detailsSection.innerHTML = "Predicted Gesture: " + response.gesture + "<br>With confidence of: " + response.confidence.toFixed(2)
      const gestureResponse = response.gesture
      if (this.perArea.innerHTML === gestureResponse) {
        this.perArea.style.color = 'green'
      }
    });
    // Print the label corresponding to the class with the highest prediction value
  }

  // Function that gets called with the results from the pose detection model.
  onModelResults(results) {
    // Only process results if tracking is active
    if (!this.isTracking) return;

    // Clear the canvas or the previous frame
    this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    
    // console.log(results)
    // If pose landmarks are detected, draw the skeleton
    if (results.poseLandmarks) {
      // Draw connectors (lines between joints)
      drawConnectors(
        this.canvasCtx, 
        results.poseLandmarks, 
        POSE_CONNECTIONS,
        { color: 'white', lineWidth: 3 }
      );

      drawConnectors(
        this.canvasCtx, 
        results.leftHandLandmarks, 
        HAND_CONNECTIONS,
        { color: 'white', lineWidth: 3 }
      );

      drawConnectors(
        this.canvasCtx, 
        results.rightHandLandmarks, 
        HAND_CONNECTIONS,
        { color: 'white', lineWidth: 3 }
      );

      // this.preprocessPoseData(results.poseLandmarks);
      // this.recognizeGesture()
      this.captureAndStoreModelLandmarks(results.poseLandmarks);
      this.recognizeGesture() 
    }
  }

  // starts the camera and begins pose tracking
  async startCamera() {
    // Prevent multiple start calls
    if (this.isTracking) return;

    // Initializes the pose model before starting the camera
    await this.initializeModel();

    try {

      // Requests the user's webcam stream using the getUserMedia API. Once obtained, it sets the videoElement's srcObject to the webcam stream.
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.videoElement.srcObject = stream;
      this.currentStream = stream;

      // Set canvas size to match video
      this.canvasElement.width = this.videoElement.videoWidth || 640;
      this.canvasElement.height = this.videoElement.videoHeight || 480;
      
      this.videoElement.style.transform = 'scaleX(-1)'; // Flip video horizontally
      this.canvasElement.style.transform = 'scaleX(-1)'; // Flip canvas horizontally
      
      const overlay = document.createElement('div');
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.borderRadius = '10px';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';  // Semi-transparent black (0.5 is opacity)
      overlay.style.zIndex = '9';  // Overlay under canvas, but above video
      this.videoElement.parentElement.appendChild(overlay);
      this.overlay = overlay

      this.canvasElement.style.position = 'absolute';
      this.canvasElement.style.top = '0';
      this.canvasElement.style.left = '0';
      this.canvasElement.style.width = '100%';
      this.canvasElement.style.height = '100%';
      this.canvasElement.style.zIndex = '10';

      // Creates camera instance
      this.camera = new Camera(this.videoElement, {
        onFrame: async () => {
          await this.model.send({ image: this.videoElement });
        },
        width: 640,
        height: 480
      });

      // Starts camera and begins processing frames for pose detection
      this.camera.start();
      this.isTracking = true;
      this.startButton.disabled = true;
      this.stopButton.disabled = false;
      this.backButton.disabled = true;


    } catch (error) {
      console.error('Error accessing the camera:', error);
      this.isTracking = false;
    }
  }

  stopCamera() {
    if (!this.isTracking) return;

    if(this.overlay) {
      this.overlay.remove()
    }

    if (this.camera) {
      this.camera.stop();
    }

    if (this.currentStream) {
      const tracks = this.currentStream.getTracks();
      tracks.forEach(track => track.stop());
      this.videoElement.srcObject = null;
    }
    
    // Clear the canvas
    this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    
    // Reset tracking state
    this.isTracking = false;
    this.startButton.disabled = false;
    this.stopButton.disabled = true;
    this.backButton.disabled = false;

    // Optional: Close the pose model to ensure clean restart
    if (this.model) {
      this.model.close();
      this.model = null;
    }
  }
}

// Initialize the PoseTracker when the page loads
window.addEventListener('load', () => {
  const poseTracker = new PoseTracker();
});
