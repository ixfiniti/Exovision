document.addEventListener('DOMContentLoaded',()=>{
  const title=document.getElementById('siteTitle');
  if(title){ let t=0; setInterval(()=>{ t+=0.03; const glow=0.9+Math.sin(t)*0.12; title.style.filter=`brightness(${glow})`; },50); }
  const video=document.getElementById('bgvideo');
  if(video){ video.addEventListener('loadeddata',()=>{ video.style.display='block'; }); video.addEventListener('error',()=>{ video.style.display='none'; }); }
  const surprise = document.getElementById('surprise-btn');
  if(surprise){ surprise.addEventListener('click', ()=>{ fetch('/api/all').then(r=>r.json()).then(arr=>{ if(!arr||!arr.length) return; const idx=Math.floor(Math.random()*arr.length); location.href='/planet?name='+encodeURIComponent(arr[idx].name); }); }); }
});

// this file was just debugged using AI