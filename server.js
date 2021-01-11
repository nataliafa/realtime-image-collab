const http = require('http')
const url = require('url')
const path = require('path')
const fs = require('fs')
const express = require('express')
const bodyParser = require('body-parser')
const multer = require('multer')
const {v4: uuidv4} = require('uuid')
const WebSocket = require('ws')
const {createCanvas, loadImage} = require('canvas')
const sizeOf = require('image-size')

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({server})

app.use(express.static('public'))
app.use(bodyParser.json())

function getCommentsPath(imageId) {
  const basename = path.basename(imageId, path.extname(imageId))
  return path.join(__dirname, 'public', 'uploads', basename, 'comments.json')
}

function readComments(commentsPath) {
  try {
    return JSON.parse(fs.readFileSync(commentsPath))
  } catch {
    return []
  }
}

function getUniqueId() {
  return uuidv4().replace(/-/g, '')
}

const webSocketConnections = {}

wss.on('connection', function connection(ws, req) {
  const imageId = path.basename(url.parse(req.url).pathname)
  const extname = path.extname(imageId)
  const basename = path.basename(imageId, extname)
  const imagePrivatePath = path.join(__dirname, 'public', 'uploads', basename, `image${extname}`)
  const imagePublicPath = path.join('uploads', basename, `image${extname}`)
  const maskPrivatePath = path.join(__dirname, 'public', 'uploads', basename, 'mask.png')
  const maskPublicPath = path.join('uploads', basename, 'mask.png')

  webSocketConnections[imageId] = ws

  fs.access(maskPrivatePath, fs.constants.F_OK, function (err) {
    if (!err) {
      return
    }
    const dimensions = sizeOf(imagePrivatePath)
    const canvas = createCanvas(dimensions.width, dimensions.height)
    fs.writeFileSync(maskPrivatePath, canvas.toBuffer('image/png'))
  })

  ws.send(JSON.stringify({
    event: 'pic',
    pic: {
      url: imagePublicPath,
      mask: maskPublicPath,
      comments: readComments(getCommentsPath(imageId))
    }
  }))

  ws.on('message', function message(data) {
    const dimensions = sizeOf(imagePrivatePath)
    const canvas = createCanvas(dimensions.width, dimensions.height)
    const ctx = canvas.getContext('2d')

    const newMaskPath = path.join(__dirname, 'tmp', `${getUniqueId()}.png`)
    fs.writeFileSync(newMaskPath, data)

    // Apply old mask
    loadImage(maskPrivatePath).then((oldMask) => {
      ctx.drawImage(oldMask, 0, 0, dimensions.width, dimensions.height)
      loadImage(newMaskPath).then((newMask) => {
        ctx.drawImage(newMask, 0, 0, dimensions.width, dimensions.height)
        fs.writeFileSync(maskPrivatePath, canvas.toBuffer('image/png'))
        try {
          fs.accessSync(maskPrivatePath, fs.constants.F_OK)
          wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                event: 'mask',
                url: maskPublicPath
              }));
            }
          })
          fs.rmSync(newMaskPath)
        } catch (e) {
        }
      })
    })
  })
  setInterval(function () {
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          event: 'mask',
          url: maskPublicPath
        }));
      }
    })
  }, 1000)
})

app.post('/pic', (req, res) => {
  const upload = multer({dest: './tmp'}).single('image')
  upload(req, res, function (err) {
    if (err) {
      return req.status(500).send(err)
    }
    const imageId = `${getUniqueId()}${path.extname(req.file.originalname)}`
    const tempPath = path.join(__dirname, req.file.path)
    const extname = path.extname(imageId)
    const basename = path.basename(imageId, extname)
    const imagePrivatePath = path.join(__dirname, 'public', 'uploads', basename, `image${extname}`)
    if (req.file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF)$/)) {
      fs.mkdirSync(path.join(__dirname, 'public', 'uploads', basename))
      fs.rename(tempPath, imagePrivatePath, err => {
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

app.post('/pic/:imageId/comments', (req, res) => {
  const imageId = req.params.imageId
  const commentsPath = getCommentsPath(imageId)
  req.body.id = getUniqueId()
  req.body.timestamp = new Date()
  try {
    fs.accessSync(commentsPath)
    const comments = readComments(commentsPath)
    comments.push(req.body)
    fs.writeFileSync(commentsPath, JSON.stringify(comments))
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          event: 'comment',
          comment: req.body
        }));
      }
    })

    return res.status(200).end()
  } catch {
    fs.writeFileSync(commentsPath, JSON.stringify([req.body]))
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          event: 'comment',
          comment: req.body
        }));
      }
    })

    return res.status(200).end()
  }
})

server.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${server.address().port}`)
})