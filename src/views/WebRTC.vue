<template>
  <div class="chatroom">
    Room: <input class="roomUrl" readonly="true" v-model="roomUrl" /><br />
    <div class='error' ref='roomError'></div>
    <div class='camera'>
      Camera <button @click="toggleVideo">Click to toggle both videos</button>
      <div ref='videoPlace'>
        <div id="myVideoWrapper" ref="myVideoWrapper">
          <video id="myVideo" ref="myVideo"></video>
        </div>
        <div id="remoteVideoWrapper" style="opacity: 0;" ref="remoteVideoWrapper"><video id="remoteVideo" ref="remoteVideo"></video></div>
      </div>
    </div>
    <div class='screen'>
      Screen Share: <button @click="toggleVideo1">Click to toggle both videos</button>
      <div ref='videoPlace1'>
        <div id="myVideoWrapper1" ref="myVideoWrapper1">
          <video id="myVideo1" ref="myVideo1"></video>
        </div>
        <div id="remoteVideoWrapper1" style="opacity: 0;" ref="remoteVideoWrapper1"><video id="remoteVideo1" ref="remoteVideo1"></video></div>
      </div>
    </div>
    <div class='whiteboard'>
      <div class='cv'>
        <canvas ref='board' width='640' height='480'/>
        <canvas ref='boardRemote' width='640' height='480'/>
      </div>
    </div>
  </div>
</template>

<script>
// @ is an alias to /src
let socket;
let pc;
let pc1;
let canvas;
let ctx;
let canvasRemote;
let ctxRemote;

export default {
  name: "userMedia",
  data() {
    return {
      roomUrl: "",
      roomName: "",
      myVideoIndex: 1,
      myVideoIndex1: 1,
      drawing: false
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
    toggleVideo() {
      if(this.myVideoIndex) {
        this.$refs["videoPlace"].appendChild(this.$refs["myVideoWrapper"])
        this.myVideoIndex = 0
      } else {
        this.$refs["videoPlace"].appendChild(this.$refs["remoteVideoWrapper"])
        this.myVideoIndex = 1
      }
    },
    toggleVideo1() {
      if(this.myVideoIndex1) {
        this.$refs["videoPlace1"].appendChild(this.$refs["myVideoWrapper1"])
        this.myVideoIndex1 = 0
      } else {
        this.$refs["videoPlace1"].appendChild(this.$refs["remoteVideoWrapper1"])
        this.myVideoIndex1 = 1
      }
    },
    getUrlParam(name) {
      var reg = new RegExp("(\\?|&)" + name + "=([^&]*)(&|$)");
      var r = window.location.href.substr(1).match(reg);
      if (r != null) return unescape(r[2]);
      return null;
    },
    drawdot(x,y) {
      ctx.fillRect(x, y, 1, 1)
    },
    pureDraw(x, y, curCtx=ctx) {
      if(this.drawing) {
        curCtx.lineTo(x, y)
        this.drawPureEnd(curCtx)
        this.pureDraw(x, y, curCtx)
      } else {
        this.drawing = true
        curCtx.moveTo(x, y)
      }
    },
    draw(x, y) {
      this.pureDraw(x, y)
      this.sendMessage({canvasDraw: [x, y]})
    },
    drawTouch(e) {
      e.preventDefault()
      const {clientX, clientY} = e.changedTouches[0]
      const {x, y} = canvas.getBoundingClientRect()
      let finalX = clientX - x
      let finalY = clientY - y
      this.draw(finalX, finalY)
    },
    drawPureEnd(curCtx=ctx) {
      curCtx.lineWidth = 5
      curCtx.stroke()
      this.drawing = false
    },
    drawEnd() {
      if(this.drawing) {
        this.drawPureEnd()
        this.sendMessage({canvasTouchEnd: true})
      }
    },
    otherLeft() {
      const video = this.$refs["remoteVideo"]
      video.srcObject = null
      this.$refs['remoteVideoWrapper'].style.opacity = 0
      const video1 = this.$refs["remoteVideo1"]
      video1.srcObject = null
      this.$refs['remoteVideoWrapper1'].style.opacity = 0
    },
    start() {
      socket = new WebSocket('ws://localhost:9001');

      canvas = this.$refs['board'];
      ctx = canvas.getContext('2d'); 
      ctx.fillStyle = 'black';

      canvasRemote = this.$refs['boardRemote'];
      ctxRemote = canvasRemote.getContext('2d'); 
      ctxRemote.fillStyle = 'black';

      canvas.addEventListener('touchstart', e => this.drawTouch(e))

      canvas.addEventListener('touchmove', e => this.drawTouch(e))

      canvas.addEventListener('touchend', e => {
        this.drawTouch(e)
        this.drawEnd()
      })

      canvas.addEventListener('mousedown', () => {
        const draw = (e) => {
          const {x, y} = canvas.getBoundingClientRect()
          let finalX = e.clientX - x
          let finalY = e.clientY - y
          this.draw(finalX, finalY)
        }
        canvas.addEventListener('mousemove', draw)
        document.addEventListener('mouseup', () => {
          canvas.removeEventListener('mousemove', draw)
          this.drawEnd()
        })
      })

      let isOffer = false
      socket.addEventListener("open", () => {
        socket.send(JSON.stringify({type: 'init', roomName: this.roomName}))
      });

      socket.addEventListener('message', (event) => {
        console.log('Message from server ', event.data);
        const message = JSON.parse(event.data)
        if(message.type === 'roomFull') {
          this.$refs['roomError'].textContent = 'The room is full, plz select another room!'
        } else if(message.type === 'roomInfo') {
          isOffer = message.clientSum > 1
          this.startWebRTC(isOffer)
        } else if(message.type === 'canvasRestore') {
          const img = new Image()
          img.setAttribute('src', message.canvasNow)
          img.onload = () => {
            ctx.drawImage(img, 0, 0)
          }
        } else if(message.type === 'otherLeft') {
          this.otherLeft()
        } else if(message.sdp) {
          const {id, sdp} = message
          const curPC = id === 'mediaStream' ? pc : pc1
          curPC.setRemoteDescription(
            new RTCSessionDescription(sdp),
            () => {
              console.log('sdp消息类型：', curPC.remoteDescription.type)
              if(curPC.remoteDescription.type === "offer") {
                curPC.createAnswer()
                  .then(answer => {
                    curPC.setLocalDescription(
                      answer,
                      () => {
                        this.sendMessage({id, sdp: curPC.localDescription})
                      },
                      this.onError
                    )
                  })
                  .catch(this.onError)
              }
            },
            this.onError
          )
        } else if(message.candidate) {
          const {id, candidate} = message
          console.log('condidate消息', message)
          const curPC = id === 'mediaStream' ? pc : pc1
          curPC.addIceCandidate(new RTCIceCandidate(candidate))
        } else if(message.canvasDraw) {
          const [x,y] = message.canvasDraw
          this.pureDraw(x, y, ctxRemote)
        } else if(message.canvasTouchEnd) {
          this.drawPureEnd(ctxRemote)
        }
      });
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
      // userMedia
      pc = new RTCPeerConnection(iceServer);
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(">>>>onicecandidate");
          this.sendMessage({ id: 'mediaStream', candidate: event.candidate });
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
                  this.sendMessage({ id: 'mediaStream', sdp: pc.localDescription });
                },
                this.onError
              );
            })
            .catch(this.onError);
        };
      }

      pc.onaddstream = (evt) => {
        console.log('add stream:', evt)
        const video = this.$refs["remoteVideo"]
        video.srcObject = evt.stream
        video.play()
        this.$refs['remoteVideoWrapper'].style.opacity = 100
      };

      window.navigator.getUserMedia(
        { audio: true, video: true },
        (stream) => {
          let videoEle = this.$refs["myVideo"]
          console.log("start local stream");
          const selfStream = stream.clone()
          for(const track of selfStream.getAudioTracks()) {
            selfStream.removeTrack(track)
          }
          videoEle.srcObject = selfStream;
          videoEle.play();
          pc.addStream(stream);
        },
        this.onError
      );

      // screen sharing
      const iceServer1 = {
        iceServers: [
          {
            urls: "stun:stun1.l.google.com:19302",
          },
        ],
      };
      pc1 = new RTCPeerConnection(iceServer1);
      pc1.onicecandidate = (event) => {
        if (event.candidate) {
          console.log(">>>>onicecandidate - screen sharin");
          this.sendMessage({ id: 'screen', candidate: event.candidate });
        }
      };
      if (isOffer) {
        pc1.onnegotiationneeded = () => {
          // 创建本地sdp描述 (Session Description Protocol)
          pc1.createOffer()
            .then((sdp) => {
              pc1.setLocalDescription(
                sdp,
                () => {
                  this.sendMessage({ id: 'screen', sdp: pc1.localDescription });
                },
                this.onError
              );
            })
            .catch(this.onError);
        };
      }

      pc1.onaddstream = (evt) => {
        console.log('add stream:', evt)
        const video = this.$refs["remoteVideo1"]
        video.srcObject = evt.stream
        video.play()
        this.$refs['remoteVideoWrapper1'].style.opacity = 100
      };

      window.navigator.mediaDevices.getDisplayMedia(
        { video: true }
      ).then(
        (stream) => {
          let videoEle = this.$refs["myVideo1"]
          console.log("start local stream screen sharing");
          videoEle.srcObject = stream;
          videoEle.play()
          pc1.addStream(stream);
        },
        this.onError
      );
    },
    sendMessage(message) {
      socket.send(JSON.stringify({
        type: 'roomMessage',
        room: this.roomName,
        ...message,
      }));
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

  .error {
    color: red;
  }

  .whiteboard {
    canvas {
      width: 640px;
      height: 480px;
    }
  }

  .camera>div {
    position: relative;
    div {
      width:640px;
      &:first-child {
        position: relative;
        &::before {
          position: absolute;
          color: #fff;
          width: 100%;
          background: rgba(0,0,0,.5);
          bottom: 4px;
        }
        video {
          width: 640px;
          height: 480px;
        }
      }
      &:nth-child(2) {
        position: absolute;
        right: 10px;
        top: 0;
        z-index: 10;
        width: 227px;
        &::before {
          position: absolute;
          color: #fff;
          width: 100%;
          background: rgba(0,0,0,.5);
          bottom: 4px;
        }
        video {
          width: 240px;
          height: 160px;
        }
      }
    }
  }

  .cv {
    width: 640px;
    margin: auto;
    position: relative;
    canvas {
      &:nth-child(2) {
        position: absolute;
        top: 0;
        left: 0;
        z-index: -1;
      }
    }
  }

  .screen>div {
    position: relative;
    div {
      width:640px;
      &:first-child {
        position: relative;
        &::before {
          position: absolute;
          color: #fff;
          width: 100%;
          background: rgba(0,0,0,.5);
          bottom: 4px;
        }
        video {
          width: 640px;
          height: 480px;
        }
      }
      &:nth-child(2) {
        position: absolute;
        right: 10px;
        top: 0;
        z-index: 10;
        width: 227px;
        &::before {
          position: absolute;
          color: #fff;
          width: 100%;
          background: rgba(0,0,0,.5);
          bottom: 4px;
        }
        video {
          width: 240px;
          height: 160px;
        }
      }
    }
  }

  #myVideoWrapper::before {
    content: "Me";
    
  }

  #remoteVideoWrapper::before {
    content: "The Other";
  }

  #myVideoWrapper1::before {
    content: "Me";
  }

  #remoteVideoWrapper1::before {
    content: "The Other";
  }
}
</style>
