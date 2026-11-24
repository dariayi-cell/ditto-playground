const runner = 'http://127.0.0.1:4175';
const viewer = document.querySelector('#project-viewer');
const action = document.querySelector('#project-run-local');
const setup = document.querySelector('#project-local-setup');
const code = document.querySelector('#project-local-code');
const status = document.querySelector('#project-local-status');
const frame = document.querySelector('#project-local-frame');
const phone = frame.closest('.phone');
let epoch = 0, mode = 'idle', timer;

function show(next, message) {
  mode = next;
  status.textContent = message;
  frame.hidden = next !== 'live';
  phone.classList.toggle('recipient-live', next === 'live');
  if (next === 'live' || next === 'idle' || next === 'error') clearTimeout(timer);
  action.disabled = next === 'starting';
  action.textContent = next === 'live' ? '断开实时预览' : '在我的设备运行';
}

function disconnect(message = '') {
  ++epoch;
  if (mode === 'live') frame.contentWindow?.postMessage({type:'ditto-project-command',kind:'stop'},runner);
  frame.removeAttribute('src');
  show('idle', message);
}

async function connect() {
  if (!/^[A-Za-z0-9_-]{24}$/.test(code.value.trim())) {
    setup.hidden = false;
    status.textContent = '首次使用，打开本地启动器，填连接码。';
    code.focus();
    return;
  }
  const current = ++epoch;
  if (location.protocol === 'https:') {
    try {
      const permission = await navigator.permissions?.query({name:'loopback-network'});
      if (epoch !== current || viewer.hidden) return;
      if (permission?.state === 'denied') {
        setup.hidden = false;
        show('error','浏览器未允许连接本机。可在站点设置中允许，或用本机窗口预览。');
        return;
      }
    } catch {}
  }
  if (epoch !== current || viewer.hidden) return;
  setup.hidden = true;
  show('starting', '正在连接你的本地设备，首页截图会保留到收到实时画面。');
  const url = new URL('/embed-hosted',runner);
  url.searchParams.set('open','1');
  url.searchParams.set('code',code.value.trim());
  frame.src = url.href;
  timer = setTimeout(() => {
    disconnect();
    setup.hidden = false;
    show('error','没连到启动器。确认它正在运行，且浏览器允许此页面连接本机。');
  }, 12000);
}

action.addEventListener('click', () => mode === 'live' ? disconnect('已断开。') : void connect());
setup.addEventListener('submit', event => { event.preventDefault(); void connect(); });
new MutationObserver(() => {
  if (viewer.hidden) {
    disconnect();
    setup.hidden = true;
  }
}).observe(viewer,{attributes:true,attributeFilter:['hidden']});

window.addEventListener('message', event => {
  if (viewer.hidden || !['starting','live'].includes(mode) ||
      event.origin !== runner || event.source !== frame.contentWindow) return;
  if (event.data === 'ditto-project-bridge-ready') {
    clearTimeout(timer);
    timer = setTimeout(() => {
      disconnect();
      show('error','启动器没有收到实时画面。还可以直接回放原来的截图。');
      setup.hidden = false;
    }, 150000);
    return;
  }
  const data = event.data;
  if (data?.type !== 'ditto-project-status' || typeof data.label !== 'string') return;
  if (data.mode === 'live' || data.mode === 'starting') show(data.mode, data.label.slice(0,140));
  else if (data.mode === 'error' || (data.mode === 'idle' && mode === 'live')) {
    disconnect();
    show('error', data.label.slice(0,140));
    setup.hidden = false;
  }
});
