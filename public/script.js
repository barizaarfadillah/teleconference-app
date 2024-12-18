const socket = io("/");
const chatInputBox = document.getElementById("chat_message");
const all_messages = document.getElementById("all_messages");
const main__chat__window = document.getElementById("main__chat__window");
const videoGrid = document.getElementById("video-grid");
const myVideo = document.createElement("video");
const screenVideo = document.getElementById("screen-video");
const myscreenVideo = document.createElement("video");
myVideo.muted = true;

var peer = new Peer(undefined, {
  path: "/peerjs",
  host: "/",
  port: "3001",
});

let myVideoStream;
let isScreenSharing = false;

var getUserMedia =
  navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia;

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then((stream) => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream);

    peer.on("call", (call) => {
      call.answer(stream);
      const video = document.createElement("video");

      call.on("stream", (userVideoStream) => {
        addVideoStream(video, userVideoStream);
      });
    });

    socket.on("user-connected", (userId, username) => {
      connectToNewUser(userId, stream);

      if (isScreenSharing) {
        socket.emit("start-screen-sharing", USERNAME);
      }
      
      let li = document.createElement("li");
      li.innerHTML = `${username} has joined the room.`;
      all_messages.append(li);
      main__chat__window.scrollTop = main__chat__window.scrollHeight;
    });

    socket.on("user-disconnected", (userId, username) => {
      let li = document.createElement("li");
      li.innerHTML = `${username} has left the room.`;
      all_messages.append(li);
      main__chat__window.scrollTop = main__chat__window.scrollHeight;
      
      // Menghapus video dari DOM berdasarkan username
      removeVideo(userId);
    });

    document.addEventListener("keydown", (e) => {
      if (e.which === 13 && chatInputBox.value != "") {
        socket.emit("message", chatInputBox.value, USERNAME);
        chatInputBox.value = "";
      }
    });

    socket.on("createMessage", (username, msg) => {
      let li = document.createElement("li");
      li.innerHTML = `<strong>${username}</strong> - ${msg}`;
      all_messages.append(li);
      main__chat__window.scrollTop = main__chat__window.scrollHeight;
    });

    socket.on("screen-sharing-started", (username) => {
      if (!isScreenSharing) {
        let li = document.createElement("li");
        li.innerHTML = `<strong>${username}</strong> started screen sharing.`;
        all_messages.append(li);
        main__chat__window.scrollTop = main__chat__window.scrollHeight;
      }
      // Display the shared screen in the video grid
      screenVideo.style.display = "block";
      screenVideo.innerHTML = ""; // Clear any previous content
      screenVideo.append(myscreenVideo);
    });
    
    socket.on("screen-sharing-stopped", (username) => {
      let li = document.createElement("li");
      li.innerHTML = `<strong>${username}</strong> stopped screen sharing.`;
      all_messages.append(li);
      main__chat__window.scrollTop = main__chat__window.scrollHeight;
    
      screenVideo.style.display = "none";
      screenVideo.innerHTML = ""; // Clear shared screen display
    });
  });

peer.on("open", (id) => {
  socket.emit("join-room", ROOM_ID, id, USERNAME);
});

const connectToNewUser = (userId, stream) => {
  const call = peer.call(userId, stream);
  const video = document.createElement("video");
  video.setAttribute("data-user-id", userId); // Tambahkan atribut data untuk identifikasi video
  call.on("stream", (userVideoStream) => {
    addVideoStream(video, userVideoStream);
  });

  call.on("close", () => {
    removeVideo(userId);
  });
};

const addVideoStream = (videoEl, stream) => {
  videoEl.srcObject = stream;
  videoEl.addEventListener("loadedmetadata", () => {
    videoEl.play();
  });
  videoGrid.append(videoEl);
  let totalUsers = document.getElementsByTagName("video").length;
  if (totalUsers > 1) {
    for (let index = 0; index < totalUsers; index++) {
      document.getElementsByTagName("video")[index].style.width =
        100 / totalUsers + "%";
    }
  }
};

const removeVideo = (userId) => {
  const video = document.querySelector(`[data-user-id="${userId}"]`);
  if (video) {
    video.remove(); // Hapus video dari DOM
  }
};

const startStopScreenSharing = async () => {
  if (isScreenSharing) {
    stopScreenSharing();
    return;
  }

  try {
    // Mendapatkan stream dari layar
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    });

    socket.emit("start-screen-sharing", USERNAME);

    // Menampilkan video share screen
    myscreenVideo.srcObject = screenStream;
    myscreenVideo.addEventListener("loadedmetadata", () => {
      myscreenVideo.play();
    });

    screenVideo.style.display = "block";
    screenVideo.innerHTML = ""; // Kosongkan kontainer sebelum menambahkan
    screenVideo.append(myscreenVideo);
    isScreenSharing = true;

    screenStream.getTracks()[0].onended = stopScreenSharing; // Hentikan jika pengguna berhenti secara manual
  } catch (error) {
    console.error("Failed to start screen sharing:", error);
  }
};

const stopScreenSharing = () => {
  if (!isScreenSharing || !screenStream) return;

  const track = screenStream.getTracks()[0];
  if (track) track.stop();

  socket.emit("stop-screen-sharing");

  screenVideo.style.display = "none";
  screenVideo.innerHTML = "";
  isScreenSharing = false;
};

const playStop = () => {
  let enabled = myVideoStream.getVideoTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getVideoTracks()[0].enabled = false;
    setPlayVideo();
  } else {
    setStopVideo();
    myVideoStream.getVideoTracks()[0].enabled = true;
  }
};

const muteUnmute = () => {
  const enabled = myVideoStream.getAudioTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getAudioTracks()[0].enabled = false;
    setUnmuteButton();
  } else {
    setMuteButton();
    myVideoStream.getAudioTracks()[0].enabled = true;
  }
};

const setPlayVideo = () => {
  const html = `<i class="unmute fa fa-pause-circle"></i>
  <span class="unmute">Resume Video</span>`;
  document.getElementById("playPauseVideo").innerHTML = html;
};

const setStopVideo = () => {
  const html = `<i class=" fa fa-video-camera"></i>
  <span class="">Pause Video</span>`;
  document.getElementById("playPauseVideo").innerHTML = html;
};

const setUnmuteButton = () => {
  const html = `<i class="unmute fa fa-microphone-slash"></i>
  <span class="unmute">Unmute</span>`;
  document.getElementById("muteButton").innerHTML = html;
};
const setMuteButton = () => {
  const html = `<i class="fa fa-microphone"></i>
  <span>Mute</span>`;
  document.getElementById("muteButton").innerHTML = html;
};

// Modal untuk Security Information
const securityModal = document.getElementById("securityModal");

// Fungsi untuk membuka modal security
const openSecurityModal = () => {
  securityModal.style.display = "block";
};

// Fungsi untuk menutup modal security
const closeSecurityModal = () => {
  securityModal.style.display = "none";
};

// Fungsi untuk leave meeting
const leaveMeeting = () => {
  fetch("/leave-room", {
    method: "POST",
  }).then(() => {
    socket.disconnect();
    window.location.href = "/";
  });
};