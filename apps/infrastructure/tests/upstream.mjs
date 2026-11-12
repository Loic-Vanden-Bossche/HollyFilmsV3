import { createServer } from 'node:http'
import { createHash } from 'node:crypto'

const server = createServer((req, res) => {
  if (req.url.startsWith('/Videos/')) {
    if (
      req.headers.range !== 'bytes=2-5' ||
      !req.url.includes('token=demo%2Ftoken')
    ) {
      res.writeHead(400).end('Range or encoded query lost')
      return
    }
    res.writeHead(206, {
      'Content-Type': 'video/mp4',
      'Content-Range': 'bytes 2-5/10',
      'Accept-Ranges': 'bytes',
    })
    res.end('2345')
    return
  }
  res.setHeader('Content-Type', 'application/json')
  res.end(
    JSON.stringify({
      Version: '12.4.0',
      path: req.url,
      authorization: req.headers.authorization,
    }),
  )
})
server.on('upgrade', (req, socket) => {
  const accept = createHash('sha1')
    .update(
      req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11',
    )
    .digest('base64')
  socket.write(
    `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
  )
  socket.write(Buffer.from([0x81, 2, 0x6f, 0x6b]))
  socket.on('data', () => {
    socket.end(Buffer.from([0x88, 0]))
  })
})
server.listen(8096, '0.0.0.0')
