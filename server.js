const http = require('http')
const url = require('url')
const path = require('path')
const fs = require('fs')
const express = require('express')
const multer = require('multer')
const {v4: uuidv4} = require('uuid')
const WebSocket = require('ws')
const {createCanvas, loadImage, createImageData} = require('canvas')
const sizeOf = require('image-size')

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({server})

app.use(express.static('public'))

wss.on('connection', function connection(ws, req) {
  const imageId = path.basename(url.parse(req.url).pathname)
  const extname = path.extname(imageId)
  const basename = path.basename(imageId, extname)
  const imagePrivatePath = path.join(__dirname, 'public', 'uploads', basename, `image${extname}`)
  const imagePublicPath = path.join('uploads', basename, `image${extname}`)
  const maskPrivatePath = path.join(__dirname, 'public', 'uploads', basename, 'mask.png')
  const maskPublicPath = path.join('uploads', basename, 'mask.png')

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
      comments: [
        {
          id: '123',
          left: 200,
          top: 100,
          message: 'Hello world!',
          timestamp: new Date()
        }
      ]
    }
  }))
  ws.on('message', function message(data) {
    const dimensions = sizeOf(imagePrivatePath)
    const canvas = createCanvas(dimensions.width, dimensions.height)
    const ctx = canvas.getContext('2d')

    const newMaskPath = path.join(__dirname, 'tmp', `${uuidv4().replace(/-/g, '')}.png`)
    fs.writeFileSync(newMaskPath, data)

    // Apply old mask
    loadImage(maskPrivatePath).then((oldMask) => {
      ctx.drawImage(oldMask, 0, 0, dimensions.width, dimensions.height)
      loadImage(newMaskPath).then((newMask) => {
        ctx.drawImage(newMask, 0, 0, dimensions.width, dimensions.height)
        fs.rmSync(maskPrivatePath)
        fs.writeFileSync(maskPrivatePath, canvas.toBuffer('image/png'))
        try {
          fs.accessSync(maskPrivatePath, fs.constants.F_OK)
          ws.send(JSON.stringify({
            event: 'mask',
            url: maskPublicPath
          }))
          fs.rmSync(newMaskPath)
        } catch (e) {
        }
      })
    })
  })
})

app.post('/pic', (req, res) => {
  const upload = multer({dest: './tmp'}).single('image')
  upload(req, res, function (err) {
    if (err) {
      return req.status(500).send(err)
    }
    const imageId = `${uuidv4().replace(/-/g, '')}${path.extname(req.file.originalname)}`
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

server.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${server.address().port}`)
})