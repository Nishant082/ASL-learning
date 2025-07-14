from flask import Flask
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import numpy as np
import tensorflow as tf
import time

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})
socketio = SocketIO(app, cors_allowed_origins="http://localhost:5173")
#
model = tf.keras.models.load_model('action (1).h5')

gestures = ['Name', 'I/Me', 'Hello', 'Goodbye']


@socketio.on('connect')
def handle_connect():
    print("Client connected")
    emit('message', {'status': 'Connected to server'})


@socketio.on('process')
def handle_video_frames(data):
    landmarks = np.array(data['landmarks'])
    input_data = landmarks.reshape(1, 30, 132)

    prediction = model.predict(input_data)
    predicted_class_index = np.argmax(prediction)
    predicted_gesture = gestures[predicted_class_index]

    prediction_list = prediction.tolist()

    response = {
        'status': 'Processing complete',
        'message': 'Gesture recognized',
        'predictions': prediction_list,
        'gesture': predicted_gesture,
        'confidence': float(prediction[0][predicted_class_index])
    }

    # Send the processed response back to the client
    emit('processed_data', response)


if __name__ == "__main__":
    socketio.run(app, allow_unsafe_werkzeug=True, debug=True)
