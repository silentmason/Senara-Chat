<template>
  <div>
    <h1>Chatting Website</h1>

    <div style="position: absolute; top: 10px; right: 10px;">
      <button v-if="!isSignedIn" @click="signInWithGoogle">Sign In with Google</button>
      <button v-else @click="signOut">Sign Out</button>
      <button @click="toggleSettingsMenu" class="settings-button">
        <img :src="selectedAvatar" alt="Avatar" style="width: 30px; height: 30px; vertical-align: middle;">
        ⚙️
      </button>

      <div v-if="showSettingsMenu" class="settings-menu" style="position: absolute; top: 40px; right: 0; border: 1px solid #ccc; background-color: white; padding: 10px; z-index: 1;">
        <div>
          <label for="username">Username:</label>
          <input type="text" id="username" v-model="username" />
        </div>

        <div>
          <label>Avatar:</label>
          <select v-model="selectedAvatar">
            <option value="avatar1.png">Avatar 1</option>
            <option value="avatar2.png">Avatar 2</option>
            <option value="avatar3.png">Avatar 3</option>
          </select>
        </div>
      </div>
    </div>

    <h2>Online Users</h2>
    <div id="presence-list">
      <div v-for="member in presenceMembers" :key="member.clientId">
        <img :src="member.data.avatar" alt="Avatar" style="width: 20px; height: 20px;">
        {{ member.data.username }}
      </div>
    </div>

    <div id="chat-area" style="height: 200px; overflow-y: scroll; border: 1px solid black;" ref="chatAreaRef">
      <div v-for="(message, index) in chatMessages" :key="index">
        <img :src="message.avatar" alt="Avatar" style="width: 20px; height: 20px;">
        <strong>{{ message.username }}:</strong>
        {{ message.text }}
      </div>
    </div>
    <input type="text" v-model="messageInput" @keyup.enter="sendMessage" />
    <button @click="sendMessage">Send</button>
    <div>
      <h2>Local Video</h2>
      <video v-if="localStream" :srcObject="localStream" autoplay muted style="width: 200px;"></video>
    </div>
    <div>
      <h2>Remote Video</h2>
      <video v-if="remoteStream" :srcObject="remoteStream" autoplay style="width: 200px;"></video>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue';

export default {
  setup() {
    const chatMessages = ref([]);
    const messageInput = ref('');
    const localStream = ref(null);
    const remoteStream = ref(null);
    const chatAreaRef = ref(null);
    const peerConnection = ref(null);
    const ablyRef = ref(null);
    const channelRef = ref(null);

    // User-related properties
    const username = ref('');
    const avatars = ref(['avatar1.png', 'avatar2.png', 'avatar3.png']); // Replace with actual avatar URLs
    const selectedAvatar = ref(avatars.value[0]);
    const chatHistoryKey = 'chatHistory';
    const showSettingsMenu = ref(false);
    const isSignedIn = ref(false); // Track sign-in state
    const googleClientId = 'YOUR_GOOGLE_CLIENT_ID';  // Replace with your Google Client ID
    const presenceMembers = ref([]);

    const usernameKey = 'username'; //local storage key
    const avatarKey = 'avatar'; //local storage key

    // Load username and avatar from localStorage on mount
    if (localStorage.getItem(usernameKey)) {
      username.value = localStorage.getItem(usernameKey);
    }
    if (localStorage.getItem(avatarKey)) {
      selectedAvatar.value = localStorage.getItem(avatarKey);
    }

    // Watch username and avatar for changes and persist to localStorage
    watch(username, (newUsername) => {
      localStorage.setItem(usernameKey, newUsername);
    });
    watch(selectedAvatar, (newAvatar) => {
      localStorage.setItem(avatarKey, newAvatar);
    });


    const toggleSettingsMenu = () => {
      showSettingsMenu.value = !showSettingsMenu.value;
    };

    onMounted(() => {
      const ably = new Ably.Realtime({ key: 'YOUR_ABLY_API_KEY' });
      ablyRef.value = ably;
      const channel = ably.channels.get('my-chat-channel');
      channelRef.value = channel;

      // Load chat history from localStorage
      const storedChatHistory = localStorage.getItem(chatHistoryKey);
      if (storedChatHistory) {
        chatMessages.value = JSON.parse(storedChatHistory);
      }

      channel.subscribe('message', message => {
        const newMessage = {
          text: message.data.text,
          username: message.data.username,
          avatar: message.data.avatar
        };
        chatMessages.value.push(newMessage);
        localStorage.setItem(chatHistoryKey, JSON.stringify(chatMessages.value));
        if (chatAreaRef.value) {
          chatAreaRef.value.scrollTop = chatAreaRef.value.scrollHeight;
        }
      });

      const configuration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };

      const pc = new RTCPeerConnection(configuration);
      peerConnection.value = pc;

      pc.onicecandidate = event => {
        if (event.candidate) {
          channel.publish('ice-candidate', { candidate: event.candidate });
        }
      };

      pc.ontrack = event => {
        remoteStream.value = event.streams[0];
      };

      channel.subscribe('ice-candidate', message => {
        pc.addIceCandidate(message.data.candidate);
      });

      channel.subscribe('offer', message => {
        pc.setRemoteDescription(new RTCSessionDescription(message.data.sdp))
          .then(() => pc.createAnswer())
          .then(answer => pc.setLocalDescription(answer))
          .then(() => {
            channel.publish('answer', { sdp: pc.localDescription });
          });
      });

      channel.subscribe('answer', message => {
        pc.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
      });

      async function startLocalStream() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          localStream.value = stream;
          stream.getTracks().forEach(track => pc.addTrack(track, stream));

          if (isCaller()) {
            pc.createOffer()
              .then(offer => pc.setLocalDescription(offer))
              .then(() => {
                channel.publish('offer', { sdp: pc.localDescription });
              });
          }
        } catch (error) {
          console.error(`Error accessing media devices: ${error}`);
        }
      }

      startLocalStream();

      // Add click outside listener
      document.addEventListener('click', handleClickOutside);

      // Initialize Google Sign-In
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleCredentialResponse
      });
      google.accounts.id.prompt(); // You can use prompt() to show the button or render a custom button

       // Presence
      channel.presence.enter({ username: username.value, avatar: selectedAvatar.value });

      channel.presence.subscribe('enter', member => {
        presenceMembers.value = channel.presence.get();
      });

      channel.presence.subscribe('leave', member => {
         presenceMembers.value = channel.presence.get();
      });

      channel.presence.subscribe('update', member => {
         presenceMembers.value = channel.presence.get();
      });

      const getPresence = async () => {
        presenceMembers.value = await channel.presence.get();
      }
      getPresence()

    });

    onUnmounted(() => {
      if (ablyRef.value) {
        ablyRef.value.close();
      }
      if (localStream.value) {
        localStream.value.getTracks().forEach(track => track.stop());
      }
      if (peerConnection.value) {
        peerConnection.value.close();
      }
      document.removeEventListener('click', handleClickOutside);
       channel.presence.leave({ username: username.value, avatar: selectedAvatar.value });
    });

    const sendMessage = () => {
      const messageData = {
        text: messageInput.value,
        username: username.value,
        avatar: selectedAvatar.value
      };
      channelRef.value.publish('message', messageData);
      messageInput.value = '';
    };

    function isCaller() {
      return Math.random() < 0.5;
    }

    //Google Signin
    const handleCredentialResponse = (response) => {
      console.log("Encoded JWT ID token: " + response.credential);
      // Here you can decode JWT token and get user info
      // You'll also want to send this token to your backend for verification
      isSignedIn.value = true;
    }

    const signInWithGoogle = () => {
      google.accounts.id.prompt();
    };

    const signOut = () => {
      //Not fully implemented but would call gapi.auth2.getAuthInstance().signOut()
      isSignedIn.value = false;
    };

    //Close settings if click outside
    const handleClickOutside = (event) => {
      const settingsMenu = document.querySelector('.settings-menu');
      const settingsButton = document.querySelector('.settings-button');

      if (settingsMenu && !settingsMenu.contains(event.target) &&
        settingsButton && !settingsButton.contains(event.target) && showSettingsMenu.value) {
        showSettingsMenu.value = false;
      }
    };

    return {
      chatMessages,
      messageInput,
      localStream,
      remoteStream,
      chatAreaRef,
      username,
      avatars,
      selectedAvatar,
      sendMessage,
      showSettingsMenu,
      toggleSettingsMenu,
      isSignedIn,
      signInWithGoogle,
      signOut,
      presenceMembers
    };
  }
};
</script>

<style scoped>
/* Add scoped styles here */
button {
  background-color: #4CAF50; /* Green */
  border: none;
  color: white;
  padding: 10px 20px;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  font-size: 16px;
  margin: 4px 2px;
  cursor: pointer;
  border-radius: 5px;
}
</style>