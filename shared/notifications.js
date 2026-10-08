(() => {
  'use strict';
  window.NotificationInbox=class{
    constructor(root,load,mark,open){
      Object.assign(this,{
        root,load,mark,open,active:false,loading:false,seen:new Set(),data:{
          notifications:[],unreadCount:0
        }
      });
      this.lockedMessage=root.closest('#ordersPanel, #admin')?'Enter the admin password once for 30 minutes of automatic updates.':'Sign in to see your notifications.';
      this.dock=document.createElement('aside');
      this.dock.className='notification-dock';
      this.dock.setAttribute('aria-label','Notifications');
      this.dock.setAttribute('aria-live','polite');
      const head=document.createElement('header');
      this.title=document.createElement('strong');
      this.title.textContent='Notifications';
      const expand=document.createElement('button');
      expand.type='button';
      expand.textContent='View all';
      expand.onclick=()=>this.show();
      head.append(this.title,expand);
      this.soundsEnabled=false;
      const sound=document.createElement('button');
      sound.type='button';
      sound.className='notification-sound-toggle';
      sound.textContent='🔕';
      sound.title='Enable notification sound';
      sound.setAttribute('aria-label','Enable notification sound');
      sound.onclick=()=>{
        this.soundsEnabled=!this.soundsEnabled;
        sound.textContent=this.soundsEnabled?'🔔':'🔕';
        sound.title=this.soundsEnabled?'Mute notification sound':'Enable notification sound';
        sound.setAttribute('aria-label',sound.title);
      };
      head.append(sound);
      this.counts=document.createElement('span');
      this.counts.className='notification-count-badge';
      head.append(this.counts);
      this.preview=document.createElement('div');
      this.preview.className='notification-preview';
      this.preview.textContent=this.lockedMessage;
      this.dockCounts=document.createElement('div');
      this.dockCounts.className='notification-status-icons';
      this.dock.append(head,this.dockCounts,this.preview);
      document.body.append(this.dock);
      this.dialog=document.createElement('dialog');
      this.dialog.className='notification-modal';
      this.dialog.setAttribute('aria-label','Notification history');
      const close=document.createElement('button');
      close.type='button';
      close.textContent='Close';
      close.onclick=()=>this.dialog.close();
      this.list=document.createElement('section');
      this.summary=document.createElement('section');
      this.summary.className='notification-order-summary';
      const bar=document.createElement('div');bar.className='notification-window-bar';
      const grip=document.createElement('button');grip.type='button';grip.className='notification-drag-handle';grip.textContent='Notifications · drag to move';grip.setAttribute('aria-label','Move notifications window. Use arrow keys to move.');
      bar.append(grip,close);
      const body=document.createElement('div');body.className='notification-window-body';body.append(this.summary,this.list);
      const resize=document.createElement('button');resize.type='button';resize.className='notification-resize-handle';resize.textContent='↘';resize.setAttribute('aria-label','Resize notifications window. Use arrow keys to resize.');
      this.dialog.append(bar,body,resize);
      this.place=(x,y,w,h)=>{
        const vw=window.innerWidth,vh=window.innerHeight;
        w=Math.min(vw-16,Math.max(Math.min(320,vw-16),w));h=Math.min(vh-16,Math.max(Math.min(240,vh-16),h));
        this.geometry={x:Math.max(8,Math.min(vw-w-8,x)),y:Math.max(8,Math.min(vh-h-8,y)),w,h};
        const g=this.geometry;Object.assign(this.dialog.style,{left:g.x+'px',top:g.y+'px',width:g.w+'px',height:g.h+'px'});
      };
      const bind=(handle,resizing)=>{
        handle.addEventListener('pointerdown',event=>{
          if(event.button!==0)return;
          const rect=this.dialog.getBoundingClientRect();const start={x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,w:rect.width,h:rect.height};
          handle.setPointerCapture(event.pointerId);event.preventDefault();
          const move=e=>{if(e.pointerId!==event.pointerId)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;this.place(start.left+(resizing?0:dx),start.top+(resizing?0:dy),start.w+(resizing?dx:0),start.h+(resizing?dy:0));};
          const end=e=>{if(e.pointerId!==event.pointerId)return;handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);handle.removeEventListener('lostpointercapture',end);};
          handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);handle.addEventListener('lostpointercapture',end);
        });
        handle.addEventListener('keydown',event=>{
          const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];if(!delta)return;event.preventDefault();
          const r=this.dialog.getBoundingClientRect();this.place(r.left+(resizing?0:delta[0]),r.top+(resizing?0:delta[1]),r.width+(resizing?delta[0]:0),r.height+(resizing?delta[1]:0));
        });
      };
      bind(grip,false);bind(resize,true);
      this.fitWindow=()=>{if(this.geometry){const g=this.geometry;this.place(g.x,g.y,g.w,g.h);}};
      window.addEventListener('resize',this.fitWindow);
      document.body.append(this.dialog);
      this.view=root.closest('.view');
      this.syncView=()=>{
        this.dock.hidden=!!this.view?.hidden;
      };
      if(this.view){
        this.observer=new MutationObserver(this.syncView);
        this.observer.observe(this.view,{
          attributes:true,attributeFilter:['hidden']
        });
      }
      this.syncView();
      this.timer=setInterval(()=>{
        if(this.active&&!document.hidden)this.refresh().catch(()=>{
          this.preview.textContent='Could not check updates. Retrying automatically.';
        });
      },300000);
      this.root.replaceChildren();
      this.list.textContent=this.lockedMessage;
    }
    setOrderSummary(counts, select, note=''){
      this.summary.replaceChildren();
      this.dockCounts.replaceChildren();
      if(!counts)return;
      const icons={New:'<path d="M12 5v14M5 12h14"/>',Confirmed:'<path d="m5 12 4 4L19 6"/>',Preparing:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',Delivered:'<path d="M3 6h11v11H3zM14 10h4l3 4v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',Cancelled:'<path d="m6 6 12 12M18 6 6 18"/>'};
      for(const [status,count] of Object.entries(counts)){
        const button=document.createElement('button');button.type='button';button.className='notification-status-icon '+status.toLowerCase();
        button.title=status+': '+count;button.setAttribute('aria-label',status+' orders: '+count);
        const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');
        icon.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(icons[status]||icons.New)+'</svg>';
        const number=document.createElement('strong');number.textContent=count;
        button.append(icon,number);button.onclick=()=>{if(this.dialog.open)this.dialog.close();select(status);};this.dockCounts.append(button);
      }
      const heading=document.createElement('h2');heading.textContent='Orders at a glance';this.summary.append(heading);
      const grid=document.createElement('div');grid.className='order-count-grid';
      for(const [status,count] of Object.entries(counts)){
        const button=document.createElement('button');button.type='button';button.className='order-count-chip';
        const label=document.createElement('span');label.textContent=status;
        const badge=document.createElement('strong');badge.textContent=count;
        button.append(label,badge);button.onclick=()=>{this.dialog.close();select(status);};grid.append(button);
      }
      this.summary.append(grid);
      if(note){const help=document.createElement('p');help.className='hint';help.textContent=note;this.summary.append(help);}
    }
    destroy(){
      this.stop();
      window.removeEventListener('resize',this.fitWindow);
      clearInterval(this.timer);
      this.observer?.disconnect();
      this.dock.remove();
      this.dialog.remove();
    }
    show(){
      if(!this.dialog.open){
        this.dialog.showModal();
        if(this.geometry)this.fitWindow();
        else {const w=Math.min(760,window.innerWidth-32),h=Math.min(680,window.innerHeight-32);this.place((window.innerWidth-w)/2,(window.innerHeight-h)/2,w,h);}
      }
    }
    stop(){
      this.active=false;
      this.seen.clear();
      this.lastFingerprint=undefined;
      this.lastIds=new Set();
      this.data={
        notifications:[],unreadCount:0
      };
      this.title.textContent='Notifications';
      this.counts.textContent='';
      this.dockCounts.replaceChildren();
      this.summary.replaceChildren();
      this.preview.textContent=this.lockedMessage;
      this.list.replaceChildren();
      this.list.textContent=this.lockedMessage;
      if(this.dialog.open)this.dialog.close();
      this.root.replaceChildren();
    }
    async refresh(){
      if(this.loading)return;
      this.loading=true;
      try{
        const data=await this.load();
        if(!this.active)return;
        this.render(data);
      }finally{
        this.loading=false;
      }
    }
    render(data){
      const fingerprint=JSON.stringify((data.notifications||[]).map(n=>[n.id,n.message,n.read_at]));
      const previous=this.lastFingerprint;
      const changed=previous!==undefined&&previous!==fingerprint;
      const lastIds=this.lastIds||new Set();
      const newIds=new Set((data.notifications||[]).map(n=>String(n.id)));
      const incoming=(data.notifications||[]).some(n=>!lastIds.has(String(n.id)));
      this.lastFingerprint=fingerprint;
      this.lastIds=newIds;
      if(changed){
        this.dock.classList.remove('notification-updated');
        void this.dock.offsetWidth;
        this.dock.classList.add('notification-updated');
        if(this.counts){
          this.counts.classList.remove('notification-bounce');
          void this.counts.offsetWidth;
          this.counts.classList.add('notification-bounce');
        }
        if(incoming&&this.soundsEnabled){
          try{
            const audio=new (window.AudioContext||window.webkitAudioContext)();
            const oscillator=audio.createOscillator(),gain=audio.createGain();
            oscillator.frequency.value=650;gain.gain.value=0.025;
            oscillator.connect(gain);gain.connect(audio.destination);
            oscillator.start();oscillator.stop(audio.currentTime+0.09);
            oscillator.onended=()=>audio.close();
          }catch(_){}
        }
      }
      this.data=data;
      this.title.textContent='Notifications · '+data.unreadCount+' unread';
      this.counts.textContent=data.unreadCount||'';
      this.counts.hidden=!data.unreadCount;
      const unread=data.notifications.filter(n=>!n.read_at);
      this.preview.textContent=(unread.length?unread:data.notifications).slice(0,3).map(n=>n.message).join('\n\n')||'No notifications yet.';
      this.list.replaceChildren();
      const heading=document.createElement('h2');
      heading.textContent=this.title.textContent;
      this.list.append(heading);
      const all=document.createElement('button');
      all.type='button';
      all.textContent='Mark all as read';
      all.disabled=!data.unreadCount;
      all.onclick=()=>this.save(null);
      this.list.append(all);
      if(!data.notifications.length){
        const p=document.createElement('p');
        p.textContent='No notifications yet.';
        this.list.append(p);
      }
      for(const n of data.notifications){
        const row=document.createElement('article');
        row.className=n.read_at?'notification-entry':'notification-entry unread';
        row.style.background=n.read_at?'white':'#e8f2fc';
        const p=document.createElement('p');
        p.textContent=(n.read_at?'':'Unread · ')+n.message;
        const time=document.createElement('small');
        time.textContent=n.created_at;
        row.append(p,time);
        if(this.open){
          const b=document.createElement('button');
          b.type='button';
          b.textContent='Open order';
          b.onclick=()=>{
            this.dialog.close();
            this.open(n);
          };
          row.append(b);
        }
        if(!n.read_at){
          const b=document.createElement('button');
          b.type='button';
          b.textContent='Mark as read';
          b.onclick=()=>this.save(Number(n.id),n);
          row.append(b);
        }this.list.append(row);
      }
    }
    async save(id,n){
      try{
        await this.mark(id,n);
        await this.refresh();
      }catch(e){
        const p=document.createElement('p');
        p.setAttribute('role','alert');
        p.textContent=e.message||'Could not save. Please retry.';
        this.list.append(p);
      }
    }
  };
})();
