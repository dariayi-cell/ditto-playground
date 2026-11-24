function createPlayer(config) {
  const viewer = document.querySelector(`#${config.id}-viewer`);
  const screen = document.querySelector(`#${config.id}-screen`);
  const hotspots = document.querySelector(`#${config.id}-hotspots`);
  const stateLabel = document.querySelector(`#${config.id}-state-label`);
  const hint = document.querySelector(`#${config.id}-hint`);
  const status = document.querySelector(`#${config.id}-status`);
  let manifest;
  let current;

  function transitions() { return manifest?.transitions.filter(edge => edge.from === current) || []; }
  function show(stateId) {
    const state = manifest?.states.find(item => item.id === stateId);
    if (!state) return;
    current = stateId;
    screen.src = `${config.root}/${state.screen}`;
    const index = manifest.states.indexOf(state) + 1;
    stateLabel.textContent = `STATE ${String(index).padStart(2,'0')} / ${String(manifest.states.length).padStart(2,'0')}`;
    status.textContent = state.label.toUpperCase();
    hotspots.replaceChildren();
    const outgoing = transitions().filter(edge => Number.isFinite(edge.x) && Number.isFinite(edge.y));
    outgoing.forEach(edge => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'manifest-hotspot';
      button.style.left = `${edge.x / config.width * 100}%`;
      button.style.top = `${edge.y / config.height * 100}%`;
      button.setAttribute('aria-label', edge.label);
      const label = document.createElement('span');
      label.textContent = edge.label;
      button.append(label);
      button.addEventListener('click', () => show(edge.to));
      hotspots.append(button);
    });
    hint.textContent = outgoing.length ? outgoing.map(edge => edge.label.toUpperCase()).join(' · ') : 'RESET TO EXPLORE AGAIN';
  }
  async function load() {
    if (manifest) return;
    const response = await fetch(`${config.root}/manifest.json`);
    if (!response.ok) throw new Error('Snapshot unavailable');
    manifest = await response.json();
    document.querySelector(`#${config.id}-branch`).textContent = manifest.source?.branch || 'CAPTURED BRANCH';
    document.querySelector(`#${config.id}-build`).textContent = manifest.source?.build || 'CAPTURED BUILD';
    const version = document.querySelector(`#${config.id}-version`);
    version.textContent = manifest.source?.dittoVersion || `.ditto-play ${manifest.formatVersion}`;
    if (config.id === 'spark') document.querySelector('#spark-creator').textContent = manifest.creator?.name || 'Daria Yi';
  }
  async function open() {
    viewer.hidden = false;
    document.body.classList.add('viewer-open');
    try { await load(); show(manifest.entryState); } catch (error) { status.textContent = error.message.toUpperCase(); }
  }
  function close() { viewer.hidden = true; document.body.classList.remove('viewer-open'); document.querySelector(`#${config.id}-open`).focus({preventScroll:true}); }
  document.querySelector(`#${config.id}-open`).addEventListener('click', open);
  document.querySelector(`#${config.id}-reset`).addEventListener('click', () => show(manifest?.entryState));
  viewer.querySelector('.viewer-close').addEventListener('click', close);
  viewer.querySelector('.viewer-backdrop').addEventListener('click', close);
  screen.addEventListener('click', event => {
    const box = screen.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width * config.width;
    const y = (event.clientY - box.top) / box.height * config.height;
    const nearest = transitions().filter(edge => Number.isFinite(edge.x) && Number.isFinite(edge.y)).map(edge => ({edge,distance:Math.hypot(edge.x-x,edge.y-y)})).sort((a,b)=>a.distance-b.distance)[0];
    if (nearest?.distance < Math.max(config.width,config.height) * .12) show(nearest.edge.to);
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !viewer.hidden) close(); });
}

createPlayer({id:'project',root:'./snapshots/project-complete',width:1080,height:2400});
createPlayer({id:'spark',root:'./snapshots/spark-semantic',width:1260,height:2800});
