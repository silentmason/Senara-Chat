// REMEMBER TO REPLACE 'YOUR_ABLY_API_KEY' WITH YOUR ABLY API KEY and import config
const ably = new Ably.Realtime({
  key: 'XRHh7Q.QGrriA:3QlMEmxAp2POdgbMdec3-6pV1R3QOJ82wGLsRE4tDLU'
});
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
const themeKey = 'theme'; // Add a key for the theme
let googleUserLoaded = false;

// Load username, avatar, and theme from localStorage on page load
if (localStorage.getItem(usernameKey)) {
  usernameInput.value = localStorage.getItem(usernameKey);
}
if (localStorage.getItem(avatarKey)) {
  avatarIcon.src = localStorage.getItem(avatarKey);
  avatarSelect.value = localStorage.getItem(avatarKey);
}
// Load theme
if (localStorage.getItem(themeKey)) {
  document.body.setAttribute('data-theme', localStorage.getItem('theme'));
  darkModeToggle.textContent = localStorage.getItem('theme') === 'dark' ? 'Toggle Light Mode' : 'Toggle Dark Mode';
}

settingsButton.addEventListener('click', toggleSettingsMenu);
darkModeToggle.addEventListener('click', toggleDarkMode);

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
  channel.publish('message', {
    text: messageText
  });
  messageInput.value = '';
}

channel.subscribe('message', function(message) {
  const messageElement = document.createElement('p');
  messageElement.textContent = message.data.text;
  chatArea.appendChild(messageElement);
  chatArea.scrollTop = chatArea.scrollHeight;
});

const configuration = {
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302'
  }]
};

async function startWebRTC() {
  peerConnection = new RTCPeerConnection(configuration);

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      channel.publish('ice-candidate', {
        candidate: event.candidate
      });
    }
  };

  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
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

  channel.subscribe('ice-candidate', message => {
    peerConnection.addIceCandidate(message.data.candidate);
  });

  channel.subscribe('offer', message => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.sdp))
      .then(() => peerConnection.createAnswer())
      .then(answer => peerConnection.setLocalDescription(answer))
      .then(() => {
        channel.publish('answer', {
          sdp: peerConnection.localDescription
        });
      });
  });

  channel.subscribe('answer', message => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
  });

  if (isCaller()) {
    peerConnection.createOffer()
      .then(offer => peerConnection.setLocalDescription(offer))
      .then(() => {
        channel.publish('offer', {
          sdp: peerConnection.localDescription
        });
      });
  }
}

function isCaller() {
  return Math.random() < 0.5;
}

startWebRTC();

// Function to decode a JWT token (https://jwt.io/)\
function decodeJwtResponse(token) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  return JSON.parse(jsonPayload);
}
//Google Signin
function onSignIn(response) {

  // Decodes the ID token to get the user's profile
    const profile = decodeJwtResponse(response.credential);
    console.log("profile", profile);

    sessionStorage.setItem('signedIn', 'true');
    hideLoginModal();
}

// Function to show the login modal
function showLoginModal() {
  $(loginModal).modal('show'); // Requires jQuery
}
// Function to hide the login modal
function hideLoginModal() {
  $(loginModal).modal('hide'); // Requires jQuery
}

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

//Google one tap sign in
window.onload = function() {
  google.accounts.id.initialize({
    client_id: "691636065786-dtr3orgvt0jma5urcbp35dlspuarfn58.apps.googleusercontent.com", //REMEMEBR TO REPLACE
    callback: onSignIn
  });
  google.accounts.id.prompt();

  // Listen for sign-in events and close the modal
  signInButtonModal.addEventListener('click', function() {
    // Open the one-tap sign-in dialog
    google.accounts.id.prompt(onSignIn);

  });

  //Check if signed in if not, load model
  if (!sessionStorage.getItem('signedIn')) {
    showLoginModal();
  }
}