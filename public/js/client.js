//----------- WEBSOCKET ---------------

const url = window.location.origin;

let webSocket;

function connectWebSocket(id) {

  let webSocketProtocol = 'ws';
  if (new URL(url).protocol === 'https:') {
    webSocketProtocol = 'wss';
  }

  webSocket = new WebSocket(`${webSocketProtocol}://${window.location.host}/pic/${id}`);

  webSocket.addEventListener('open', () => {
    console.log('Вэбсокет соединение открыто');
  });

  webSocket.addEventListener('message', (event) => {

    const dataParse = JSON.parse(event.data);

    if (dataParse.imageId !== getUrlImageId()) {
      return;
    }

    if (dataParse.event === "pic") {
      const {pic} = dataParse;

      showImage();
      setSrcImage(pic.url);
      hideLoader();

      document.querySelector('.current-image').addEventListener('load', () => {
        showCommentsWrap();
        if (pic.curves) {
          curves = pic.curves;
          needsRepaint = true;
        }
        showCanvas();
        // make comments wrap and canvas the same size as the image
        changeSizeCommentsWrap();
        changeSizeCanvas();
      });

      if (pic.comments) {
        createFormsAndComments(pic.comments);
      }


    } else if (dataParse.event === "comment") {
      let isExist = false;

      const comments = document.querySelectorAll('.comment');
      comments.forEach(comment => {
        if (comment.dataset.id === dataParse.comment.id) {
          isExist = true;
        }
      })

      if (isExist) {
        return;
      }

      createFormsAndComments([dataParse.comment]);
    } else if (dataParse.event === "curve") {
      let isExist = false;

      curves.forEach(curve => {
        if (curve.id === dataParse.curve.id) {
          isExist = true;
        }
      })

      if (isExist) {
        return;
      }

      curves.push(dataParse.curve);
      needsRepaint = true;
    } else if (dataParse.event === "error") {
      console.log('Произошла ошибка');
      console.log(event);
    }
  });

  // close the web socket connection
  webSocket.addEventListener('close', event => {
    console.log('Вэбсокет соединение закрыто');
    console.log(event);
  });

  window.addEventListener('beforeunload', () => {
    webSocket.close(1000, 'Работа закончена');
  });

}

// creates forms with comments
function createFormsAndComments(comments) {
  comments.forEach(comment => {
    let needCreateNewForm = true;
    const {left, top, message, timestamp, id} = comment;

    document.querySelectorAll('.comments__form').forEach(form => {
      // if a form already exists with the coordinates left and top, add a message to that form
      if (+form.dataset.left === left && +form.dataset.top === top) {
        const newComment = addNewComment(message, timestamp, id);
        const commentsBody = form.querySelector('.comments__body');
        commentsBody.insertBefore(newComment, commentsBody.querySelector('.comments__input'));

        needCreateNewForm = false;
      }
    });

    if (needCreateNewForm) {
      setForm(left, top, message, timestamp, id);
    }
  })
}

//----------- COMMENTS ---------------

const commentsWrap = document.createElement('div');
document.querySelector('.app').appendChild(commentsWrap);
commentsWrap.classList.add('comments__wrap');

// show/hide comments
document.querySelector('#comments-on').addEventListener('change', openAndCloseForms);
document.querySelector('#comments-off').addEventListener('change', openAndCloseForms);

function openAndCloseForms() {
  if (document.querySelector('#comments-on').checked) {
    document.querySelectorAll('.comments__form').forEach(form => {
      form.style.display = '';
    });
  } else {
    document.querySelectorAll('.comments__form').forEach(form => {
      form.style.display = 'none';
    });
  }
}

document.querySelector('.comments__wrap').addEventListener('click', (event) => addForm(event.offsetX, event.offsetY));

// resize the wrap
function changeSizeCommentsWrap() {
  document.querySelector('.comments__wrap').style.display = 'block';
  document.querySelector('.comments__wrap').style.width = `${document.querySelector('.current-image').width}px`;
  document.querySelector('.comments__wrap').style.height = `${document.querySelector('.current-image').height}px`;
}

// hide comments wrap
function hideCommentsWrap() {
  document.querySelector('.comments__wrap').style.display = 'none';
}

// show the comments wrap
function showCommentsWrap() {
  document.querySelector('.comments__wrap').style.display = 'block';
}

// returns the height of the marker
function getMarkerHeight() {
  let result;
  if (document.querySelector('.comments__marker-checkbox')) {
    let el = getComputedStyle(document.querySelector('.comments__marker-checkbox'));
    result = el.height.split('px')[0] / 2;
  } else {
    result = 18;
  }
  return result;
}

// returns the width of the marker
function getMarkerWidth() {
  let result;
  if (document.querySelector('.comments__marker-checkbox')) {
    let el = getComputedStyle(document.querySelector('.comments__marker-checkbox'));
    result = el.width.split('px')[0] / 2 + el.left.split('px')[0] / 2;
  } else {
    result = 12.5;
  }
  return result;
}

// returns the form
function createForm(coordX, coordY, message, timestamp, id) {
  const form = document.createElement('form');
  form.classList.add('comments__form');

  const marker = document.createElement('span');
  marker.classList.add('comments__marker');

  const input = document.createElement('input');
  input.classList.add('comments__marker-checkbox');
  input.type = "checkbox";

  const commentsBody = document.createElement('div');
  commentsBody.classList.add('comments__body');

  const textarea = document.createElement('textarea');
  textarea.classList.add('comments__input');
  textarea.type = "text";
  textarea.placeholder = "Write a comment…";

  const close = document.createElement('input');
  close.classList.add('comments__close');
  close.type = "button";
  close.value = "Close";

  const submit = document.createElement('input');
  submit.classList.add('comments__submit');
  submit.type = "submit";
  submit.value = "Submit";

  if (document.querySelector('#comments-off').checked) {
    form.style.display = 'none';
  }

  form.appendChild(marker);
  form.appendChild(input);
  form.appendChild(commentsBody);
  commentsBody.appendChild(textarea);
  commentsBody.appendChild(close);
  commentsBody.appendChild(submit);

  if (message && timestamp) {
    const comment = addNewComment(message, timestamp, id);
    commentsBody.insertBefore(comment, commentsBody.querySelector('.comments__input'));
  }

  submit.addEventListener('click', (event) => sendMessage(textarea.value, coordX, coordY));
  close.addEventListener('click', () => {
    input.checked = false
  });
  textarea.addEventListener('focus', textareaFocus);

  function textareaFocus() {
    textarea.value = '';
  }

  const sendMessage = (message, left, top) => {
    event.preventDefault();
    if (textarea.value === textarea.placeholder) {
      return;
    }

    const imageId = getUrlImageId();

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${url}/pic/${imageId}/comments`);
    xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
    xhr.send(JSON.stringify({
      message: message,
      left: left,
      top: top
    }));

    const loader = addLoader();
    commentsBody.appendChild(loader);

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        loader.remove();
        textarea.value = textarea.placeholder;
      } else {
        console.log('comment has not been sent');
      }
    });
  }

  return form;
}

// возвращает новый комментарий
function addNewComment(message, timestamp, id) {
  const comment = document.createElement('div');
  comment.classList.add('comment');
  comment.dataset.id = id;

  const commentTime = document.createElement('p');
  commentTime.classList.add('comment__time');
  commentTime.textContent = `${getDate(timestamp)}`;

  const commentMessage = document.createElement('p');
  commentMessage.classList.add('comment__message');
  commentMessage.textContent = `${cutComment(message)}`;

  comment.appendChild(commentTime);
  comment.appendChild(commentMessage);

  return comment;
}

// if the comment does not fit in the line adds a space
function cutComment(string) {
  if (string.length > 25) {
    let first = string.substring(0, 26);
    let last = cutComment(string.substring(26));
    return `${first} ${last}`;
  } else {
    return string;
  }
}

// returns the date of the comment
function getDate(timestamp) {
  const options = {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  };

  const date = new Date(timestamp);
  let dateStr = date.toLocaleString(options);
  return dateStr.slice(0, 6) + dateStr.slice(8, 10) + dateStr.slice(11);
}

// returns loader
function addLoader() {
  const comment = document.createElement('div');
  comment.classList.add('comment');

  const loader = document.createElement('div');
  loader.classList.add('loader');

  for (let i = 0; i < 5; i++) {
    const span = document.createElement('span');
    loader.appendChild(span);
  }

  comment.appendChild(loader);

  return comment;
}

// makes the transferred form active
function makeActiveForm(currentForm) {
  document.querySelectorAll('.comments__form').forEach(form => {
    form.style.zIndex = 5;
    if (form !== currentForm) {
      if (form.querySelectorAll('.comment').length < 1) {
        form.remove();
      }
      form.querySelector('.comments__marker-checkbox').checked = false;
    }
  })
  currentForm.style.zIndex = 10;
}

// sets the form parameters
function setForm(coordX, coordY, message, timestamp, id) {
  const form = createForm(coordX, coordY, message, timestamp, id);

  // form coordinates
  form.style.left = coordX + 'px';
  form.style.top = coordY + 'px';
  form.dataset.left = coordX;
  form.dataset.top = coordY;
  document.querySelector('.comments__wrap').appendChild(form);

  makeActiveForm(form);
}

// adds a form
function addForm(coordX, coordY) {
  if (document.querySelector('.comments').dataset.state === 'selected' && document.querySelector('#comments-on').checked) {
    if (event.target.classList.contains('comments__wrap') || event.target.classList.contains('mask')) {

      // координаты меняем с учетом позиции маркера
      coordX -= getMarkerWidth();
      coordY -= getMarkerHeight();

      setForm(coordX, coordY);

    } else if (event.target.classList.contains('comments__marker-checkbox')) {

      const currentForm = event.target.parentElement;
      makeActiveForm(currentForm);
    }
  }
}

//----------- PICTURE ---------------

createInputUploadImage();
document.querySelector('.new > input').addEventListener('change', addNewImage, false);

// hides the image
function hideImage() {
  document.querySelector('.current-image').style.display = 'none';
}

// shows the image
function showImage() {
  document.querySelector('.current-image').style.display = 'block';
}

// sets the src of the image
function setSrcImage(link) {
  document.querySelector('.current-image').src = `${link}?nocache=${Date.now()}`;
}

// adds an image
function addNewImage() {
  setImage(this.files[0]);
}

// sets the image
function setImage(file) {

  // create a form to send with XMLHttpRequest
  const formData = new FormData();
  formData.append('title', file.name);
  formData.append('image', file);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${url}/pic`);
  xhr.send(formData);

  // hides image and error, shows loader
  hideImage();
  hideError();
  hideCommentsWrap();
  hideCanvas();
  showLoader();

  xhr.addEventListener('load', () => {
    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);

      // changes the received id in the url
      changeUrl(data.id);
      // sets the url in share mode
      setUrl();
      // connect to a websocket by image id
      connectWebSocket(data.id);

    } else {
      // hides the loader and shows an error
      hideLoader();
      showError();
    }
  });
}

//--- Input - loading of the image ------

// creates an input to load the image
function createInputUploadImage() {
  if (document.querySelector('.new > input')) {
    return
  }

  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('class', 'input-image');
  input.setAttribute('style', 'display:none');
  input.setAttribute('accept', 'image/*');
  document.querySelector('.new').appendChild(input);
}

// causes a click on input
function clickToInput() {
  const input = document.querySelector('.new > input');
  if (input) {
    input.click();
  }
}

//-------- Drag and Drop - image loading ----------------

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  document.querySelector('.app').addEventListener(eventName, preventDefaults, false)
});

['dragenter', 'dragover'].forEach(eventName => {
  document.querySelector('.app').addEventListener(eventName, highlight, false)
});

['dragleave', 'drop'].forEach(eventName => {
  document.querySelector('.app').addEventListener(eventName, unhighlight, false)
});

document.querySelector('.app').addEventListener('drop', handleDrop, false);

// cancels the default action
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// adds highlight
function highlight(e) {
  document.querySelector('.app').classList.add('highlight');
}

// removes highlight
function unhighlight(e) {
  document.querySelector('.app').classList.remove('highlight');
}

// drop
function handleDrop(e) {
  let dt = e.dataTransfer;
  let files = dt.files;
  setImage(files[0])
}

//----------- CURVES ---------------

const canvas = document.createElement('canvas');
canvas.classList.add('canvas');
document.querySelector('.app').appendChild(canvas);

// makes canvas the same size as the image
function changeSizeCanvas() {
  const image = document.querySelector('.current-image');
  canvas.width = image.width;
  canvas.height = image.height;
}

// hides canvas
function hideCanvas() {
  document.querySelector('.canvas').style.display = 'none';
}

// shows canvas
function showCanvas() {
  document.querySelector('.canvas').style.display = 'block';
}

const ctx = canvas.getContext('2d');
let curves = [];
const brushRadius = 4;
let currentColor = '#6cbe47';

let drawing = false;
let needsRepaint = false;

// change the line colour
const colors = document.querySelectorAll('.menu__color');
for (const color of colors) {
  color.addEventListener('change', (event) => changeColor(color));
}

function changeColor(color) {
  if (!color.checked) return;
  currentColor = color.value;
}

// draws a point
function circle(point) {
  ctx.beginPath();
  ctx.arc(...point, brushRadius / 2, 0, 2 * Math.PI);
  ctx.fill();
}

// draws a smooth line between the points
function smoothCurveBetween(p1, p2) {
  const cp = p1.map((coord, idx) => (coord + p2[idx]) / 2);
  ctx.quadraticCurveTo(...p1, ...cp);
}

// draws a smooth line between multiple points
function smoothCurve(points) {
  ctx.beginPath();
  ctx.lineWidth = brushRadius;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.moveTo(...points[0]);

  for (let i = 1; i < points.length - 1; i++) {
    smoothCurveBetween(points[i], points[i + 1]);
  }
  ctx.stroke();
}

// creates point coordinates
function makePoint(x, y) {
  return [x, y];
}

canvas.addEventListener('mousedown', canvasMouseDown);
canvas.addEventListener('mouseup', canvasMouseUp);
canvas.addEventListener('mouseleave', () => {
  drawing = false
});
canvas.addEventListener('mousemove', canvasMouseMove);

function canvasMouseDown(event) {
  if (document.querySelector('.draw').dataset.state !== 'selected') return;
  drawing = true;

  const curve = {
    id: Date.now(),
    color: currentColor,
    path: [makePoint(event.offsetX, event.offsetY)]
  };
  curves.push(curve);

  needsRepaint = true;
}

function canvasMouseMove(event) {
  if (document.querySelector('.draw').dataset.state !== 'selected') return;

  if (drawing) {
    const point = makePoint(event.offsetX, event.offsetY);
    curves[curves.length - 1].path.push(point);
    needsRepaint = true;
  }
}

function canvasMouseUp() {
  drawing = false;

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${url}/pic/${getUrlImageId()}/curves`);
  xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
  xhr.send(JSON.stringify(curves[curves.length - 1]));
}

// render curves
function repaint() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  curves.forEach(curve => {
    ctx.strokeStyle = curve.color;
    ctx.fillStyle = curve.color;
    circle(curve.path[0]);
    smoothCurve(curve.path);
  });
}

document.querySelector('.menu__eraser').addEventListener('click', eraseLine);

// erases the last curve
function eraseLine() {
  if (curves.length > 0) {
    curves.pop();
    needsRepaint = true;
  }
}

function tick() {
  // Отрисовываем
  if (needsRepaint) {
    repaint();
    needsRepaint = false;
  }

  window.requestAnimationFrame(tick);
}

tick();

//----------- URL ---------------

document.querySelector('.menu_copy').addEventListener('click', copyUrl);

// returns the image id from the url
function getUrlImageId() {
  let imageId = window.location.href.split('?')[1];
  return imageId ? imageId.split('=')[1] : false;
}

// change the image id in the url
function changeUrl(id) {
  let link = window.location.href.split('?')[0];
  window.location.href = `${link}?imageId=${id}`;
}

// saves the url in the share section
function setUrl() {
  document.querySelector('.menu__url').value = window.location.href;
}

// copies the url to the buffer
function copyUrl() {
  const menuUrl = document.querySelector('.menu__url');
  menuUrl.focus();
  menuUrl.select();
  // link copy verification
  try {
    document.execCommand('copy');
  } catch (err) {
    console.log(`Ошибка: ${err}`);
  }
}

//----------- MENU ---------------

document.querySelectorAll('.menu > .mode').forEach(item => item.addEventListener('click', onClickMode));
document.querySelector('.burger').addEventListener('click', menuDefault);

// show initial menu
function menuInitial() {
  document.querySelector('.menu').dataset.state = 'initial';
}

// show default menu
function menuDefault() {
  document.querySelector('.menu').dataset.state = 'default';
  document.querySelectorAll('.menu > .mode').forEach(item => item.dataset.state = '');
}

// show menu with the selected category
function menuSelected(mode) {
  document.querySelector('.menu').dataset.state = 'selected';
  mode.dataset.state = 'selected';
  if (!mode.classList.contains('comments')) {
    document.querySelectorAll('.comments__marker-checkbox').forEach(marker => {
      marker.checked = false
    });
  }

  if (mode.classList.contains('draw')) {
    document.querySelector('.canvas').style.zIndex = 15;
  } else {
    document.querySelector('.canvas').style.zIndex = 3;
  }
}

// handles menu clicks
function onClickMode(event) {
  const item = event.currentTarget;

  if (item.classList.contains('new')) {
    clickToInput();
  } else {
    menuSelected(item);
  }
}

// if the menu is not long enough
function checkMenuLength() {
  const menu = document.querySelector('.menu');
  const wrap = document.querySelector('.wrap');
  if (menu.offsetHeight > 100) {
    menu.style.left = '0px';
    menu.style.left = (wrap.offsetWidth - menu.offsetWidth - 1) + 'px';
  }
}

// checks that the menu is displayed correctly
function checkMenuLengthTick() {
  checkMenuLength();
  window.requestAnimationFrame(checkMenuLengthTick);
}

checkMenuLengthTick();

//-------- Drag and Drop Menu ----------------

// pass a menu item to the function
dragElement(document.querySelector('.menu'));

function dragElement(element) {

  const wrap = document.querySelector('.wrap');
  let minY, minX, maxX, maxY;
  let shiftX = 0;
  let shiftY = 0;

  document.querySelector('.drag').addEventListener('mousedown', startDrag);

  function startDrag(event) {
    // начальные позиции
    minY = wrap.offsetTop;
    minX = wrap.offsetLeft;
    maxX = wrap.offsetLeft + wrap.offsetWidth - element.offsetWidth;
    maxY = wrap.offsetTop + wrap.offsetHeight - element.offsetHeight;
    shiftX = event.pageX - element.getBoundingClientRect().left - window.pageXOffset;
    shiftY = event.pageY - element.getBoundingClientRect().top - window.pageYOffset;

    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', drop);
  }

  function drag(event) {
    // new entries
    let x, y;
    x = event.pageX - shiftX;
    y = event.pageY - shiftY;
    x = Math.min(x, maxX);
    y = Math.min(y, maxY);
    x = Math.max(x, minX);
    y = Math.max(y, minY);
    element.style.left = x + 'px';
    element.style.top = y + 'px';
  }

  function drop() {
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', drop);
  }
}

//----------- ERROR ---------------

// hides error
function hideError() {
  document.querySelector('.error').style.display = 'none';
}

// shows error
function showError() {
  document.querySelector('.error').style.display = 'block';
}

//----------- LOADER ---------------

// hides loader
function hideLoader() {
  document.querySelector('.image-loader').style.display = 'none';
}

// shows loader
function showLoader() {
  document.querySelector('.image-loader').style.display = 'block';
}

function start() {
  const imageId = getUrlImageId();
  if (imageId) {
    connectWebSocket(imageId);
    menuSelected(document.querySelector('.comments'));
    setUrl();
  } else {
    menuInitial();
  }
}

start();