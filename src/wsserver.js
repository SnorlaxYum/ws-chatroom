const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: 9001 });

// since we are doing a simple demo, so we don't use a sql here.
// we mimic the db using Maps
const rooms = new Map()
const userConnections = new Map()

wss.on('connection', function connection(ws, req) {
//   console.log(req.socket)
  let room
  const clientNow = req.headers["sec-websocket-key"]
  userConnections.set(clientNow, ws)
  ws.on('message', function incoming(message) {
    console.log('received mesg from %s: %s', req.headers["sec-websocket-key"], message);
    const data = JSON.parse(message)
    if(data.type === 'init') {
        room = rooms.get(data.roomName)
        let clients
        if(room) {
            clients = room.get('clients')
            if(clients.size === 2) {
              ws.send(JSON.stringify({type: 'roomFull'}))
            } else {
              const clientData = {headers: req.headers, role: 'member'}
              clients.set(clientNow, clientData)
              console.log('yep, we have a room.', [...clients.keys()])
              ws.send(JSON.stringify({type: 'roomInfo', clientSum: clients.size}))
            }
        } else {
            console.log('created a new room:', data.roomName)
            room = new Map()
            room.set('clients', new Map())
            const clientData = {headers: req.headers, role: 'creator'}
            room.get('clients').set(clientNow, clientData)
            clients = [...room.get('clients').keys()]
            rooms.set(data.roomName, room)
            ws.send(JSON.stringify({type: 'roomInfo', clients}))
        }
    } else if(data.type === "roomMessage") {
      if(data.sdp||data.candidate||data.canvasDraw) {
        for(const [user, connection] of userConnections) {
          if(user !== clientNow) {
            connection.send(JSON.stringify(data))
          }
        }
      }
    }
    // ws.send(`received ur message: ${JSON.stringify(message.toString())}`)
    // ws.send(`socket message: ${JSON.stringify(req.headers)}`)
  });
  ws.on('close', () => {
    userConnections.delete(clientNow)
    if(room && room.get('clients')) {
      room.get('clients').delete(clientNow)
      console.log(clientNow, ' left')
    }
    
  })

  ws.send(JSON.stringify({type: 'connected'}));
});