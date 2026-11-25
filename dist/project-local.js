const runner = 'http://127.0.0.1:4175';
const site = location.origin === 'http://127.0.0.1:4187' ? 'preview' : 'hosted';
const viewer = document.querySelector('#project-viewer');
const action = document.querySelector('#project-run-local');
const setup = document.querySelector('#project-local-setup');
const status = document.querySelector('#project-local-status');
const panelState = document.querySelector('#project-state-label');
const panelHint = document.querySelector('#project-hint');
const buildState = document.querySelector('#project-status');
const build = document.querySelector('#project-live-build');
const frame = document.querySelector('#project-local-frame');
const phone = frame.closest('.phone');
let mode = 'idle', timer, dialog, challenge, grant, expires = 0, consentReady = false;

function show(next, message) {
  mode = next;
  panelState.textContent = next === 'live' ? '实时 · 本机' : '首页截图';
  panelHint.textContent = next === 'live' ? '可直接操作' : next === 'starting' ? '等待模拟器画面' : '点击「在我的设备运行」';
  buildState.textContent = next === 'live' ? '实时运行' : next === 'starting' ? '正在启动或连接' : '静态预览';
  status.textContent = message;
  frame.hidden = next !== 'live';
  phone.classList.toggle('recipient-live', next === 'live');
  action.disabled = next === 'starting' || next === 'authorizing';
  action.textContent = next === 'live' ? '断开实时预览' : '在我的设备运行';
  setup.hidden = next !== 'error';
}

function disconnect(message = '', next = 'idle') {
  clearTimeout(timer);
  if (dialog && !dialog.closed) dialog.close();
  dialog = null;
  challenge = null;
  if (['starting','live'].includes(mode)) {
    frame.contentWindow?.postMessage({type:'ditto-project-command',kind:'stop'},runner);
  }
  frame.removeAttribute('src');
  build.textContent = '本机连接后显示';
  show(next,message);
}

async function start() {
  show('starting','正在打开你的本地模拟器。收到实时画面前保留首页截图。');
  if (location.protocol === 'https:') {
    try {
      const permission = await navigator.permissions?.query({name:'loopback-network'});
      if (viewer.hidden || mode !== 'starting') return;
      if (permission?.state === 'denied') {
        disconnect('浏览器没有允许连接本机。可在站点设置中开启，然后重试。','error');
        return;
      }
    } catch {}
  }
  if (viewer.hidden || mode !== 'starting') return;
  const url = new URL('/embed-hosted',runner);
  url.searchParams.set('open','1');
  url.searchParams.set('grant',grant);
  url.searchParams.set('source',site);
  frame.src = url.href;
  timer = setTimeout(() => {
    grant = null;
    disconnect('没连到本地启动器。确认新版启动器仍在运行，然后重试。','error');
  },12000);
}

function requestConsent() {
  challenge = crypto.randomUUID();
  consentReady = false;
  const url = new URL('/authorize',runner);
  url.searchParams.set('challenge',challenge);
  url.searchParams.set('source',site);
  dialog = window.open(url.href,'_blank','popup,width=530,height=465');
  if (!dialog) return disconnect('请允许此页打开本地确认窗口，然后重试。','error');
  show('authorizing','首次在本页运行，请在本地启动器窗口确认。');
  const readyBy = Date.now()+6500, until = Date.now()+90000;
  const poll = () => {
    if (mode !== 'authorizing') return;
    if (dialog?.closed || (!consentReady && Date.now()>readyBy) || Date.now()>until) {
      disconnect('未连接。请打开新版启动器后重试；首页截图仍保留。','error');
    } else timer=setTimeout(poll,700);
  };
  timer=setTimeout(poll,700);
}

action.addEventListener('click', () => {
  if (mode === 'live') disconnect('已断开预览，模拟器保持运行。');
  else if (grant && Date.now()<expires) void start();
  else requestConsent();
});
new MutationObserver(() => {if (viewer.hidden) disconnect();})
  .observe(viewer,{attributes:true,attributeFilter:['hidden']});

window.addEventListener('message', event => {
  if (viewer.hidden || event.origin !== runner) return;
  const data = event.data;
  if (mode === 'authorizing' && event.source===dialog && data?.type==='ditto-project-consent-ready' && data.challenge===challenge) {
    consentReady=true;
    return;
  }
  if (mode === 'authorizing' && event.source===dialog && data?.type==='ditto-project-local-consent' &&
      data.challenge===challenge && /^[A-Za-z0-9_-]{32}$/.test(data.grant)) {
    clearTimeout(timer);
    grant=data.grant;
    expires=Date.now()+55*60*1000;
    dialog.close(); dialog=null; challenge=null;
    void start();
    return;
  }
  if (!['starting','live'].includes(mode) || event.source !== frame.contentWindow) return;
  if (data === 'ditto-project-bridge-ready') {
    clearTimeout(timer);
    timer=setTimeout(() => disconnect('模拟器还没返回实时画面。首页截图仍保留，可重试。','error'),150000);
    return;
  }
  if (data?.type !== 'ditto-project-status' || typeof data.label !== 'string') return;
  if (data.mode === 'live') {
    clearTimeout(timer);
    if (typeof data.build === 'string' && /^[A-Za-z0-9.+_() -]{1,90}$/.test(data.build)) build.textContent=data.build;
    show('live',data.label.slice(0,140));
  } else if (data.mode === 'starting') show('starting',data.label.slice(0,140));
  else if (data.mode === 'error' || (data.mode === 'idle' && mode === 'live')) disconnect(data.label.slice(0,140),'error');
});
