<template>
  <div class="chatroom">
    房间地址：<input class="roomUrl" readonly="true" v-model="roomUrl" /><br />
    <video width="640px" height="480px" id="myVideo"></video>
    <video width="240px" height="160px" id="remoteVideo"></video>
  </div>
</template>

<script>
// @ is an alias to /src
let socket;
let pc;

export default {
  name: "userMedia",
  data() {
    return {
      roomUrl: "",
      roomName: "",
    };
  },
  async mounted() {
    /* use the stream */
    this.$nextTick(() => {
      let roomName = this.getUrlParam("room");
      if (!roomName) {
        this.roomName = "observable-" + Date.now();
        this.roomUrl = location.href + `?room=${this.roomName}`;
      } else {
        this.roomName = "observable-" + roomName.split("-")[1];
        this.roomUrl = location.href;
      }
      this.start();
    });
  },
  methods: {
    getUrlParam(name) {
      var reg = new RegExp("(\\?|&)" + name + "=([^&]*)(&|$)");
      var r = window.location.href.substr(1).match(reg);
      if (r != null) return unescape(r[2]);
      return null;
    },
    start() {
      const socket = new WebSocket('ws://localhost:9001');
      //socket = new ScaleDrone("OXo4HSBTCQ8ehrxI");
      socket.addEventListener("open", () => {
        socket.send(JSON.stringify({roomName: this.roomName}))
      });
      socket.addEventListener('message', function (event) {
        console.log('Message from server ', event.data);
      });
      this.startWebRTC(false)
    },
    startWebRTC(isOffer) {
      const iceServer = {
        iceServers: [
          {
            urls: "stun:stun.l.google.com:19302",
          },
        ],
      };
      console.log("startWebRTC, connect to stun server");
      pc = new RTCPeerConnection(iceServer);
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(">>>>onicecandidate");
          this.sendMessage({ candidate: event.candidate });
        }
      };
      if (isOffer) {
        pc.onnegotiationneeded = () => {
          // 创建本地sdp描述 (Session Description Protocol)
          pc.createOffer()
            .then((sdp) => {
              pc.setLocalDescription(
                sdp,
                () => {
                  this.sendMessage({ sdp: pc.localDescription });
                },
                this.onError
              );
            })
            .catch(this.onError);
        };
      }
      pc.onaddstream = function (evt) {
        document.querySelector("#remoteVideo").srcObject = evt.stream;
        let videoEle = document.querySelector("#myVideo");
        videoEle.srcObject = evt.stream;
        videoEle.play();
      };

      window.navigator.getUserMedia(
        { audio: true, video: true },
        (stream) => {
          let videoEle = document.querySelector("#myVideo");
          console.log("start local stream");
          videoEle.srcObject = stream;
          videoEle.play();
          pc.addStream(stream);
        },
        this.onError
      );
    },
    sendMessage(message) {
      socket.publish({
        room: this.roomName,
        message,
      });
    },
    onError(error) {
      console.log(error);
    },
  },
};
</script>

<style lang="less" scoped>
.chatroom {
  position: relative;
  border: 1px #ccc solid;
  width: 650px;

  .roomUrl {
    width: 500px;
  }

  #remoteVideo {
    position: absolute;
    right: 10px;
    top: 20px;
    z-index: 10;
  }
}
</style>
