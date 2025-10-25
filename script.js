const ably = new Ably.Realtime({ key: 'YOUR_ABLY_API_KEY' }); // Replace with your actual API key
const channel = ably.channels.get('my-chat-channel'); // Choose a channel name

let peerConnection;

function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const messageText = messageInput.value;
    channel.publish('message', { text: messageText });
    messageInput.value = '';
}

channel.subscribe('message', function (message) {
    const chatArea = document.getElementById('chat-area');
    const messageElement = document.createElement('p');
    messageElement.textContent = message.data.text;
    chatArea.appendChild(messageElement);
});

const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

startWebRTC();

async function startWebRTC() {
    peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            channel.publish('ice-candidate', { candidate: event.candidate });
        }
    };

    peerConnection.ontrack = event => {
        const videoArea = document.getElementById('video-area');
        const remoteVideoElement = document.createElement('video');
        remoteVideoElement.srcObject = event.streams[0];
        remoteVideoElement.autoplay = true;
        videoArea.appendChild(remoteVideoElement);
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const videoArea = document.getElementById('video-area');
        const videoElement = document.createElement('video');
        videoElement.srcObject = stream;
        videoElement.autoplay = true;
        videoArea.appendChild(videoElement);

        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
    } catch (error) {
        console.error('Error accessing media devices:', error);
    }

    channel.subscribe('ice-candidate', message => {
        peerConnection.addIceCandidate(message.data.candidate);
    });

    channel.subscribe('offer', message => {
        peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.sdp))
            .then(() => peerConnection.createAnswer())
            .then(answer => peerConnection.setLocalDescription(answer))
            .then(() => {
                channel.publish('answer', { sdp: peerConnection.localDescription });
            });
    });

    channel.subscribe('answer', message => {
        peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
    });

    //Initiate the call if this client is the caller
    if (isCaller()) {
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {
                channel.publish('offer', { sdp: peerConnection.localDescription });
            });
    }
}

// Simple check to determine if this client is the caller.  This should be replaced with a more robust method.
function isCaller() {
    return Math.random() < 0.5; // 50% chance of being the caller
}
