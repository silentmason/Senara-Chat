// script.js
// REMEMBER TO REPLACE 'YOUR_ABLY_API_KEY' WITH YOUR ABLY API KEY and import config
const ably = new Ably.Realtime({
    key: 'XRHh7Q.qwLKgw:8Zu58gbvPatTpQOVhZ4fBvckDwEsWIWqx1E1NYUqbck'
});
const chatArea = document.getElementById('chat-area');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const remoteAudio = document.getElementById('remoteAudio');
const signInButton = document.getElementById('signInButton');
const settingsButton = document.getElementById('settingsButton');
const settingsMenu = document.getElementById('settingsMenu');
const usernameInput = document.getElementById('username');
const avatarSelect = document.getElementById('avatarSelect');
const avatarIcon = document.getElementById('avatarIcon');
const darkModeToggle = document.getElementById('darkModeToggle');
const loginModal = document.getElementById('loginModal');
const signInButtonModal = document.getElementById('signInButtonModal');

// Add these lines to the existing variable declarations:
const roomNameInput = document.getElementById('roomName');
const joinRoomButton = document.getElementById('joinRoomButton');
let currentChannel; // Store the current Ably channel


const usernameKey = 'username';
const avatarKey = 'avatar';
const themeKey = 'theme'; // Add a key for the theme

// Function to decode a JWT token (https://jwt.io/)
function decodeJwtResponse(token) {
  let base64Url = token.split('.')[1];
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  let jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

// Modify the startAll function to accept a room name
function startAll(roomName) {
    // Load username and avatar from localStorage on page load
    if (localStorage.getItem(usernameKey)) {
        usernameInput.value = localStorage.getItem(usernameKey);
    }
    if (localStorage.getItem(avatarKey)) {
        avatarIcon.src = localStorage.getItem(avatarKey);
        avatarSelect.value = localStorage.getItem(avatarKey);
    }
    settingsButton.addEventListener('click', toggleSettingsMenu);

    function toggleSettingsMenu() {
        settingsMenu.style.display = settingsMenu.style.display === 'none' ? 'block' : 'none';
    }

    usernameInput.addEventListener('change', function() {
        localStorage.setItem(usernameKey, usernameInput.value);
    });

    avatarSelect.addEventListener('change', function() {
        avatarIcon.src = avatarSelect.value;
        localStorage.setItem(avatarKey, avatarSelect.value);
    });

    sendButton.addEventListener('click', sendMessage);

    function sendMessage() {
        const messageText = messageInput.value;
        currentChannel.publish('message', {
            text: messageText
        });
        messageInput.value = '';
    }

     // If a channel already exists, detach from it.
    if (currentChannel) {
        currentChannel.detach();
    }

    // Get the Ably channel based on the room name
    currentChannel = ably.channels.get(roomName);

    //All channel subscriptions should be to the currentChannel
    currentChannel.subscribe('message', function(message) {
        const messageElement = document.createElement('p');
        messageElement.textContent = message.data.text;
        chatArea.appendChild(messageElement);
        chatArea.scrollTop = chatArea.scrollHeight;
    });

    async function startWebRTC() {
        const configuration = {
            iceServers: [{
                urls: 'stun:stun.l.google.com:19302'
            }]
        };

    let peerConnection = new RTCPeerConnection(configuration);

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                currentChannel.publish('ice-candidate', {
                    candidate: event.candidate
                });
            }
        };

        peerConnection.ontrack = (event) => {
      console.log('Received remote track');
            remoteAudio.srcObject = event.streams[0];
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            localVideo.srcObject = stream;
            stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
        } catch (error) {
            console.error('Error accessing media devices:', error);
        }

        currentChannel.subscribe('ice-candidate', message => {
            peerConnection.addIceCandidate(message.data.candidate);
        });

        currentChannel.subscribe('offer', message => {
            peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.sdp))
                .then(() => peerConnection.createAnswer())
                .then(answer => peerConnection.setLocalDescription(answer))
                .then(() => {
                    currentChannel.publish('answer', {
                        sdp: peerConnection.localDescription
                    });
                });
        });

        currentChannel.subscribe('answer', message => {
            peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
        });

        if (isCaller()) {
            peerConnection.createOffer()
                .then(offer => peerConnection.setLocalDescription(offer))
                .then(() => {
                    currentChannel.publish('offer', {
                        sdp: peerConnection.localDescription
                    });
                });
        }
    }

    function isCaller() {
        return Math.random() < 0.5;
    }

    startWebRTC(); // Start WebRTC after joining the room
}

// Load theme from localStorage on page load
if (localStorage.getItem('theme')) {
  document.body.setAttribute('data-theme', localStorage.getItem('theme'));
  darkModeToggle.textContent = localStorage.getItem('theme') === 'dark' ? 'Toggle Light Mode' : 'Toggle Dark Mode';
}

function toggleDarkMode() {
  const body = document.body;
  const currentTheme = body.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  body.setAttribute('data-theme', newTheme);
  darkModeToggle.textContent = newTheme === 'dark' ? 'Toggle Light Mode' : 'Toggle Dark Mode';
  localStorage.setItem('theme', newTheme);
}
// Function to show the login modal
function showLoginModal() {
    $(loginModal).modal('show'); // Requires jQuery
}

// Function to hide the login modal
function hideLoginModal() {
    $(loginModal).modal('hide'); // Requires jQuery
}

// Modify onSignIn to pass a default room, or prompt the user
function onSignIn(response) {
    // Decodes the ID token to get the user's profile
    const profile = decodeJwtResponse(response.credential);
  console.log('profile', profile);
    sessionStorage.setItem('signedIn', 'true');
    hideLoginModal();
    //startAll("default-room"); //Remove this line
    startAll();
}

//Google one tap sign in
window.onload = function() {
    google.accounts.id.initialize({
    client_id: '691636065786-dtr3orgvt0jma5urcbp35dlspuarfn58.apps.googleusercontent.com', // REMEMBER TO REPLACE
        callback: onSignIn
    });
    google.accounts.id.prompt();
};

// Add an event listener to the join room button
joinRoomButton.addEventListener('click', function() {
    const roomName = roomNameInput.value;
    if (roomName) {
        startAll(roomName); // Start the application with the specified room
    } else {
        alert('Please enter a room name.');
    }
});

