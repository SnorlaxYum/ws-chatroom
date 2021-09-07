const { WebSocketServer } = require('ws');
const { createCanvas, Canvas, Image } = require('canvas')
const mergeImages = require('merge-images')

const wss = new WebSocketServer({ port: 9001 });

// since we are doing a simple demo, so we don't use a sql here.
// we mimic the db using Maps
const rooms = new Map()
const userConnections = new Map()



wss.on('connection', function connection(ws, req) {
//   console.log(req.socket)
  let room
  let clientData
  let clients
  let canvas = createCanvas(640, 480)
  let canvasDrawing = false
  let ctx = canvas.getContext('2d')
  const clientNow = req.headers["sec-websocket-key"]
  userConnections.set(clientNow, ws)

  function pureDraw(x, y) {
    if(canvasDrawing) {
      ctx.lineTo(x, y)
      drawPureEnd()
      pureDraw(x, y)
    } else {
      canvasDrawing = true
      ctx.moveTo(x, y)
    }
  }

  function drawPureEnd() {
    ctx.lineWidth = 5
    ctx.stroke()
    canvasDrawing = false
  }

  ws.on('message', function incoming(message) {
    console.log('received mesg from %s: %s', req.headers["sec-websocket-key"], message);
    const data = JSON.parse(message)
    if(data.type === 'init') {
        room = rooms.get(data.roomName)
        if(room) {
            clients = room.get('clients')
            if(clients.size === 2) {
              ws.send(JSON.stringify({type: 'roomFull'}))
            } else {
              clientData = {headers: req.headers, role: 'member'}
              clients.set(clientNow, clientData)
              console.log('yep, we have a room.', [...clients.keys()])
              ws.send(JSON.stringify({type: 'roomInfo', clientSum: clients.size}))
              if(room.has('canvasImg')) {
                ws.send(JSON.stringify({type: 'canvasRestore', canvasNow: room.get('canvasImg')}))
              }
            }
        } else {
            console.log('created a new room:', data.roomName)
            room = new Map()
            clients = new Map()
            room.set('clients', clients)
            clientData = {headers: req.headers, role: 'creator'}
            clients.set(clientNow, clientData)
            rooms.set(data.roomName, room)
            ws.send(JSON.stringify({type: 'roomInfo', clientSum: clients.size}))
        }
    } else if(data.type === "roomMessage") {
      if(data.sdp||data.candidate||data.canvasTouchEnd||data.canvasDraw||data.canvasDraw) {
        if(data.canvasDraw) {
          const [x,y] = data.canvasDraw
          pureDraw(x, y)
        }
        if(data.canvasTouchEnd) {
          drawPureEnd()

          if(room.has('canvasImg')) {
            mergeImages([room.get('canvasImg'), canvas.toDataURL()], {
              Canvas,
              Image
            })
            .then(imgNow => {
              room.set('canvasImg', imgNow)
            });
          } else {
            room.set('canvasImg', canvas.toDataURL())
          }
        }
        for(const [user, connection] of userConnections) {
          if(user !== clientNow && clients.has(user)) {
            connection.send(JSON.stringify(data))
          }
        }
      }
      
    }
  });
  ws.on('close', () => {
    userConnections.delete(clientNow)
    if(room && room.get('clients')) {
      room.get('clients').delete(clientNow)
      console.log(clientNow, ' left')
      const other = userConnections.get([...room.get('clients').keys()][0])
      if(other) {
        other.send(JSON.stringify({type: 'otherLeft'}))
      }
    }
  })

  ws.send(JSON.stringify({type: 'connected'}));
});

module.exports = {rooms, userConnections}