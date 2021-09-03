const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: 9001 });

// since we are doing a simple demo, so we don't use a sql here.
// we mimic the db using Maps
const rooms = new Map()

wss.on('connection', function connection(ws, req) {
  console.log(req.socket)
  ws.on('message', function incoming(message) {
    // console.log('received: %s', message);
    const data = JSON.parse(message)
    if(data.type === 'init') {
        const room = rooms.get(data.roomName)
        if(room) {
            console.log('yep, we have a room')
        } else {
            console.log('created a new room:', data.roomName)
            const roomNow = new Map(), clientNow = req.headers["sec-websocket-key"]
            roomNow.set('clients', new Map())
            const clientData = new Map()
            clientData.set('headers', req.headers)
            clientData.set('role', 'creator')
            roomNow.get('clients').set(clientNow, clientData)
            ws.send(JSON.stringify({type: 'inRoom'}))
        }
    }
    // ws.send(`received ur message: ${JSON.stringify(message.toString())}`)
    // ws.send(`socket message: ${JSON.stringify(req.headers)}`)
  });

  ws.send('connected');
});