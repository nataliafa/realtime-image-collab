const http = require('http')
const url = require('url');
const path = require('path')
const fs = require('fs')
const express = require('express')
const multer = require('multer')
const {v4: uuidv4} = require('uuid')
const WebSocket = require('ws')

const app = express()
const server = http.createServer(app);
const wss = new WebSocket.Server({server})

app.use(express.static('public'))

wss.on('connection', function connection(ws, req) {
  ws.send(JSON.stringify({
    event: 'pic',
    pic: {
      url: `uploads/${path.basename(url.parse(req.url).pathname)}`
    }
  }))
})

app.post('/pic', (req, res) => {
  const upload = multer({dest: './tmp'}).single('image')
  upload(req, res, function (err) {
    if (err) {
      return req.status(500).send(err)
    }
    const imageId = `${uuidv4()}${path.extname(req.file.originalname)}`
    const tempPath = path.join(__dirname, req.file.path)
    const targetPath = path.join(__dirname, `./public/uploads/${imageId}`)
    if (req.file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF)$/)) {
      fs.rename(tempPath, targetPath, err => {
        if (err) {
          return res.status(500).send(err)
        }
        res.status(200).send({
          id: imageId
        })
      })
    } else {
      fs.unlink(tempPath, err => {
        if (err) {
          return res.status(500).send(err)
        }
        res.status(403).contentType("text/plain")
            .end("Only .png, .jpg, .jpeg and gif files are supported")
      })
    }
  })
})

server.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${server.address().port}`)
})