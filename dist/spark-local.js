const runner = 'http://127.0.0.1:4176';
const site = location.origin === 'http://127.0.0.1:4187' ? 'preview' : 'hosted';
const viewer = document.querySelector('#spark-viewer');
const topBuild = document.querySelector('#spark-top-build');
const opener = document.querySelector('#spark-open');
const open = () => { viewer.hidden=false; document.body.classList.add('viewer-open'); action.focus({preventScroll:true}); };
const close = () => { if(location.hash==='#spark-live') history.replaceState(null,'',location.pathname+location.search); viewer.hidden=true; document.body.classList.remove('viewer-open'); opener.focus({preventScroll:true}); };
const action = document.querySelector('#spark-run-local');
const setup = document.querySelector('#spark-local-setup');
const status = document.querySelector('#spark-local-status');
const panelState = document.querySelector('#spark-state-label');
const panelHint = document.querySelector('#spark-hint');
const buildState = document.querySelector('#spark-status');
const build = document.querySelector('#spark-live-build');
const frame = document.querySelector('#spark-local-frame');
const phone = frame.closest('.phone');
let mode = 'idle', timer, dialog, challenge, grant, expires = 0, consentReady = false;
const consentKey='ditto-spark-local-grant-v1';
try { const c=JSON.parse(sessionStorage.getItem(consentKey)); if(/^[A-Za-z0-9_-]{32}$/.test(c?.grant) && Number.isFinite(c.expires) && c.expires>Date.now()) ({grant,expires}=c); } catch {}
function forgetConsent(){ grant=null; expires=0; try{sessionStorage.removeItem(consentKey);}catch{} }

function show(next, message) {
  mode = next;
  panelState.textContent = next === 'live' ? '实时 · 本机' : '首页截图';
  panelHint.textContent = next === 'live' ? '可直接操作' : next === 'starting' ? '等待模拟器画面' : '点击「打开 Spark Live」';
  buildState.textContent = next === 'live' ? '实时运行' : next === 'starting' ? '正在启动或连接' : '静态预览';
  status.textContent = message;
  frame.hidden = next !== 'live';
  phone.classList.toggle('recipient-live', next === 'live');
  action.disabled = next === 'starting' || next === 'authorizing';
  action.textContent = next === 'live' ? '断开实时预览' : '打开 Spark Live';
  setup.hidden = next !== 'error';
}

function disconnect(message = '', next = 'idle') {
  clearTimeout(timer);
  if (dialog && !dialog.closed) dialog.close();
  dialog = null;
  challenge = null;
  frame.removeAttribute('src');
  build.textContent = topBuild.textContent = '本机连接后显示';
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
    forgetConsent();
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
opener.addEventListener('click', () => {if(location.hash!=='#spark-live') history.replaceState(null,'','#spark-live'); open(); action.click();});
viewer.querySelector('.viewer-close').addEventListener('click',close);
viewer.querySelector('.viewer-backdrop').addEventListener('click',close);
document.addEventListener('keydown',e=>{if(e.key==='Escape' && !viewer.hidden) close();});
if(location.hash==='#spark-live')open();
new MutationObserver(() => {if (viewer.hidden) disconnect();})
  .observe(viewer,{attributes:true,attributeFilter:['hidden']});

window.addEventListener('message', event => {
  if (viewer.hidden || event.origin !== runner) return;
  const data = event.data;
  if (mode === 'authorizing' && event.source===dialog && data?.type==='ditto-spark-consent-ready' && data.challenge===challenge) {
    consentReady=true;
    return;
  }
  if (mode === 'authorizing' && event.source===dialog && data?.type==='ditto-spark-local-consent' &&
      data.challenge===challenge && /^[A-Za-z0-9_-]{32}$/.test(data.grant)) {
    clearTimeout(timer);
    grant=data.grant;
    expires=Date.now()+55*60*1000;
    try{sessionStorage.setItem(consentKey,JSON.stringify({grant,expires}));}catch{}
    dialog.close(); dialog=null; challenge=null;
    void start();
    return;
  }
  if (!['starting','live'].includes(mode) || event.source !== frame.contentWindow) return;
  if (data === 'ditto-spark-bridge-ready') {
    clearTimeout(timer);
    timer=setTimeout(() => disconnect('模拟器还没返回实时画面。首页截图仍保留，可重试。','error'),150000);
    return;
  }
  if (data?.type !== 'ditto-spark-status' || typeof data.label !== 'string') return;
  if (data.mode === 'live') {
    clearTimeout(timer);
    if (typeof data.build === 'string' && /^[A-Za-z0-9.+_() -]{1,90}$/.test(data.build)) build.textContent=topBuild.textContent=data.build;
    show('live',data.label.slice(0,140));
  } else if (data.mode === 'starting') show('starting',data.label.slice(0,140));
  else if (data.mode === 'error' || (data.mode === 'idle' && mode === 'live')) disconnect(data.label.slice(0,140),'error');
});
