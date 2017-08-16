'use strict';
const express = require('express'),
  app = express(),
  server = require('http').Server(app),
  path = require('path'),
  util = require('util'),
  fs = require('fs'),
  exec = require("child_process").exec,
  cors = require('cors'),
  io = require('socket.io')(server),
  formidable = require('formidable'),
  mkdirp = require('mkdirp'),
  tesseract = require('node-tesseract'),
  zipFolder = require('zip-folder');
var connectedUsers = {};
app.use(cors({
  // 'origin': 'http://localhost:4200',
  'origin': 'http://mtcocr',
  'credentials': true,
}));
app.post('/upload', function (req, res) {
  let form = new formidable.IncomingForm();
  form.multiples = true;
  form.keepExtensions = true;
  form.hash = false;
  form.uploadDir = path.join(__dirname, `uploads/${(req.connection.remoteAddress).replace(/(::ffff:)|(::)/g, '')}`);
  mkdirp(form.uploadDir);
  mkdirp(path.join(form.uploadDir, 'ocred'));
  let targetUser = req.connection.remoteAddress;
  form.on('fileBegin', function (name, file) {
    let re = new RegExp("(?:.+?\/)(.+)");
    if (re.test(file.name)) {
      file.path = path.join(form.uploadDir, re.exec(file.name)[1]);
    } else {
      file.path = path.join(form.uploadDir, file.name);
    }
  });
  form.on('file', function (name, file) {
    try {
      connectedUsers[targetUser].emit('event', {
        'event': 'fileRecieved',
        'file': file.name
      });
    } catch (error) {
      console.log(error);
      io.emit('event', {
        'event': 'ocrError',
        'error': 'Connection Unstable'
      });
      emptyDir(form.uploadDir);
    }
  });
  form.on('error', function (err) {
    try {
      connectedUsers[targetUser].emit('event', {
        'event': 'ocrError',
        'error': err
      });
    } catch (error) {
      console.log(error);
      io.emit('event', {
        'event': 'ocrError',
        'error': error
      });
      emptyDir(dir);
    }
  });
  form.on('end', function () {
    res.end('success');
  });
  form.parse(req);
});
app.get('/download', function (req, res) {
  let dir = path.join(__dirname, 'uploads', `${(req.connection.remoteAddress).replace(/(::ffff:)|(::)/g, '')}`, 'ocred');
  zipFolder(dir, `${dir}.zip`, function (err) {
    if (err) {
      io.emit('event', {
        'event': 'ocrError',
        'error': err
      });
    } else {
      res.setHeader('Content-disposition', 'attachment; filename=' + 'ocred.zip');
      res.setHeader('Content-type', 'application/octet-stream');
      res.setHeader('Transfer-Encoding', 'chunked');
      var filestream = fs.createReadStream(`${dir}.zip`);
      filestream.pipe(res);
      fs.unlink(`${dir}.zip`, function (err) {
        if (err) {
          io.emit('event', {
            'event': 'ocrError',
            'error': err
          });
        }
      });
    }
  });
})
server.listen(3000, function () {
  console.log('Server listening on port 3000');
});
io.on('connection', function (socket) {
  const targetUser = socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;
  console.log(targetUser + " joined");
  connectedUsers[targetUser] = socket;
  connectedUsers[targetUser].emit('event', {
    'event': 'connect_established'
  });
  connectedUsers[targetUser].on('CheckOldFiles', function () {
    connectedUsers[targetUser].emit('event', {
      'event': 'oldFilesCheck',
      'hasOldFiles': fs.readdirSync(path.join(__dirname, 'uploads', `${(socket.request.connection.remoteAddress).replace(/(::ffff:)|(::)/g, '')}`, 'ocred')).length > 0 ? true : false
    });
  });
  connectedUsers[targetUser].on('startProcess', async function () {
    await emptyDir(path.join(__dirname, 'uploads', `${(socket.request.connection.remoteAddress).replace(/(::ffff:)|(::)/g, '')}`, 'ocred'));
    console.log("process started");
    let dir = path.join(__dirname, `uploads/${(socket.request.connection.remoteAddress).replace(/(::ffff:)|(::)/g, '')}`);
    try {
      let files = await readdirAsync(dir);
      for (let file of files) {
        console.log(file);
        file = path.join(dir, file);
        if (/\.(jpe?g|png|webp)$/i.test(file)) {
          console.log("processing image " + file);
          connectedUsers[targetUser].emit('event', {
            'event': 'checkStarted',
            'file': path.basename(file)
          });
          connectedUsers[targetUser].emit('event', {
            'event': 'startingOcr',
            'file': path.basename(file)
          });
          let text = await tesseractAsync(file);
          if (text) {
            console.log("processed image " + file);
            connectedUsers[targetUser].emit('event', {
              'event': 'ocrComplete',
              'file': path.basename(file)
            });
          }
          await writeAsync(path.join(dir, 'ocred', path.basename(file).replace(/\.(gif|jpe?g|png|webp)$/i, '.txt')), text);
          await unlinkAsync(path.join(dir, `${path.basename(file)}`));
        } else if (/\.pdf$/i.test(file)) {
          connectedUsers[targetUser].emit('event', {
            'event': 'checkStarted',
            'file': path.basename(file)
          });
          let check = await execAsync(`python check.py '${file}'`);
          console.log("check", check);
          if (check.toString().trim().includes('True')) {
            console.log("check_stdout:" + check);
            connectedUsers[targetUser].emit('event', {
              'event': 'preOcred',
              'file': path.basename(file)
            });
            await unlinkAsync(path.join(dir, `${path.basename(file)}`));
          } else if (check.toString().trim().includes('False')) {
            console.log("check_stdout:" + check);
            connectedUsers[targetUser].emit('event', {
              'event': 'startingOcr',
              'file': path.basename(file)
            });
            console.log("processing pdf " + file);
            console.log(`pypdfocr '${file}' -c  ${path.join(__dirname, 'ocr_config.yaml')}`);
            let pypdf_response = await execAsync(`pypdfocr '${file}' -c  ${path.join(__dirname, 'ocr_config.yaml')}`);
            if (pypdf_response.toString().includes('Completed conversion successfully')) {
              await moveAsync(`${file.replace(/\.pdf$/g, '_ocr.pdf')}`, path.join(dir, 'ocred', `${path.basename(file).replace(/\.pdf$/g, '_ocr.pdf')}`));
              await unlinkAsync(path.join(dir, `${path.basename(file)}`));
              connectedUsers[targetUser].emit('event', {
                'event': 'ocrComplete',
                'file': path.basename(file)
              });
            }
          }
        }
      }
    } catch (error) {
      console.log(error);
      connectedUsers[targetUser].emit('event', {
        'event': 'ocrError',
        'error': error
      });
      emptyDir(dir);
    }
  });
});

function readdirAsync(path) {
  return new Promise(function (resolve, reject) {
    fs.readdir(path, function (error, result) {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

function writeAsync(file, data) {
  return new Promise(function (resolve, reject) {
    fs.writeFile(file, data, function (error, result) {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

function unlinkAsync(file) {
  return new Promise(function (resolve, reject) {
    fs.unlink(file, function (error, result) {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

function emptyDir(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function (file, index) {
      let curPath = path + "/" + file;
      if (!fs.lstatSync(curPath).isDirectory()) {
        fs.unlinkSync(curPath);
      }
    });
  }
}

function moveAsync(oldpath, newpath) {
  return new Promise(function (resolve, reject) {
    fs.rename(oldpath, newpath, function (error, result) {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

function tesseractAsync(file) {
  return new Promise(function (resolve, reject) {
    tesseract.process(file, function (error, result) {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

function execAsync(cmd) {
  return new Promise(function (resolve, reject) {
    exec(cmd, function (error, result) {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}
