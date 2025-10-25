// Import config (This line assumes you have a config.js)
// import config from './config.js';

// REMEMBER TO REPLACE 'YOUR_ABLY_API_KEY' WITH YOUR ABLY API KEY and import config
const ably = new Ably.Realtime({ key: 'XRHh7Q.QGrriA:3QlMEmxAp2POdgbMdec3-6pV1R3QOJ82wGLsRE4tDLU' });
const channel = ably.channels.get('my-chat-channel');

const chatArea = document.getElementById('chat-area');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const signInButton = document.getElementById("signInButton");
const settingsButton = document.getElementById('settingsButton');
const settingsMenu = document.getElementById('settingsMenu');
const usernameInput = document.getElementById('username');
const avatarSelect = document.getElementById('avatarSelect');
const avatarIcon = document.getElementById('avatarIcon');
const darkModeToggle = document.getElementById('darkModeToggle');
const loginModal = document.getElementById('loginModal');
const signInButtonModal = document.getElementById('signInButtonModal');

const usernameKey = 'username';
const avatarKey = 'avatar';

// Load username and avatar from localStorage on page load
if (localStorage.getItem(usernameKey)) {
    usernameInput.value = localStorage.getItem(usernameKey);
}
if (localStorage.getItem(avatarKey)) {
    avatarIcon.src = localStorage.getItem(avatarKey);
    avatarSelect.value = localStorage.getItem(avatarKey);
}

settingsButton.addEventListener('click', toggleSettingsMenu);
darkModeToggle.addEventListener('click', toggleDarkMode);

function toggleSettingsMenu() {
    settingsMenu.style.display = settingsMenu.style.display === 'none' ? 'block' : 'none';
}

usernameInput.addEventListener('change', function () {
    localStorage.setItem(usernameKey, usernameInput.value);
});

avatarSelect.addEventListener('change', function () {
    avatarIcon.src = avatarSelect.value;
    localStorage.setItem(avatarKey, avatarSelect.value);
});

sendButton.addEventListener('click', sendMessage);

function sendMessage() {
    const messageText = messageInput.value;
    channel.publish('message', { text: messageText });
    messageInput.value = '';
}

channel.subscribe('message', function (message) {
    const messageElement = document.createElement('p');
    messageElement.textContent = message.data.text;
    chatArea.appendChild(messageElement);
    chatArea.scrollTop = chatArea.scrollHeight;
});

const configuration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

async function startWebRTC() {
    peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            channel.publish('ice-candidate', { candidate: event.candidate });
        }
    };

    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = stream;
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

    if (isCaller()) {
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {
                channel.publish('offer', { sdp: peerConnection.localDescription });
            });
    }
}

function isCaller() {
    return Math.random() < 0.5;
}

startWebRTC();

//Google Signin

function onSignIn(googleUser) {
  var profile = googleUser.getBasicProfile();
  console.log('ID: ' + profile.getId()); // Do not send to your backend! Use an ID token instead.
  console.log('Name: ' + profile.getName());
  console.log('Image URL: ' + profile.getImageUrl());
  console.log('Email: ' + profile.getEmail()); // This is null if the 'email' scope is not present.
    sessionStorage.setItem('signedIn', 'true');
    hideLoginModal();
}

function signOut() {
    var auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () {
      console.log('User signed out.');
    });
  }

  gapi.load('auth2', function() {
    gapi.auth2.init({
      client_id: '691636065786-dtr3orgvt0jma5urcbp35dlspuarfn58.apps.googleusercontent.com' // REMEMBER TO REPLACE 'YOUR_GOOGLE_CLIENT_ID' WITH YOUR GOOGLE CLIENT ID
    });
  });

  function toggleDarkMode() {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    darkModeToggle.textContent = newTheme === 'dark' ? 'Toggle Light Mode' : 'Toggle Dark Mode';
    localStorage.setItem('theme', newTheme);
}

// Load theme from localStorage on page load
if (localStorage.getItem('theme')) {
    document.body.setAttribute('data-theme', localStorage.getItem('theme'));
    darkModeToggle.textContent = localStorage.getItem('theme') === 'dark' ? 'Toggle Light Mode' : 'Toggle Dark Mode';
}

// Function to show the login modal
function showLoginModal() {
    $(loginModal).modal('show'); // Requires jQuery
}

// Function to hide the login modal
function hideLoginModal() {
    $(loginModal).modal('hide'); // Requires jQuery
}

//Check if signed in if not, load model
window.onload = function() {
    if (!sessionStorage.getItem('signedIn')) {
        showLoginModal();
    }
}

// Listen for sign-in events and close the modal
signInButtonModal.addEventListener('click', function() {
    var auth2 = gapi.auth2.getAuthInstance();
    auth2.signIn().then(function() {
        onSignIn(auth2.currentUser.get());
    });
});
