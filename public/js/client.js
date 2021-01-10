//-----------WEBSOCKET---------------

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

    if (dataParse.event === "pic") {
      const {pic} = dataParse;

      showImage();
      setSrcImage(pic.url);
      hideLoader();

      document.querySelector('.current-image').addEventListener('load', () => {
        showCommentsWrap();
        showCanvas();
        showMask();
        // сделать размер commnets wrap и canvas как у изображения
        changeSizeCommentsWrap();
        changeSizeCanvas();

        // отрисовываем полученные комментарии и штрихи пользователей
        drawMask(pic.mask);
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
    } else if (dataParse.event === "mask") {
      drawMask(dataParse.url);

    } else if (dataParse.event === "error") {
      console.log('Произошла ошибка');
      console.log(event);
    }
  });

  //	закрываем соединение веб сокет
  webSocket.addEventListener('close', event => {
    console.log('Вэбсокет соединение закрыто');
    console.log(event);
  });

  window.addEventListener('beforeunload', () => {
    webSocket.close(1000, 'Работа закончена');
  });

}

// создает формы с комментариями
function createFormsAndComments(comments) {
  comments.forEach(comment => {
    let needCreateNewForm = true;
    const {left, top, message, timestamp, id} = comment;

    document.querySelectorAll('.comments__form').forEach(form => {
      // если уже существует форма с заданными координатами left и top, добавляем сообщение в эту форму
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

// отображает рисунок
function drawMask(url) {
  if (!url) return;
  document.querySelector('.mask').src = url;
}


//-----------КОМЕНТАРИИ---------------

const commentsWrap = document.createElement('div');
document.querySelector('.app').appendChild(commentsWrap);
commentsWrap.classList.add('comments__wrap');

// показать/ скрыть комментарии 
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

// изменить размер comments wrap
function changeSizeCommentsWrap() {
  document.querySelector('.comments__wrap').style.display = 'block';
  document.querySelector('.comments__wrap').style.width = `${document.querySelector('.current-image').width}px`;
  document.querySelector('.comments__wrap').style.height = `${document.querySelector('.current-image').height}px`;
}

// скрыть comments wrap
function hideCommentsWrap() {
  document.querySelector('.comments__wrap').style.display = 'none';
}

// показать comments wrap
function showCommentsWrap() {
  document.querySelector('.comments__wrap').style.display = 'block';
}

// возвращает высоту маркера
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

// возвращает ширину маркера
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

// возвращает форму
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
  textarea.placeholder = "Напишите ответ...";

  const close = document.createElement('input');
  close.classList.add('comments__close');
  close.type = "button";
  close.value = "Закрыть";

  const submit = document.createElement('input');
  submit.classList.add('comments__submit');
  submit.type = "submit";
  submit.value = "Отправить";

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
        console.log('комментарий не отправлен');
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

// если коментарий не взлезает в строку добавляет пробел
function cutComment(string) {
  if (string.length > 25) {
    let first = string.substring(0, 26);
    let last = cutComment(string.substring(26));
    return `${first} ${last}`;
  } else {
    return string;
  }
}

// возращает дату комментария
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

// возвращает loader
function addLoader() {
  const comment = document.createElement('div');
  comment.classList.add('comment');

  const loader = document.createElement('div');
  loader.classList.add('loader');

  for (i = 0; i < 5; i++) {
    const span = document.createElement('span');
    loader.appendChild(span);
  }

  comment.appendChild(loader);

  return comment;
}

// делает переданную форму активной
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

// задает параметры формы
function setForm(coordX, coordY, message, timestamp, id) {
  const form = createForm(coordX, coordY, message, timestamp, id);

  // координаты формы
  form.style.left = coordX + 'px';
  form.style.top = coordY + 'px';
  form.dataset.left = coordX;
  form.dataset.top = coordY;
  document.querySelector('.comments__wrap').appendChild(form);

  makeActiveForm(form);
}

// добавляет форму
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

//-----------ИЗОБРАЖЕНИЕ---------------

createInputUploadImage();
document.querySelector('.new > input').addEventListener('change', addNewImage, false);

// скрывает изображение
function hideImage() {
  document.querySelector('.current-image').style.display = 'none';
}

// показывает изображение
function showImage() {
  document.querySelector('.current-image').style.display = 'block';
}

// устанавливает src изображения
function setSrcImage(link) {
  document.querySelector('.current-image').src = `${link}`;
}

// добавляет изображение
function addNewImage() {
  setImage(this.files[0]);
}

// устанавливает изображение
function setImage(file) {

  // создаем форму для отправки xhr
  const formData = new FormData();
  formData.append('title', file.name);
  formData.append('image', file);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${url}/pic`);
  xhr.send(formData);

  // скрывает изображение и ошибку, показывает loader 
  hideImage();
  hideError();
  hideCommentsWrap();
  hideMask();
  hideCanvas();
  showLoader();

  xhr.addEventListener('load', () => {
    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      // console.log(data);
      // console.log(`Файл ${file.name} сохранен.`);

      // меняет в url полученный id
      changeUrl(data.id);
      // устанавливает url в  режиме поделиться
      setUrl();
      // подключение к вебсокету по id изображения
      connectWebSocket(data.id);

    } else {
      // скрывет loader и показывает ошибку
      hideLoader();
      showError();
    }
  });
}

//--- Input загрузка изображения ------

// создает input для загрузки изображения
function createInputUploadImage() {
  if (document.querySelector('.new > input')) {
    return
  }
  ;
  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('class', 'input-image');
  input.setAttribute('style', 'display:none');
  input.setAttribute('accept', 'image/*');
  document.querySelector('.new').appendChild(input);
}

// вызывает клик на input
function clickToInput() {
  const input = document.querySelector('.new > input');
  if (input) {
    input.click();
  }
}

//-------- Drag and Drop загрузка изображения ----------------

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

// отменяет действие по умолчанию
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// добавляет обводку экрана
function highlight(e) {
  document.querySelector('.app').classList.add('highlight');
}

// убирает обводку экрана
function unhighlight(e) {
  document.querySelector('.app').classList.remove('highlight');
}

// drop
function handleDrop(e) {
  let dt = e.dataTransfer;
  let files = dt.files;
  setImage(files[0])
}

//-----------РИСОВАНИЕ---------------

const canvas = document.createElement('canvas');
canvas.classList.add('canvas');
document.querySelector('.app').appendChild(canvas);

const mask = document.createElement('img');
mask.src = './images/transparent.png';
mask.classList.add('mask');
commentsWrap.appendChild(mask);

// делает размер canvas как у изображения
function changeSizeCanvas() {
  const image = document.querySelector('.current-image');
  canvas.width = image.width;
  canvas.height = image.height;
}

// скрывает canvas
function hideCanvas() {
  document.querySelector('.canvas').style.display = 'none';
}

// показывает canvas
function showCanvas() {
  document.querySelector('.canvas').style.display = 'block';
}

// скрывает mask
function hideMask() {
  document.querySelector('.mask').style.display = 'none';
}

// показывает mask
function showMask() {
  document.querySelector('.mask').style.display = 'block';
}


const ctx = canvas.getContext('2d');
let curves = [];
const brushRadius = 4;
let currentColor = '#6cbe47';

let drawing = false;
let needsRepaint = false;
let curvesNumberToRemoveNextTime = 0;

// изменить цвет линии
const colors = document.querySelectorAll('.menu__color');
for (const color of colors) {
  color.addEventListener('change', (event) => changeColor(color));
}

function changeColor(color) {
  if (!color.checked) return;
  currentColor = color.value;
}

// рисует точку
function circle(point) {
  ctx.beginPath();
  ctx.arc(...point, brushRadius / 2, 0, 2 * Math.PI);
  ctx.fill();
}

// рисует плавную линию между точками
function smoothCurveBetween(p1, p2) {
  const cp = p1.map((coord, idx) => (coord + p2[idx]) / 2);
  ctx.quadraticCurveTo(...p1, ...cp);
}

// рисует плавную линию между множеством точек
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

// задает координаты точки 
function makePoint(x, y) {
  return [x, y];
}

canvas.addEventListener('mousedown', canvasMouseDown);
canvas.addEventListener('mouseup', () => {
  drawing = false
});
canvas.addEventListener('mouseleave', () => {
  drawing = false
});
canvas.addEventListener('mousemove', canvasMouseMove);

function canvasMouseDown(event) {
  if (document.querySelector('.draw').dataset.state !== 'selected') return;
  drawing = true;

  const curve = [];
  curve.color = currentColor;

  curve.push(makePoint(event.offsetX, event.offsetY));
  curves.push(curve);
  needsRepaint = true;
}


function canvasMouseMove(event) {
  if (document.querySelector('.draw').dataset.state !== 'selected') return;

  if (drawing) {
    const point = makePoint(event.offsetX, event.offsetY);
    curves[curves.length - 1].push(point);
    needsRepaint = true;
    trottledSendMask();
  }
}

//  Рендер линий
function repaint() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  curves.forEach(curve => {
    ctx.strokeStyle = curve.color;
    ctx.fillStyle = curve.color;
    circle(curve[0]);
    smoothCurve(curve);
  });
}

document.querySelector('.menu__eraser').addEventListener('click', eraseLine);

// стриает последнюю линюю
function eraseLine() {
  if (curves.length > 0) {
    curves.pop();
    needsRepaint = true;
  }
}

const trottledSendMask = throttleCanvas(sendMaskState, 1000);

function sendMaskState() {
  canvas.toBlob(function (blob) {
    webSocket.send(blob);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
}

// посылает данные на сервер не чаще 1 раза в несколько секунд
function throttleCanvas(callback, delay) {
  let isWaiting = false;
  return function () {
    if (!isWaiting) {
      isWaiting = true;
      setTimeout(() => {
        callback();
        isWaiting = false;
      }, delay);
    }
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


//-----------URL---------------

document.querySelector('.menu_copy').addEventListener('click', copyUrl);

// возвращает id изображения из url
function getUrlImageId() {
  let imageId = window.location.href.split('?')[1];
  return imageId ? imageId = imageId.split('=')[1] : false;
}

// изменить id изображения в url
function changeUrl(id) {
  let link = window.location.href.split('?')[0];
  window.location.href = `${link}?imageId=${id}`;
}

// записывает url в разделе поделиться
function setUrl() {
  document.querySelector('.menu__url').value = window.location.href;
}

// копирует url в буфер
function copyUrl() {
  const url = document.querySelector('.menu__url');
  url.focus();
  url.select();
  // проверка на копирование ссылки
  try {
    const successful = document.execCommand('copy');
    const msg = successful ? 'successful' : 'unsuccessful';
    //console.log(`Копирование ссылки ${msg}`);
  } catch (err) {
    console.log(`Ошибка: ${err}`);
  }
}


//-----------МЕНЮ---------------

document.querySelectorAll('.menu > .mode').forEach(item => item.addEventListener('click', onClickMode));
document.querySelector('.burger').addEventListener('click', menuDefault);

// устанавливает начальное меню
function menuInitial() {
  document.querySelector('.menu').dataset.state = 'initial';
}

// устанавливает меню по умолчанию
function menuDefault() {
  document.querySelector('.menu').dataset.state = 'default';
  document.querySelectorAll('.menu > .mode').forEach(item => item.dataset.state = '');
}

// устанавливает меню с выбранной категорией
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

// обрабатывает клик на меню
function onClickMode(event) {
  const item = event.currentTarget;

  if (item.classList.contains('new')) {
    clickToInput();
  } else {
    menuSelected(item);
  }
}

// если меню не хватает длины
function checkMenuLength() {
  const menu = document.querySelector('.menu');
  const wrap = document.querySelector('.wrap');
  if (menu.offsetHeight > 100) {
    menu.style.left = '0px';
    menu.style.left = (wrap.offsetWidth - menu.offsetWidth - 1) + 'px';
  }
}

// проверяет корректность отображения меню
function checkMenuLengthTick() {
  checkMenuLength();
  window.requestAnimationFrame(checkMenuLengthTick);
}

checkMenuLengthTick();


//-------- Drag and Drop Menu ----------------

// передаем в функцию элемент меню
dragElement(document.querySelector('.menu'));

function dragElement(elmnt) {

  const wrap = document.querySelector('.wrap');
  let minY, minX, maxX, maxY;
  let shiftX = 0;
  let shiftY = 0;

  document.querySelector('.drag').addEventListener('mousedown', startDrag);

  function startDrag(event) {
    // начальные позиции
    minY = wrap.offsetTop;
    minX = wrap.offsetLeft;
    maxX = wrap.offsetLeft + wrap.offsetWidth - elmnt.offsetWidth;
    maxY = wrap.offsetTop + wrap.offsetHeight - elmnt.offsetHeight;
    shiftX = event.pageX - elmnt.getBoundingClientRect().left - window.pageXOffset;
    shiftY = event.pageY - elmnt.getBoundingClientRect().top - window.pageYOffset;

    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', drop);
  }

  function drag(event) {
    // новые позиции
    let x, y;
    x = event.pageX - shiftX;
    y = event.pageY - shiftY;
    x = Math.min(x, maxX);
    y = Math.min(y, maxY);
    x = Math.max(x, minX);
    y = Math.max(y, minY);
    elmnt.style.left = x + 'px';
    elmnt.style.top = y + 'px';
  }

  function drop() {
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', drop);
  }
}

//-----------ERROR---------------

// скрывает ошибку
function hideError() {
  document.querySelector('.error').style.display = 'none';
}

// показывает ошибку
function showError() {
  document.querySelector('.error').style.display = 'block';
}

//-----------LOADER---------------

// скрывает loader
function hideLoader() {
  document.querySelector('.image-loader').style.display = 'none';
}

// показывает loader
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
