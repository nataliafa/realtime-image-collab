const http = require('http')
const url = require('url')
const path = require('path')
const fs = require('fs')
const express = require('express')
const bodyParser = require('body-parser')
const multer = require('multer')
const {v4: uuidv4} = require('uuid')
const WebSocket = require('ws')

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

function getCurvesPath(imageId) {
  const basename = path.basename(imageId, path.extname(imageId))
  return path.join(__dirname, 'public', 'uploads', basename, 'curves.json')
}

function readCurves(curvesPath) {
  try {
    return JSON.parse(fs.readFileSync(curvesPath))
  } catch {
    return []
  }
}

function getUniqueId() {
  return uuidv4().replace(/-/g, '')
}

wss.on('connection', function connection(ws, req) {
  const imageId = path.basename(url.parse(req.url).pathname)
  const extname = path.extname(imageId)
  const basename = path.basename(imageId, extname)
  const imagePublicPath = path.join('uploads', basename, `image${extname}`)

  ws.send(JSON.stringify({
    imageId: imageId,
    event: 'pic',
    pic: {
      url: imagePublicPath,
      comments: readComments(getCommentsPath(imageId)),
      curves: readCurves(getCurvesPath(imageId))
    }
  }))
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
    const localPath = path.join(__dirname, 'public', 'uploads', basename, `image${extname}`)
    if (req.file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF)$/)) {
      fs.mkdirSync(path.join(__dirname, 'public', 'uploads', basename))
      fs.rename(tempPath, localPath, err => {
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

app.post('/pic/:imageId/curves', (req, res) => {
  const imageId = req.params.imageId
  const curvesPath = getCurvesPath(imageId)
  try {
    fs.accessSync(curvesPath)
    const curves = readCurves(curvesPath)
    curves.push(req.body)
    fs.writeFileSync(curvesPath, JSON.stringify(curves))
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          imageId: imageId,
          event: 'curve',
          curve: req.body
        }));
      }
    })

    return res.status(200).end()
  } catch {
    fs.writeFileSync(curvesPath, JSON.stringify([req.body]))
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          imageId: imageId,
          event: 'curve',
          curve: req.body
        }));
      }
    })

    return res.status(200).end()
  }
})

app.post('/pic/:imageId/comments', (req, res) => {
  const imageId = req.params.imageId
  const commentsPath = getCommentsPath(imageId)
  req.body.id = getUniqueId()
  req.body.timestamp = Date.now()
  try {
    fs.accessSync(commentsPath)
    const comments = readComments(commentsPath)
    comments.push(req.body)
    fs.writeFileSync(commentsPath, JSON.stringify(comments))
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          imageId: imageId,
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
          imageId: imageId,
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