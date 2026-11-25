{
  const viewer = document.querySelector('#project-viewer');
  const opener = document.querySelector('#project-open');
  let loaded = false;
  opener.addEventListener('click',async () => {
    viewer.hidden=false;
    document.body.classList.add('viewer-open');
    if (loaded) return;
    try {
      const response=await fetch('./snapshots/project-complete/manifest.json');
      if (!response.ok) throw Error('Project build metadata unavailable');
      const manifest=await response.json();
      for (const [id,value] of Object.entries({
        branch:manifest.source?.branch, build:manifest.source?.build,
        version:manifest.source?.dittoVersion || `.ditto-play ${manifest.formatVersion}`,
        'capture-commit':manifest.source?.commit,
      })) document.querySelector('#project-'+id).textContent=value || '—';
      loaded=true;
    } catch {
      for (const id of ['branch','build','version','capture-commit']) document.querySelector('#project-'+id).textContent='—';
    }
  });
  const close=()=>{viewer.hidden=true;document.body.classList.remove('viewer-open');opener.focus({preventScroll:true});};
  viewer.querySelector('.viewer-close').addEventListener('click',close);
  viewer.querySelector('.viewer-backdrop').addEventListener('click',close);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!viewer.hidden) close();});
}
