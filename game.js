
(()=>{'use strict';
const root=document.getElementById('dead-air');if(!root||root.dataset.ready)return;root.dataset.ready='true';
const canvas=root.querySelector('#da-scene'),ctx=canvas.getContext('2d',{alpha:false}),overlay=root.querySelector('#da-overlay'),title=root.querySelector('#da-title'),description=root.querySelector('#da-description'),overline=root.querySelector('#da-overline'),go=root.querySelector('#da-start'),status=root.querySelector('#da-status'),viewport=root.querySelector('#da-viewport');
const W=960,H=540,HF=H/2,FOV=.73,TAN=Math.tan(FOV),TAU=Math.PI*2;
const map=[
'####################',
'#......#...........#',
'#......#...........#',
'#..................#',
'#..##........##....#',
'#.........#........#',
'#.........#........#',
'#..................#',
'###.....####.......#',
'#..................#',
'#......#...........#',
'#......#...........#',
'#..................#',
'#...##.......##....#',
'#..................#',
'#..........#.......#',
'#..................#',
'#..................#',
'####################'];
const MW=map[0].length,MH=map.length;
const stations=[{x:5.4,y:9.5,type:'smg',label:'MP-40',price:1000},{x:15.3,y:12.5,type:'shotgun',label:'TRENCH GUN',price:1500},{x:11.7,y:6.5,type:'box',label:'MYSTERY BOX',price:950},{x:3.5,y:15.5,type:'perk',label:'FORTIFIED PERK',price:2500}];
const guns={pistol:{name:'M1911',size:12,reserve:96,damage:42,rate:.29,reload:1.35,spread:.017,pellets:1},smg:{name:'MP-40',size:32,reserve:192,damage:32,rate:.11,reload:1.85,spread:.042,pellets:1},shotgun:{name:'TRENCH GUN',size:8,reserve:56,damage:24,rate:.78,reload:2.15,spread:.18,pellets:7},rifle:{name:'COMMANDO',size:35,reserve:210,damage:48,rate:.145,reload:1.75,spread:.019,pellets:1},lmg:{name:'RPK',size:75,reserve:300,damage:37,rate:.095,reload:2.9,spread:.058,pellets:1},ray:{name:'RAY PROTOTYPE',size:20,reserve:120,damage:170,rate:.31,reload:1.8,spread:.014,pellets:1}};
let state='menu',player,zombies=[],particles=[],drops=[],points=500,kills=0,round=0,waveTotal=0,waveSpawned=0,waveDelay=0,roundGap=0,roundNotice=0,gun='pistol',ammo=12,reserve=96,shotCooldown=0,reloadTime=0,shotKick=0,flash=0,hurt=0,shake=0,interactNotice='',interactTime=0,aimBobbing=0,held={},last=0,mouseHeld=false,isDragging=false,prevMouse=0,audioEnabled=true,audioCtx=null,flow=[],flowTick=0,elapsed=0,mutedByBrowser=false;
// Host-controlled wave types and timed power-ups (synced to co-op clients).
const isDogRound=n=>n>=5&&n%5===0&&n!==10;
const DROP_TYPES=['maxammo','doublepoints','instakill','nuke'];
const DROP_META={
 maxammo:{label:'MAX AMMO',glyph:'AMMO',color:'#58d8fd'},
 doublepoints:{label:'DOUBLE POINTS',glyph:'2X',color:'#ffe18b'},
 instakill:{label:'INSTA-KILL',glyph:'SKULL',color:'#f16d6b'},
 nuke:{label:'NUKE',glyph:'NUKE',color:'#c2ff86'}
};
let powerUps={doublePoints:0,instaKill:0},lightningFlash=0,dropSequence=0;
const VIP_QUOTES=["I Tell yA","I'm don't like sunday dinners"];
function vipVoice(line){
  if(!audioEnabled||typeof speechSynthesis==='undefined'||typeof SpeechSynthesisUtterance==='undefined')return;
  try{const voice=new SpeechSynthesisUtterance(line);voice.pitch=.65;voice.rate=.82;voice.volume=.9;speechSynthesis.speak(voice)}catch(e){}
}
const clamp=(a,b,c)=>Math.min(c,Math.max(b,a));const rand=(a,b)=>a+Math.random()*(b-a);const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function solid(x,y){let tx=Math.floor(x),ty=Math.floor(y);return ty<0||ty>=MH||tx<0||tx>=MW||map[ty][tx]!=='\u002e'}
function canStand(x,y,r){return !solid(x-r,y-r)&&!solid(x+r,y-r)&&!solid(x-r,y+r)&&!solid(x+r,y+r)}
function moveObj(e,dx,dy,r){if(canStand(e.x+dx,e.y,r))e.x+=dx;if(canStand(e.x,e.y+dy,r))e.y+=dy}
function sound(freq,dur,shape='sawtooth',volume=.1,shift=0){if(!audioEnabled)return;try{audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();let o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=shape;o.frequency.setValueAtTime(freq,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(20,freq+shift),audioCtx.currentTime+dur);g.gain.setValueAtTime(volume,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+dur);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur+.02)}catch(e){}}
function clickSound(){sound(140,.13,'sawtooth',.13,-110);sound(48,.18,'triangle',.19,0)}
function notice(text,time=2.3){interactNotice=text;interactTime=time}

let role='none',peer=null,hostConn=null,roomCode='',myName='SURVIVOR',guestConns=new Map(),remotePlayers=new Map(),otherPlayers=new Map();
let running=false,localPaused=true,lastSnapshot=0,lastPositionSend=0,readyForPointer=false,roomError='',roundEnd=false,prevRound=0;
let copyTimeout=null,joinTimeout=null,hostSequence=0;
const spawnSpots=[[9.5,10.5],[10.5,10.5],[9.5,11.5],[10.5,11.5]];
const $=(id)=>document.getElementById(id);
const lobby=$('da-lobby'),topLobby=$('da-room-bar'),roomText=$('da-room-text'),lobbyMessage=$('da-lobby-message'),roster=$('da-roster');
const hostButton=$('da-host-room'),joinButton=$('da-join-room'),copyButton=$('da-copy-room'),roomInput=$('da-room-input'),nameInput=$('da-name-input');
const cleanName=t=>String(t||'SURVIVOR').replace(/[<>\\]/g,'').trim().slice(0,16)||'SURVIVOR';
const goodCode=t=>String(t||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
const normAng=v=>(v%TAU+TAU)%TAU;
const isHost=()=>role==='host';
const gameActive=()=>running&&(state==='play'||state==='pause'||state==='ready');
const allActors=()=>[player,...remotePlayers.values()].filter(Boolean);
const myRow=()=>({id:'host',name:myName,x:player.x,y:player.y,ang:player.ang,health:player.health,maxHealth:player.maxHealth,perk:player.perk,downed:!!player.downed,points,kills,gun,slot:0});
function say(s){lobbyMessage.textContent=s;roomError=s}
function updateRoster(){let members=[];
 if(role==='host')members=[myRow(),...remotePlayers.values()];
 if(role==='guest')members=[...(otherPlayers.values()),...(player?[{id:peer?.id,name:myName,slot:mySlot}]:[])];
 members=members.sort((a,b)=>(a.slot??5)-(b.slot??5));
 roster.textContent='';for(let m of members){let el=document.createElement('div');el.className='member';el.textContent=(m.slot+1)+'. '+cleanName(m.name)+(m.downed?' · DOWN':' · READY');roster.appendChild(el)}
 if(members.length){let count=$('da-player-count');count.textContent=members.length+'/4 SURVIVORS'}
}
let mySlot=0;
function statusRoom(){topLobby.hidden=role==='none';roomText.textContent=roomCode?('ROOM '+roomCode):'NO ROOM';copyButton.disabled=!roomCode;updateRoster()}
function showLobby(s){overlay.classList.remove('off');state=s||'menu';localPaused=true;overline.textContent='4-PLAYER ONLINE CO-OP';title.textContent='DEAD AIR';description.textContent='Host a room, share your link and survive together. The host must remain connected.';lobby.hidden=role==='host'||(role==='guest'&&!!hostConn?.open);go.style.display=role==='host'?'inline-block':'none';go.textContent='START SURVIVAL';if(role==='guest'){overline.textContent='CONNECTED // WAITING FOR HOST';title.textContent='LOBBY';description.textContent='You are in the room. The host will launch the match.'}if(role==='host')description.textContent='Invite up to 3 friends. You can start now and they can join mid-round.';statusRoom()}
function showReady(){state='ready';localPaused=true;running=true;overlay.classList.remove('off');lobby.hidden=true;overline.textContent='TEAM DEPLOYMENT';title.textContent='SURVIVE';description.textContent='You joined the active game. Click below to take control. Move close to downed teammates and press E to revive.';go.style.display='inline-block';go.textContent='ENTER BUNKER';statusRoom()}
function pauseLocal(){if(!running||localPaused)return;localPaused=true;overlay.classList.remove('off');overline.textContent='LIVE MULTIPLAYER';title.textContent='CONTINUE';description.textContent='Your room is still running while you are away. Zombies will keep attacking.';go.textContent='RETURN TO FIGHT';go.style.display='inline-block';lobby.hidden=true;mouseHeld=false;held={};if(document.pointerLockElement===canvas)document.exitPointerLock?.()}
function play(){if(!running){if(role==='host')startMatch();return}state='play';localPaused=false;overlay.classList.add('off');canvas.focus();try{const request=canvas.requestPointerLock?.();request?.catch?.(()=>{})}catch(e){}last=performance.now()}
function menu(kind){if(kind==='dead'){running=false;localPaused=true;state='dead';overlay.classList.remove('off');lobby.hidden=true;overline.textContent='YOUR TEAM HAS FALLEN';title.textContent='GAME OVER';description.textContent='The bunker fell on round '+round+'. Host can start a new run.';go.style.display=role==='host'?'inline-block':'none';go.textContent='PLAY AGAIN';if(document.pointerLockElement===canvas)document.exitPointerLock?.();return}if(kind==='pause')pauseLocal();else showLobby(kind)}
function soundError(err){say('Connection error: '+(err?.type||err?.message||err));}
function closeNetwork(){if(peer){try{peer.destroy()}catch(e){}}peer=null;guestConns.clear();remotePlayers.clear();otherPlayers.clear();hostConn=null;role='none';running=false;roomCode='';statusRoom()}
function newActor(slot,name,id){let [x,y]=spawnSpots[slot]||spawnSpots[0];return{id,name,x,y,ang:.16,health:100,maxHealth:100,perk:false,stamina:100,regen:0,downed:false,points:500,kills:0,gun:'pistol',slot,lastFire:-99}}
function reset(){let id=role==='host'?'host':peer?.id||'guest';let v=newActor(mySlot,myName,id);player={...v};zombies=[];particles=[];drops=[];otherPlayers.clear();powerUps={doublePoints:0,instaKill:0};lightningFlash=0;dropSequence=0;points=500;kills=0;round=0;gun='pistol';ammo=12;reserve=96;shotCooldown=0;reloadTime=0;shotKick=0;flash=0;hurt=0;shake=0;elapsed=0;waveDelay=0;roundGap=0;interactTime=0;roundNotice=0;flowTick=0}
function resetActor(v){let [x,y]=spawnSpots[v.slot]||spawnSpots[0];Object.assign(v,{x,y,ang:.16,health:100,maxHealth:100,perk:false,downed:false,regen:0,points:500,kills:0,gun:'pistol',stamina:100,lastFire:-99})}
function newWave(){
 round++;
 const dogWave=isDogRound(round);
 waveTotal=dogWave?Math.min(24,9+round+Math.max(0,allActors().length-1)*2):4+round*3+Math.max(0,allActors().length-1)*3;
 waveSpawned=0;waveDelay=dogWave?.85:1.3;roundGap=0;roundNotice=3.3;
 for(const a of allActors())if(!a.downed)a.health=Math.min(a.maxHealth,a.health+30);
 sound(dogWave?70:95,.7,'triangle',.12,140);
 notice(dogWave?'HELLHOUND ROUND — WATCH THE LIGHTNING!':'ROUND '+round+' — FIGHT TOGETHER',3.2);
 if(dogWave){lightningFlash=.75;broadcast({t:'notice',message:'ROUND '+round+' — HELLHOUNDS INCOMING!'});}
 if(round===10)spawnVip();
}
function getCells(){let cells=[];const living=allActors().filter(a=>!a.downed);for(let y=1;y<MH-1;y++)for(let x=1;x<MW-1;x++)if(!solid(x+.5,y+.5)&&living.every(a=>Math.hypot(x+.5-a.x,y+.5-a.y)>4.5))cells.push([x+.5,y+.5]);return cells}
function spawnVip(){
  const cells=getCells();const preferred=[12.5,10.5];
  const spot=canStand(...preferred,.3)&&allActors().every(a=>Math.hypot(preferred[0]-a.x,preferred[1]-a.y)>2.3)?preferred:(cells[Math.floor(Math.random()*cells.length)]||[14.5,14.5]);
  const health=1600+Math.max(0,allActors().length-1)*650;
  zombies.push({id:++hostSequence,vip:true,x:spot[0],y:spot[1],health,maxHealth:health,
    speed:.63,attack:.85,anim:0,groan:99,laserCooldown:3.6,laserCharge:0,laserFx:0,
    laserTargetX:spot[0],laserTargetY:spot[1],quote:VIP_QUOTES[0],quoteLeft:4,quoteCooldown:7,quoteSerial:1});
  notice('WARNING — THE VIP HAS ARRIVED!',4);
  broadcast({t:'notice',message:'ROUND 10: THE VIP HAS ARRIVED!'});
  sound(120,1.1,'sawtooth',.13,-85);vipVoice(VIP_QUOTES[0]);
}
function spawn(){const cells=getCells();if(!cells.length)return;let [x,y]=cells[Math.floor(Math.random()*cells.length)];/* The first enemy of each wave enters the central hallway in plain sight. */if(waveSpawned===0&&canStand(12.5,10.5,.23)&&allActors().every(a=>Math.hypot(12.5-a.x,10.5-a.y)>1.25)){x=12.5;y=10.5}const dog=isDogRound(round),health=dog?(62+round*12):(77+round*23);
 if(dog){lightningFlash=Math.max(lightningFlash,.55);sound(95,.20,'sawtooth',.045,-45)}
 zombies.push({id:++hostSequence,dog,x:x+rand(-.09,.09),y:y+rand(-.09,.09),health,maxHealth:health,
 speed:dog?Math.min(2.15,1.38+round*.023):rand(.55,.73)+Math.min(round*.095,.55),
 attack:rand(.1,.7),anim:rand(0,TAU),variant:Math.floor(rand(0,3)),
 groan:rand(1,6),arrivalFx:dog?.72:0});
}
function computeFlow(){flow=Array.from({length:MH},()=>Array(MW).fill(9999));let q=[],at=0;for(let p of allActors().filter(v=>!v.downed)){let sx=Math.floor(p.x),sy=Math.floor(p.y);if(!solid(sx+.5,sy+.5)&&flow[sy][sx]>0){q.push([sx,sy]);flow[sy][sx]=0}}while(at<q.length){const [x,y]=q[at++];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){let nx=x+dx,ny=y+dy;if(nx>0&&ny>0&&nx<MW-1&&ny<MH-1&&!solid(nx+.5,ny+.5)&&flow[ny][nx]===9999){flow[ny][nx]=flow[y][x]+1;q.push([nx,ny])}}}}
function setGameOver(){if(!running)return;running=false;broadcast({t:'gameover',round});menu('dead')}
function updateVip(z,target,dt){
  z.quoteLeft=Math.max(0,z.quoteLeft-dt);z.quoteCooldown-=dt;
  z.laserFx=Math.max(0,z.laserFx-dt);
  if(z.quoteCooldown<=0){
    z.quote=VIP_QUOTES[Math.floor(Math.random()*VIP_QUOTES.length)];z.quoteLeft=3.6;
    z.quoteSerial++;z.quoteCooldown=8+Math.random()*5;vipVoice(z.quote);
  }
  const d=dist(z,target);
  if(z.laserCharge>0){
    z.laserTargetX=target.x;z.laserTargetY=target.y;
    z.laserCharge-=dt;
    if(z.laserCharge<=0){
      z.laserCharge=0;z.laserFx=.65;z.laserTargetId=target.id;
      sound(630,.4,'sawtooth',.23,-450);
      if(d<10&&unobstructed(z,target)&&!target.downed){
        target.health=Math.max(0,target.health-(target.perk?23:34));target.regen=4;
        if(target===player){hurt=.95;shake=.75}
        if(target.health<=0){target.downed=true;target.health=0;notice(target.name+' IS DOWN — PRESS E TO REVIVE!',3)}
      }
    }
    return true;
  }
  z.laserCooldown-=dt;
  if(z.laserCooldown<=0&&d<9.5&&unobstructed(z,target)){
    z.laserCharge=1.25;z.laserCooldown=5.3;
    z.laserTargetX=target.x;z.laserTargetY=target.y;
    sound(280,.5,'triangle',.11,320);
    return true;
  }
  return false;
}
function spawnDrop(x,y,kind=null,guaranteed=false){
 if(!isHost()||(!guaranteed&&(drops.length>=5||Math.random()>.115)))return;
 const type=kind||DROP_TYPES[Math.floor(Math.random()*DROP_TYPES.length)];
 drops.push({id:++dropSequence,x,y,kind:type,ttl:guaranteed?24:19});
}
function awardZombiePoints(id,base){addPoints(id,base*(powerUps.doublePoints>0?2:1))}
function collectDrop(drop,actor){
 if(!DROP_META[drop.kind]||!isHost())return;
 const type=drop.kind;
 if(type==='maxammo'){
   ammo=guns[gun].size;reserve=guns[gun].reserve;reloadTime=0;
   for(const p of remotePlayers.values()){
     sendToId(p.id,{t:'maxammo',gun:p.gun});
   }
 }else if(type==='doublepoints')powerUps.doublePoints=30;
 else if(type==='instakill')powerUps.instaKill=22;
 else if(type==='nuke'){
   zombies.length=0;
   for(const a of allActors())addPoints(a.id,400);
 }
 const message=DROP_META[type].label+' ACTIVATED BY '+actor.name.toUpperCase();
 notice(message,3);broadcast({t:'notice',message});
 sound(type==='nuke'?90:420,.45,type==='nuke'?'sawtooth':'triangle',.16,type==='nuke'?-70:280);
}
function tickDrops(dt){
 for(let i=drops.length-1;i>=0;i--){
  const d=drops[i];d.ttl-=dt;
  if(d.ttl<=0){drops.splice(i,1);continue}
  const actor=allActors().find(a=>!a.downed&&dist(a,d)<.82);
  if(actor){drops.splice(i,1);collectDrop(d,actor);}
 }
}
function hostZombies(dt){let living=allActors().filter(a=>!a.downed);if(!living.length){setGameOver();return}
flowTick-=dt;if(flowTick<=0){computeFlow();flowTick=.33}
for(let i=zombies.length-1;i>=0;i--){let z=zombies[i],target=living.reduce((a,b)=>dist(z,a)<dist(z,b)?a:b);let d=dist(z,target);z.anim+=dt*(3+z.speed);z.arrivalFx=Math.max(0,(z.arrivalFx||0)-dt);z.groan-=dt;
 if(z.groan<0&&d<6){sound(z.dog?rand(160,205):rand(66,92),rand(.3,.6),'sawtooth',.013,-38);z.groan=rand(z.dog?3:5,z.dog?6:11)}
if(z.vip&&updateVip(z,target,dt))continue;
if(d<(z.dog?.86:.76)){z.attack-=dt;if(z.attack<=0){target.health=Math.max(0,target.health-(target.perk?(z.vip?20:z.dog?10:13):(z.vip?28:z.dog?16:17)));target.regen=4;if(target===player){hurt=.95;shake=.5}sound(110,.18,'square',.11,-90);z.attack=z.dog?.82:1.12;if(target.health<=0){target.downed=true;target.health=0;notice(target.name+' IS DOWN — PRESS E TO REVIVE!',3)}}continue}
let gx=target.x,gy=target.y;if(d>1.7){let cx=Math.floor(z.x),cy=Math.floor(z.y),best=flow[cy]?.[cx]??9999;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){let nx=cx+dx,ny=cy+dy,v=flow[ny]?.[nx]??9999;if(v<best){best=v;gx=nx+.5;gy=ny+.5}}}let vx=gx-z.x,vy=gy-z.y,len=Math.hypot(vx,vy)||1,s=z.speed*dt;if(canStand(z.x+vx/len*s,z.y+vy/len*s,.20))moveObj(z,vx/len*s,vy/len*s,.20);else{let vx2=target.x-z.x,vy2=target.y-z.y,l2=Math.hypot(vx2,vy2)||1;moveObj(z,vx2/l2*s,vy2/l2*s,.19)}}
for(let a of living){a.regen=Math.max(0,a.regen-dt);if(!a.regen)a.health=Math.min(a.maxHealth,a.health+8*dt)}
tickDrops(dt);
 if(waveSpawned<waveTotal){waveDelay-=dt;if(waveDelay<=0&&zombies.length<Math.min(11+round*2+allActors().length*2,36)){spawn();waveSpawned++;waveDelay=isDogRound(round)?.77:clamp(1.55-round*.07,.5,1.55)}}else if(zombies.length===0){if(!roundGap){roundGap=4.2;notice('ROUND CLEARED — PREPARE YOURSELF',3.5);sound(280,.4,'sine',.08,90)}roundGap-=dt;if(roundGap<=0)newWave()}}
function update(dt){if(!running)return;elapsed+=dt;
if(!localPaused&&state==='play'){let p=player,mx=0,my=0,forward=(held.KeyW?1:0)-(held.KeyS?1:0),strafe=(held.KeyD?1:0)-(held.KeyA?1:0);if(!p.downed&&(forward||strafe)){let l=Math.hypot(forward,strafe);forward/=l;strafe/=l;mx=Math.cos(p.ang)*forward-Math.sin(p.ang)*strafe;my=Math.sin(p.ang)*forward+Math.cos(p.ang)*strafe;let fast=held.ShiftLeft&&p.stamina>0&&forward>0,speed=fast?4.1:2.55;moveObj(p,mx*speed*dt,my*speed*dt,.23);if(fast)p.stamina=Math.max(0,p.stamina-32*dt);else p.stamina=Math.min(100,p.stamina+19*dt);aimBobbing+=dt*(fast?13:8)}else p.stamina=Math.min(100,p.stamina+24*dt);if(held.ArrowLeft)p.ang-=1.9*dt;if(held.ArrowRight)p.ang+=1.9*dt;p.ang=normAng(p.ang)}
shotCooldown=Math.max(0,shotCooldown-dt);flash=Math.max(0,flash-dt);shotKick=Math.max(0,shotKick-dt*5);hurt=Math.max(0,hurt-dt*1.6);shake=Math.max(0,shake-dt*3);interactTime=Math.max(0,interactTime-dt);roundNotice=Math.max(0,roundNotice-dt);
if(reloadTime>0){reloadTime-=dt;if(reloadTime<=0){const take=Math.min(guns[gun].size-ammo,reserve);ammo+=take;reserve-=take;sound(530,.07,'square',.025,-210)}}
if(!localPaused&&mouseHeld&&!player.downed&&shotCooldown<=0&&reloadTime<=0)fire();
for(let i=particles.length-1;i>=0;i--){let e=particles[i];e.life-=dt;e.x+=e.vx*dt;e.y+=e.vy*dt;e.vy+=e.gravity*dt;if(e.life<=0)particles.splice(i,1)}
if(isHost()){
  powerUps.doublePoints=Math.max(0,powerUps.doublePoints-dt);
  powerUps.instaKill=Math.max(0,powerUps.instaKill-dt);
  lightningFlash=Math.max(0,lightningFlash-dt*1.8);
  hostZombies(dt);
 }else{lightningFlash=Math.max(0,lightningFlash-dt*1.8)}
 if(!isHost())for(let z of zombies){if(z.tx!==undefined){z.x+=(z.tx-z.x)*Math.min(1,dt*15);z.y+=(z.ty-z.y)*Math.min(1,dt*15);z.anim+=dt*4;if(z.dog)z.arrivalFx=Math.max(0,(z.arrivalFx||0)-dt);if(z.vip){z.quoteLeft=Math.max(0,(z.quoteLeft||0)-dt);z.laserCharge=Math.max(0,(z.laserCharge||0)-dt);z.laserFx=Math.max(0,(z.laserFx||0)-dt)}}}
if(role==='guest'&&state==='play'&&hostConn?.open){lastPositionSend+=dt;if(lastPositionSend>=.065){lastPositionSend=0;sendHost({t:'pose',x:player.x,y:player.y,ang:player.ang})}}
if(role==='host'){lastSnapshot+=dt;if(lastSnapshot>=.10){lastSnapshot=0;broadcastState()}}
}

function cast(rayX,rayY){let mapX=Math.floor(player.x),mapY=Math.floor(player.y),deltaX=Math.abs(1/(rayX||.00001)),deltaY=Math.abs(1/(rayY||.00001)),stepX=rayX<0?-1:1,stepY=rayY<0?-1:1;
let sideX=(rayX<0?player.x-mapX:mapX+1-player.x)*deltaX,sideY=(rayY<0?player.y-mapY:mapY+1-player.y)*deltaY,side=0;
for(let count=0;count<28;count++){if(sideX<sideY){sideX+=deltaX;mapX+=stepX;side=0}else{sideY+=deltaY;mapY+=stepY;side=1}if(mapY<0||mapY>=MH||mapX<0||mapX>=MW||map[mapY][mapX]!=='\u002e')break}
let d=Math.max(.04,side===0?sideX-deltaX:sideY-deltaY),hit=(side===0?player.y+d*rayY:player.x+d*rayX);return{d,u:hit-Math.floor(hit),side,mapX,mapY}}
const SW=3,zBuffer=new Float32Array(W/SW);let proj=[];
function screenOf(x,y){let dx=x-player.x,dy=y-player.y,ca=Math.cos(player.ang),sa=Math.sin(player.ang),depth=dx*ca+dy*sa,side=-dx*sa+dy*ca;return{depth,x:W/2+side/(depth*TAN)*W/2}}
function wallRender(){const horizon=HF+Math.sin(aimBobbing)*2.3;let sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,'#060d10');sky.addColorStop(1,'#1c2728');ctx.fillStyle=sky;ctx.fillRect(0,0,W,horizon);let floor=ctx.createLinearGradient(0,horizon,0,H);floor.addColorStop(0,'#32342e');floor.addColorStop(.3,'#1b201e');floor.addColorStop(1,'#090e0c');ctx.fillStyle=floor;ctx.fillRect(0,horizon,W,H-horizon);
ctx.strokeStyle='#b0a8910b';for(let i=1;i<=25;i++){let y=horizon+(H-horizon)*(1-1/(i*.26+1));ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
let ca=Math.cos(player.ang),sa=Math.sin(player.ang);
for(let i=0;i<W/SW;i++){let sx=i*SW,cx=2*sx/W-1,rx=ca-sa*cx*TAN,ry=sa+ca*cx*TAN,r=cast(rx,ry);zBuffer[i]=r.d;let height=Math.min(H*4,H/r.d),top=horizon-height/2,bottom=horizon+height/2,lighting=clamp(1-r.d/16,.16,.85)*(r.side?.72:1),grain=(Math.sin(r.u*88+r.mapX*16+r.mapY*23)*.12+.88);let base=[102,114,102],mortar=(r.u<.016||r.u>.984);let c=base.map(v=>Math.round(v*lighting*grain*(mortar?.55:1)));ctx.fillStyle='rgb('+c.join(',')+')';ctx.fillRect(sx,Math.max(0,top),SW+1,Math.min(H,bottom)-Math.max(0,top));
if(height>34){ctx.fillStyle='rgba(9,14,11,.27)';let lines=Math.min(8,Math.max(2,Math.floor(height/70)));for(let k=1;k<lines;k++){let yy=top+height*k/lines;if(yy>0&&yy<H)ctx.fillRect(sx,yy,SW+1,Math.max(1,height*.006))}let stain=Math.abs(Math.sin(r.mapX*27+r.mapY*17+Math.floor(r.u*7)*3.77));if(stain>.88){ctx.fillStyle='rgba(7,10,8,.25)';ctx.fillRect(sx,Math.max(0,top+height*.16),SW+1,Math.min(height*.43,H))}}
// Small red safety light spill on selected wall sectors
if(r.mapX%8===0&&r.mapY%4===0&&r.u>.44&&r.u<.57){ctx.fillStyle='rgba(224,57,30,.2)';ctx.fillRect(sx,Math.max(0,top+height*.14),SW,Math.min(height*.11,H))}
}
let vignette=ctx.createRadialGradient(W/2,H/2,H*.15,W/2,H/2,W*.72);vignette.addColorStop(0,'#0000');vignette.addColorStop(1,'#0009');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
}
// Load the custom zombie image from the repository, not an embedded copy.
// All zombies use this image; a missing asset is reported instead of drawing the old default zombie.
const ZOMBIE_ASSET='zombie_wide.png?v=42138bdedbc0';
const customZombieTex=new Image();
const zombiePreview=document.getElementById('da-zombie-preview-img');
if(zombiePreview)zombiePreview.src=ZOMBIE_ASSET;
customZombieTex.onerror=()=>{
  console.error('DEAD AIR: Could not load custom zombie image:',ZOMBIE_ASSET);
  if(zombiePreview)zombiePreview.alt='Custom zombie image failed to load';
  if(status)status.textContent='ZOMBIE IMAGE FAILED TO LOAD — check zombie_wide.png';
};
customZombieTex.src=ZOMBIE_ASSET;
const ZOMBIE_WIDTH=1.1085,ZOMBIE_HEIGHT=1.13;
const dogTex=new Image();dogTex.src='hellhound.webp?v=20261025-dogs-v1';
dogTex.onerror=()=>console.error('Hellhound sprite could not be loaded: hellhound.webp');
const DOG_WIDTH=1.16,DOG_HEIGHT=1.12;
const vipTex=new Image();vipTex.src='vip_boss.webp?v=20261025';
vipTex.onerror=()=>console.error('VIP boss sprite could not be loaded: vip_boss.webp');
const VIP_WIDTH=1.5,VIP_HEIGHT=1.79;
function currentZombieTexture(){return customZombieTex.naturalWidth>0?customZombieTex:null}

const mateColors=['#dbbd7b','#70cde6','#93e8a0','#d9a7e4'];
function createMateTex(color){let c=document.createElement('canvas');c.width=128;c.height=240;let g=c.getContext('2d');
g.shadowColor=color;g.shadowBlur=7;g.fillStyle='#20262b';g.fillRect(39,150,20,64);g.fillRect(70,150,20,64);g.fillStyle='#101418';g.fillRect(34,205,26,15);g.fillRect(68,205,27,15);g.shadowBlur=0;
g.fillStyle='#202b31';g.fillRect(32,63,65,92);g.fillStyle=color;g.fillRect(32,68,65,6);g.fillRect(55,75,9,54);g.fillStyle='#384854';g.fillRect(16,70,19,68);g.fillRect(94,70,19,68);g.fillStyle='#968b7c';g.fillRect(14,133,20,13);g.fillRect(95,133,19,13);g.fillStyle='#c7a992';g.fillRect(51,20,30,45);g.fillStyle='#29251f';g.fillRect(49,17,35,15);g.fillStyle='#101418';g.fillRect(50,42,32,8);g.fillStyle='#d6eee6';g.fillRect(58,43,5,3);g.fillRect(72,43,5,3);return c}
const mateTex=mateColors.map(createMateTex);

function stationTexture(type){let c=document.createElement('canvas');c.width=130;c.height=168;let g=c.getContext('2d'),clr=type==='box'?'#a29efa':type==='perk'?'#ff6c54':'#e5b96a';g.shadowColor=clr;g.shadowBlur=17;g.fillStyle='#242b29';g.fillRect(19,27,92,132);g.shadowBlur=0;g.fillStyle='#131d1c';g.fillRect(26,34,78,113);g.strokeStyle=clr;g.lineWidth=4;g.strokeRect(26,34,78,113);g.fillStyle=clr;g.font='bold 12px monospace';g.textAlign='center';g.fillText(type==='box'?'?  ?  ?':type==='perk'?'FORTIFIED':'WALL BUY',65,56);g.strokeStyle=clr;g.lineWidth=5;if(type==='perk'){g.beginPath();g.arc(65,94,19,0,TAU);g.stroke();g.font='bold 22px sans-serif';g.fillText('+',65,101)}else if(type==='box'){g.font='bold 56px monospace';g.fillText('?',65,119)}else{g.beginPath();g.moveTo(37,99);g.lineTo(91,99);g.lineTo(100,90);g.moveTo(56,99);g.lineTo(60,113);g.lineTo(85,113);g.stroke()}g.fillStyle='#757e69';g.fillRect(18,158,94,7);return c}
const stationTex={smg:stationTexture('smg'),shotgun:stationTexture('shotgun'),box:stationTexture('box'),perk:stationTexture('perk')};
function drawSprite(texture,pos,heightInWorld,widthInWorld,animation=0){if(!texture)return null;let p=screenOf(pos.x,pos.y),d=p.depth;if(d<=.1||d>18)return null;let height=H*heightInWorld/d,width=H*widthInWorld/d;let x=p.x-width/2,base=HF+H/(2*d)+Math.sin(aimBobbing)*2.3,y=base-height+animation;let i0=Math.max(0,Math.floor(x/SW)),i1=Math.min(W/SW-1,Math.ceil((x+width)/SW));for(let i=i0;i<=i1;i++){if(zBuffer[i]<d-.16)continue;let px=i*SW;if(px<x-SW||px>x+width)continue;let start=clamp((px-x)/width,0,1)*texture.width,end=clamp((px+SW-x)/width,0,1)*texture.width;ctx.drawImage(texture,start,0,Math.max(.1,end-start),texture.height,px,y,SW+1,height)}return{x:p.x,y,base,width,height,depth:d}}

function drawVipLaser(z){
  const r=z.rect;if(!r||(!z.laserCharge&&!z.laserFx))return;
  const firing=z.laserFx>0,flash=0.62+Math.sin(elapsed*27)*.25;
  const eyeY=r.y+r.height*.175;
  ctx.save();ctx.globalAlpha=firing?.96:.55;ctx.shadowColor='#ff2b16';ctx.shadowBlur=firing?26:16;
  if(firing){
    const closeToMe=Math.hypot(z.laserTargetX-player.x,z.laserTargetY-player.y)<.65;
    const aim=closeToMe?{x:W/2,y:HF+10}:screenOf(z.laserTargetX,z.laserTargetY);
    if(closeToMe||aim.depth>.1){
      for(const sx of [r.x-r.width*.105,r.x+r.width*.105]){
        ctx.beginPath();ctx.strokeStyle='#ff3219';ctx.lineWidth=7*flash;ctx.moveTo(sx,eyeY);ctx.lineTo(aim.x,aim.y);ctx.stroke();
        ctx.beginPath();ctx.strokeStyle='#fff0b3';ctx.lineWidth=2;ctx.moveTo(sx,eyeY);ctx.lineTo(aim.x,aim.y);ctx.stroke();
      }
    }
  }
  ctx.fillStyle=firing?'#fff8d1':'#ff3616';
  for(const ex of [r.x-r.width*.105,r.x+r.width*.105]){
    ctx.beginPath();ctx.arc(ex,eyeY,Math.max(3,Math.min(16,r.width*.044)),0,TAU);ctx.fill();
  }
  ctx.restore();
}
function drawWorld(){proj=[];for(let z of zombies){let p=screenOf(z.x,z.y);if(p.depth>.1)proj.push({depth:p.depth,type:'z',obj:z})}
let pals=isHost()?Array.from(remotePlayers.values()):Array.from(otherPlayers.values());for(let p0 of pals){if(p0.id===peer?.id||p0.id==='host'&&isHost())continue;let p=screenOf(p0.x,p0.y);if(p.depth>.1)proj.push({depth:p.depth,type:'p',obj:p0})}
for(let s of stations){let p=screenOf(s.x,s.y);if(p.depth>.1)proj.push({depth:p.depth,type:'s',obj:s})}
proj.sort((a,b)=>b.depth-a.depth);for(let e of proj){if(e.type==='z'){e.obj.rect=drawSprite(e.obj.vip?(vipTex.naturalWidth?vipTex:null):e.obj.dog?(dogTex.naturalWidth?dogTex:null):currentZombieTexture(e.obj),e.obj,e.obj.vip?VIP_HEIGHT:e.obj.dog?DOG_HEIGHT:ZOMBIE_HEIGHT,e.obj.vip?VIP_WIDTH:e.obj.dog?DOG_WIDTH:ZOMBIE_WIDTH,Math.sin(e.obj.anim)*2)}else if(e.type==='p'){let p=e.obj;let hit=drawSprite(mateTex[p.slot%4],p,p.downed?.38:1.08,.59,p.downed?6:Math.sin(elapsed*3)*1.5);if(hit){let sy=Math.max(24,hit.y-15);ctx.save();ctx.textAlign='center';ctx.font='bold '+clamp(160/hit.depth,11,20)+'px monospace';ctx.fillStyle=p.downed?'#ff6969':'#a5f4e4';ctx.shadowColor='#000';ctx.shadowBlur=5;ctx.fillText(p.downed?'REVIVE '+p.name:p.name,hit.x,sy);ctx.restore()}}else e.obj.rect=drawSprite(stationTex[e.obj.type],e.obj,.86,.66,0)}
for(const z of zombies)if(z.vip)drawVipLaser(z);
}

function drawDrops(){
 for(const drop of drops){
   const p=screenOf(drop.x,drop.y),depth=p.depth;
   if(depth<=.1||depth>17||!DROP_META[drop.kind])continue;
   const ix=Math.floor(p.x/SW);if(ix<0||ix>=zBuffer.length||zBuffer[ix]<depth-.2)continue;
   const meta=DROP_META[drop.kind],size=clamp(85/depth,19,70),y=HF+H/(2*depth)-size*1.3+Math.sin(elapsed*3+drop.id)*9;
   ctx.save();ctx.shadowColor=meta.color;ctx.shadowBlur=22;
   ctx.fillStyle='#071010d9';ctx.strokeStyle=meta.color;ctx.lineWidth=3;
   ctx.beginPath();ctx.arc(p.x,y,size*.54,0,TAU);ctx.fill();ctx.stroke();
   ctx.font='bold '+Math.round(size*.28)+'px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=meta.color;
   ctx.fillText(meta.glyph,p.x,y);
   ctx.font='bold '+Math.round(clamp(size*.20,10,15))+'px monospace';ctx.fillText(meta.label,p.x,y+size*.75);
   ctx.restore();
 }
}
function dogWeather(){
 if(!isDogRound(round)||!running)return;
 ctx.save();
 ctx.fillStyle='rgba(1,6,15,.55)';ctx.fillRect(0,0,W,H);
 // Layers of moving blue-grey mist and a pale horizon.
 for(let i=0;i<4;i++){
   const cx=W*(.13+i*.26)+Math.sin(elapsed*.29+i*2)*115;
   const cy=HF+48+i*35+Math.sin(elapsed*.48+i)*16;
   const cloud=ctx.createRadialGradient(cx,cy,8,cx,cy,275);
   cloud.addColorStop(0,'rgba(155,194,207,.19)');cloud.addColorStop(1,'rgba(50,75,95,0)');
   ctx.fillStyle=cloud;ctx.fillRect(0,0,W,H);
 }
 for(const dog of zombies){
  if(!dog.dog||!dog.arrivalFx||!dog.rect)continue;
  const r=dog.rect;
  if(r.depth<=.1||r.depth>16)continue;
  ctx.save();ctx.globalAlpha=clamp(dog.arrivalFx*2,0,1);
  ctx.strokeStyle='#e1f7ff';ctx.lineWidth=clamp(10/r.depth,2,8);ctx.shadowColor='#bdeeff';ctx.shadowBlur=22;
  ctx.beginPath();ctx.moveTo(r.x-22,0);ctx.lineTo(r.x+8,r.y*.22);ctx.lineTo(r.x-15,r.y*.58);ctx.lineTo(r.x+5,Math.max(0,r.y+r.height*.42));ctx.stroke();
  ctx.restore();
 }
 if(lightningFlash>0){ctx.fillStyle='rgba(195,225,255,'+(clamp(lightningFlash*.65,0,.55))+')';ctx.fillRect(0,0,W,H)}
 ctx.restore();
}
function gunDraw(){let bob=Math.sin(aimBobbing)*3,side=Math.cos(aimBobbing/2)*2;ctx.save();ctx.translate(W/2+side+shotKick*26,H+19+shotKick*38+bob);let compact=gun==='pistol'||gun==='ray';ctx.scale(compact?.8:1,compact?.8:1);
// hands and sleeves
ctx.fillStyle='#27312c';ctx.beginPath();ctx.moveTo(-176,50);ctx.lineTo(-94,-84);ctx.lineTo(-27,-64);ctx.lineTo(-59,70);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(166,70);ctx.lineTo(101,-77);ctx.lineTo(35,-70);ctx.lineTo(56,70);ctx.closePath();ctx.fill();ctx.fillStyle='#938777';ctx.beginPath();ctx.ellipse(-61,-84,27,23,.5,0,TAU);ctx.fill();ctx.beginPath();ctx.ellipse(64,-75,25,22,-.5,0,TAU);ctx.fill();
// firearm metal silhouette
ctx.shadowColor='#000a';ctx.shadowBlur=17;ctx.fillStyle=gun==='ray'?'#386b5a':'#171e1e';ctx.beginPath();ctx.moveTo(-41,35);ctx.lineTo(-54,-112);ctx.lineTo(-24,-147);ctx.lineTo(-16,-220);ctx.lineTo(14,-220);ctx.lineTo(24,-147);ctx.lineTo(55,-112);ctx.lineTo(42,35);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.fillStyle=gun==='ray'?'#76dcb0':'#526059';ctx.fillRect(-14,-219,28,82);ctx.fillStyle='#0b1112';ctx.fillRect(-5,-245,10,39);ctx.fillStyle='#7b8278';ctx.fillRect(-20,-152,40,12);ctx.fillStyle='#2d3735';ctx.fillRect(-33,-104,66,100);ctx.fillStyle='#9b9182';ctx.fillRect(-26,-128,6,83);ctx.fillRect(21,-128,6,83);if(!compact){ctx.fillStyle='#131916';ctx.fillRect(-14,-196,28,29);ctx.fillStyle='#82978d';ctx.fillRect(-3,-203,6,26)}if(gun==='ray'){ctx.shadowBlur=16;ctx.shadowColor='#69ff91';ctx.fillStyle='#74fda4';ctx.fillRect(-12,-185,24,20);ctx.shadowBlur=0}
if(flash>0){ctx.globalAlpha=Math.min(1,flash*12);ctx.fillStyle=gun==='ray'?'#82ff9a':'#fff2aa';ctx.shadowBlur=35;ctx.shadowColor=gun==='ray'?'#4aff7c':'#f8b258';ctx.beginPath();ctx.moveTo(0,-245);ctx.lineTo(-25,-289);ctx.lineTo(-14,-250);ctx.lineTo(-50,-261);ctx.lineTo(-9,-230);ctx.lineTo(0,-204);ctx.lineTo(10,-234);ctx.lineTo(47,-259);ctx.lineTo(13,-251);ctx.lineTo(25,-289);ctx.closePath();ctx.fill()}
ctx.restore()}
function text(t,x,y,size,color='#f4eee3',align='left',font='sans-serif'){ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.font='bold '+size+'px '+font;ctx.fillText(t,x,y)}
function ui(){const mid=W/2;ctx.save();let down=nearestDown();if(down&&!player.downed){ctx.fillStyle='#2d0709dd';ctx.fillRect(mid-225,H-186,450,37);text('[ E ]  REVIVE '+down.name,mid,H-167,18,'#ffb8ac','center','monospace')}let mini=nearestStation();if(mini&&mini.d<1.68&&reloadTime<=0&&!down&&!player.downed){let s=mini.s;ctx.fillStyle='#030706b9';ctx.fillRect(mid-225,H-131,450,48);ctx.strokeStyle='#e5a66a';ctx.strokeRect(mid-225,H-131,450,48);let prompt=s.type==='perk'&&player.perk?'ALREADY OWNED':'[ E ]  '+(s.type==='box'?'SPIN MYSTERY BOX':s.type==='perk'?'BUY FORTIFIED':gun===s.type?'REFILL AMMO':'BUY '+s.label)+'  —  '+(gun===s.type&&s.type!=='box'&&s.type!=='perk'?450:s.price)+' PTS';text(prompt,mid,H-107,17,'#f0c48d','center','monospace')}
if(interactTime>0){ctx.globalAlpha=clamp(interactTime,0,1);ctx.fillStyle='#080a09cb';ctx.fillRect(mid-280,76,560,36);text(interactNotice,mid,94,17,'#f2d7a9','center','monospace');ctx.globalAlpha=1}
// crosshair
const bloom=shotKick*9;ctx.strokeStyle=player.health<30?'#ff7e63':'#efeed9';ctx.lineWidth=2;ctx.globalAlpha=.86;for(let k=0;k<4;k++){let a=k*Math.PI/2,from=8+bloom,to=16+bloom;ctx.beginPath();ctx.moveTo(mid+Math.cos(a)*from,HF+Math.sin(a)*from);ctx.lineTo(mid+Math.cos(a)*to,HF+Math.sin(a)*to);ctx.stroke()}ctx.fillStyle='#fff';ctx.fillRect(mid-1,HF-1,2,2);ctx.globalAlpha=1;
// Round-ten VIP boss health bar and visible catchphrases, shown on every client.
const vip=zombies.find(z=>z.vip&&z.health>0);
if(vip){
  ctx.fillStyle='#100507e8';ctx.fillRect(mid-260,10,520,63);
  ctx.strokeStyle='#e3462d';ctx.lineWidth=2;ctx.strokeRect(mid-260,10,520,63);
  text('VIP — ROUND 10 BOSS',mid,28,17,'#ffd0b6','center','monospace');
  ctx.fillStyle='#3c1719';ctx.fillRect(mid-244,43,488,16);
  ctx.fillStyle='#ff5334';ctx.fillRect(mid-244,43,488*clamp(vip.health/Math.max(1,vip.maxHealth),0,1),16);
  text(Math.ceil(vip.health)+' / '+vip.maxHealth,mid,52,12,'#ffffff','center','monospace');
  if(vip.quoteLeft>0&&vip.quote){ctx.fillStyle='#14090be3';ctx.fillRect(mid-236,83,472,38);
    text('VIP: '+vip.quote,mid,102,17,'#ffb180','center','monospace')}
  if(vip.laserCharge>0)text('WARNING: EYE LASERS CHARGING!',mid,133,14,'#ff8173','center','monospace');
}
// round marker
ctx.fillStyle='#090f0dc9';ctx.fillRect(18,16,147,65);text('ROUND',33,33,12,'#c9a58c','left','monospace');text(String(round).padStart(2,'0'),31,63,34,'#eac8a4');
// points and kills
ctx.fillStyle='#090f0dc6';ctx.fillRect(W-217,17,199,65);text('SCORE',W-197,33,11,'#a8a9a0','left','monospace');text(points.toLocaleString(),W-197,61,28,'#ebc289');text(kills+' KILLS',W-27,62,12,'#adb8aa','right','monospace');
// left health and stamina
ctx.fillStyle='#080d0bce';ctx.fillRect(19,H-91,224,70);text(player.perk?'FORTIFIED +':'HEALTH',30,H-77,12,player.perk?'#f3b69a':'#c8d7b9','left','monospace');ctx.fillStyle='#313632';ctx.fillRect(30,H-63,199,11);ctx.fillStyle=player.health<30?'#ea4739':'#9db88f';ctx.fillRect(30,H-63,199*player.health/player.maxHealth,11);text(Math.ceil(player.health)+' / '+player.maxHealth,227,H-76,12,'#eee9db','right','monospace');ctx.fillStyle='#2b302b';ctx.fillRect(30,H-40,199,4);ctx.fillStyle='#dab374';ctx.fillRect(30,H-40,199*player.stamina/100,4);
// team status
{let people=isHost()?[myRow(),...remotePlayers.values()]:Array.from(otherPlayers.values());if(role==='guest')people.push({...player,id:peer?.id,name:myName,slot:mySlot});people.sort((a,b)=>a.slot-b.slot);let posx=265;for(let p of people){ctx.fillStyle='#060b0ad9';ctx.fillRect(posx,H-37,93,19);text((p.downed?'✚ ':'')+p.name.slice(0,8),posx+4,H-27,10,p.downed?'#ff8c86':'#badbd2','left','monospace');posx+=97}}
// ammo
ctx.fillStyle='#070d0bdb';ctx.fillRect(W-245,H-105,226,84);text(guns[gun].name,W-229,H-87,13,'#b9c9b9','left','monospace');text(String(ammo),W-229,H-49,39,ammo<=Math.ceil(guns[gun].size*.25)?'#fa856a':'#f9f3dd');text('/ '+reserve,W-122,H-43,24,'#a5ada7');if(reloadTime>0)text('RELOADING…',W-229,H-20,12,'#f0bb83','left','monospace');else if(ammo===0)text('PRESS R TO RELOAD',W-229,H-20,12,'#f0bb83','left','monospace');
if(player.downed){ctx.fillStyle='#130000a8';ctx.fillRect(0,0,W,H);text('YOU ARE DOWN',W/2,H/2-50,38,'#fa6960','center');text('A TEAMMATE MUST REVIVE YOU',W/2,H/2,17,'#fff5ea','center','monospace')}
if(roundNotice>0){ctx.globalAlpha=clamp(roundNotice/1.1,0,1);text('ROUND '+round,mid,145,36,'#eaa37b','center');text(isDogRound(round)?'HELLHOUNDS IN THE MIST':'SURVIVE THE HORDE',mid,179,12,'#e2dad0','center','monospace');ctx.globalAlpha=1}
 let effectY=132;
 for(const kind of ['doublePoints','instaKill'])if(powerUps[kind]>0){
   const label=kind==='doublePoints'?'2X POINTS':'INSTA-KILL';
   text(label+' '+Math.ceil(powerUps[kind])+'s',W-28,effectY,14,kind==='doublePoints'?'#ffdc82':'#ff9a86','right','monospace');
   effectY+=20;
 }
if(hurt>0){ctx.fillStyle='rgba(204,28,13,'+(hurt*.2)+')';ctx.fillRect(0,0,W,H);ctx.strokeStyle='rgba(219,32,17,'+(hurt*.9)+')';ctx.lineWidth=29*hurt;ctx.strokeRect(0,0,W,H)}
// film grain/scanline texture
ctx.fillStyle='#00000016';for(let k=0;k<H;k+=4)ctx.fillRect(0,k,W,1);
ctx.restore()}

function nearestStation(){let near=null;for(let s of stations){let d=dist(s,player);if(!near||d<near.d)near={s,d}}return near}
function nearestDown(){let list=isHost()?Array.from(remotePlayers.values()):Array.from(otherPlayers.values());return list.find(p=>p.downed&&dist(p,player)<1.65)}
function interact(){if(!gameActive()||localPaused)return;let down=nearestDown();if(down){if(isHost())attemptRevive('host',down.id);else sendHost({t:'revive',target:down.id});notice('REVIVE REQUESTED',.7);return}let near=nearestStation();if(!near||near.d>=1.68){notice('NOTHING TO INTERACT WITH',1);return}if(isHost())performBuy('host',near.s.type);else sendHost({t:'buy',kind:near.s.type})}
function stationOf(type){return stations.find(s=>s.type===type)}
function actorById(id){return id==='host'?player:remotePlayers.get(id)}
function actorPoints(id){return id==='host'?points:remotePlayers.get(id)?.points||0}
function addPoints(id,n){if(id==='host')points+=n;else{let p=remotePlayers.get(id);if(p)p.points+=n}}
function performBuy(id,kind){let p=actorById(id),s=stationOf(kind);if(!p||p.downed||!s||dist(s,p)>=1.68)return;if(!['box','perk','smg','shotgun'].includes(kind))return;
let activeGun=id==='host'?gun:p.gun,price=activeGun===kind&&(kind==='smg'||kind==='shotgun')?450:s.price;
if(kind==='perk'&&p.perk){if(id==='host')notice('FORTIFIED ALREADY ACTIVE');return}
if(actorPoints(id)<price){if(id==='host')notice('NOT ENOUGH POINTS — NEED '+price);else sendToId(id,{t:'notice',message:'NOT ENOUGH POINTS — NEED '+price});return}
addPoints(id,-price);if(kind==='perk'){p.perk=true;p.maxHealth=180;p.health=180;if(id==='host')notice('FORTIFIED — MAX HEALTH INCREASED')}
else{let selection=kind==='box'?['smg','shotgun','rifle','lmg','ray'][Math.floor(Math.random()*5)]:kind;if(id==='host'){if(selection===gun&&kind!=='box')reserve+=guns[gun].reserve;else equip(selection);notice('ACQUIRED: '+guns[selection].name)}else{const refill=(selection===p.gun&&kind!=='box');p.gun=selection;sendToId(id,{t:refill?'refill':'purchase',gun:selection,ammo:guns[selection].size,reserve:guns[selection].reserve,notice:refill?'AMMUNITION RESTOCKED':'ACQUIRED: '+guns[selection].name})}}
if(id==='host')sound(420,.12,'triangle',.08,280)}
function equip(g){gun=g;ammo=guns[g].size;reserve=guns[g].reserve;reloadTime=0;shotCooldown=.2}
function reload(){if(!gameActive()||localPaused||player.downed||reloadTime>0||ammo===guns[gun].size||reserve<=0)return;reloadTime=guns[gun].reload;mouseHeld=false;sound(520,.075,'triangle',.065,-270)}
function spawnBlood(x,y,head){for(let i=0;i<(head?18:9);i++)particles.push({x,y,vx:rand(-140,140),vy:rand(-140,60),gravity:rand(140,260),life:rand(.18,.6),size:rand(2,7),head})}
function unobstructed(a,b){let d=dist(a,b),steps=Math.ceil(d/.11);for(let i=1;i<steps;i++){let f=i/steps;if(solid(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f))return false}return true}
function resolveShot(actor,id,w,angle){if(!running||!actor||actor.downed||!guns[w])return;
let now=elapsed;if(now-actor.lastFire<guns[w].rate*.77)return;actor.lastFire=now;
let weapon=guns[w],forwardX=Math.cos(angle),forwardY=Math.sin(angle);let candidates=[];
for(let z of zombies){let dx=z.x-actor.x,dy=z.y-actor.y,front=dx*forwardX+dy*forwardY,side=Math.abs(-dx*forwardY+dy*forwardX);if(front>.18&&front<18&&side<1.4&&unobstructed(actor,z))candidates.push({z,front,side})}
candidates.sort((a,b)=>a.front-b.front);
for(let j=0;j<weapon.pellets;j++){let spread=rand(-1,1)*weapon.spread;let ax=Math.cos(angle+spread),ay=Math.sin(angle+spread);
let hit=candidates.find(c=>{let dx=c.z.x-actor.x,dy=c.z.y-actor.y;return Math.abs(-dx*ay+dy*ax)<(c.z.vip?.55:.32)&&dx*ax+dy*ay>.2});if(!hit)continue;
let z=hit.z;if(!zombies.includes(z))continue;let head=Math.random()<.19;z.health-=powerUps.instaKill>0&&!z.vip?z.health:weapon.damage*(head?1.65:1);awardZombiePoints(id,10);if(id==='host'){let p=screenOf(z.x,z.y);spawnBlood(clamp(p.x,15,W-15),HF-H*.32/Math.max(.4,p.depth),head)}
if(z.health<=0){zombies.splice(zombies.indexOf(z),1);
 awardZombiePoints(id,z.vip?2000:(head?150:100));
 if(z.dog&&isDogRound(round)&&waveSpawned>=waveTotal&&!zombies.some(e=>e.dog))spawnDrop(z.x,z.y,'maxammo',true);
 else spawnDrop(z.x,z.y);
if(z.vip){notice('THE VIP HAS BEEN DEFEATED!',4);broadcast({t:'notice',message:'THE VIP HAS BEEN DEFEATED!'});sound(240,1,'triangle',.19,-190)}if(id==='host')kills++;else{let p=remotePlayers.get(id);if(p)p.kills++}}}
}
function fire(){if(!gameActive()||localPaused||player.downed||shotCooldown>0||reloadTime>0)return;if(ammo<=0){shotCooldown=.23;sound(650,.02,'square',.025,-200);return}
ammo--;let w=guns[gun];shotCooldown=w.rate;shotKick=.6;flash=.09;shake=.16;clickSound();
if(isHost())resolveShot(player,'host',gun,player.ang);else sendHost({t:'shot',gun,angle:player.ang});
if(ammo===0&&reserve>0)notice('MAGAZINE EMPTY — PRESS R',1.1)}
function attemptRevive(by,targetId){if(!running)return;let a=actorById(by),b=actorById(targetId);if(!a||!b||a.downed||!b.downed||dist(a,b)>=1.65)return;b.downed=false;b.health=Math.round(b.maxHealth*.5);b.regen=3;addPoints(by,200);notice(b.name+' REVIVED!',2);broadcast({t:'notice',message:b.name+' IS BACK IN THE FIGHT!'})}

function renderParticles(){for(let e of particles){ctx.globalAlpha=clamp(e.life*2,0,1);ctx.fillStyle=e.spark?'#ffce87':e.head?'#f04b2a':'#a3412f';ctx.fillRect(e.x,e.y,e.size,e.size)}ctx.globalAlpha=1}

function render(){if(!player){ctx.fillStyle='#0a100f';ctx.fillRect(0,0,W,H);return}
 ctx.save();if(shake>0)ctx.translate(rand(-6,6)*shake,rand(-6,6)*shake);
 wallRender();drawWorld();dogWeather();drawDrops();renderParticles();gunDraw();ui();ctx.restore();
 status.textContent=role==='none'?'NOT CONNECTED':'ROOM '+roomCode+' · '+(running?'ROUND '+round+' · '+zombies.length+(isDogRound(round)?' HELLHOUNDS':' ZOMBIES'):'LOBBY')}
function frame(t){let dt=Math.min((t-last)/1000||0,.05);last=t;update(dt);render();requestAnimationFrame(frame)}
function sendHost(obj){if(hostConn?.open)try{hostConn.send(obj)}catch(e){}}
function sendToId(id,obj){let c=guestConns.get(id);if(c?.open)try{c.send(obj)}catch(e){}}
function broadcast(obj){for(let c of guestConns.values())if(c.open)try{c.send(obj)}catch(e){}}
function statePacket(){return{t:'state',running,round,roundGap,waveSpawned,waveTotal,
 powerUps:{...powerUps},lightningFlash,
 drops:drops.map(d=>({id:d.id,x:d.x,y:d.y,kind:d.kind,ttl:d.ttl})),
zombies:zombies.map(z=>({id:z.id,x:z.x,y:z.y,health:z.health,maxHealth:z.maxHealth,variant:z.variant,anim:z.anim,
vip:!!z.vip,dog:!!z.dog,arrivalFx:z.arrivalFx||0,laserCharge:z.laserCharge||0,laserFx:z.laserFx||0,laserTargetX:z.laserTargetX,laserTargetY:z.laserTargetY,
quote:z.quote,quoteLeft:z.quoteLeft||0,quoteSerial:z.quoteSerial||0})),
people:[myRow(),...remotePlayers.values()].map(p=>({id:p.id,name:p.name,x:p.x,y:p.y,ang:p.ang,health:p.health,maxHealth:p.maxHealth,downed:p.downed,perk:p.perk,points:p.points,kills:p.kills,gun:p.gun,slot:p.slot}))}}
function broadcastState(){broadcast(statePacket())}
function applySnapshot(s){if(!s||s.t!=='state'||!Array.isArray(s.people)||!Array.isArray(s.zombies))return;
const previousRound=round;round=s.round;waveSpawned=s.waveSpawned;waveTotal=s.waveTotal;roundGap=s.roundGap;
 powerUps={doublePoints:Math.max(0,s.powerUps?.doublePoints||0),instaKill:Math.max(0,s.powerUps?.instaKill||0)};
 lightningFlash=Math.max(lightningFlash,s.lightningFlash||0);
 drops=Array.isArray(s.drops)?s.drops.filter(d=>DROP_META[d.kind]):[];
const self=s.people.find(p=>p.id===peer?.id);if(self){if(player.health>self.health)hurt=.8;player.health=self.health;player.maxHealth=self.maxHealth;player.downed=self.downed;player.perk=self.perk;points=self.points;kills=self.kills;if(!running||state==='ready'||state==='lobby'){player.x=self.x;player.y=self.y;player.ang=self.ang}}
otherPlayers.clear();for(let p of s.people)if(p.id!==peer?.id)otherPlayers.set(p.id,p);
const existing=new Map(zombies.map(z=>[z.id,z]));let updated=[];for(let z of s.zombies){let old=existing.get(z.id);if(old){if(z.vip&&old.quoteSerial!==z.quoteSerial&&z.quoteLeft>0)vipVoice(z.quote);
old.tx=z.x;old.ty=z.y;Object.assign(old,{health:z.health,maxHealth:z.maxHealth,variant:z.variant,vip:z.vip,dog:z.dog,arrivalFx:z.arrivalFx,
laserCharge:z.laserCharge,laserFx:z.laserFx,laserTargetX:z.laserTargetX,laserTargetY:z.laserTargetY,
quote:z.quote,quoteLeft:z.quoteLeft,quoteSerial:z.quoteSerial});updated.push(old)}
else{if(z.vip&&z.quoteLeft>0)vipVoice(z.quote);updated.push({...z,tx:z.x,ty:z.y})}}zombies=updated;
if(!running&&s.running){running=true;showReady()}else running=!!s.running;
if(round!==previousRound&&round>0){roundNotice=3.1;notice(isDogRound(round)?'HELLHOUND ROUND — WATCH THE LIGHTNING!':'ROUND '+round+' — INCOMING!',2.3)}
statusRoom()}
function hostAddGuest(conn,m){if(!conn.open||guestConns.has(conn.peer))return;
if(guestConns.size>=3){conn.send({t:'reject',message:'ROOM FULL — 4 PLAYER LIMIT'});setTimeout(()=>conn.close(),200);return}
let used=new Set([0,...Array.from(remotePlayers.values()).map(p=>p.slot)]),slot=[1,2,3].find(n=>!used.has(n));
const p=newActor(slot,cleanName(m.name),conn.peer);if(running){let [x,y]=spawnSpots[slot];p.x=x;p.y=y}remotePlayers.set(conn.peer,p);guestConns.set(conn.peer,conn);
conn.send({t:'welcome',slot,room:roomCode,started:running,id:conn.peer,people:[myRow(),...remotePlayers.values()]});
broadcastState();updateRoster();say('Room live · '+(guestConns.size+1)+'/4 connected')}
function guestMessage(conn,m){if(!m||typeof m!=='object')return;
if(m.t==='join'){hostAddGuest(conn,m);return}let p=remotePlayers.get(conn.peer);if(!p||!running)return;
if(m.t==='pose'&&typeof m.x==='number'&&typeof m.y==='number'&&Number.isFinite(m.x)&&Number.isFinite(m.y)&&Math.abs(m.x-p.x)<4&&Math.abs(m.y-p.y)<4){let x=clamp(m.x,.3,MW-.3),y=clamp(m.y,.3,MH-.3);if(!p.downed&&canStand(x,y,.23)){p.x=x;p.y=y}if(Number.isFinite(m.ang))p.ang=normAng(m.ang)}
else if(m.t==='shot'&&typeof m.angle==='number'&&Number.isFinite(m.angle)&&m.gun===p.gun){resolveShot(p,conn.peer,p.gun,normAng(m.angle))}
else if(m.t==='buy'){performBuy(conn.peer,m.kind)}
else if(m.t==='revive'){attemptRevive(conn.peer,m.target)}
}
function peerError(e){soundError(e);if(e?.type==='peer-unavailable')say('Room not found. Check the code and ensure the host is online.');}
function createRoom(){closeNetwork();mySlot=0;myName=cleanName(nameInput.value);let b=new Uint8Array(5);crypto.getRandomValues(b);roomCode=Array.from(b,byte=>(byte%36).toString(36).toUpperCase()).join('');role='host';reset();say('Connecting to online signalling…');statusRoom();lobby.hidden=true;
if(typeof Peer==='undefined'){say('PeerJS did not load. Check your internet connection.');closeNetwork();return}
peer=new Peer('dead-air-4coop-'+roomCode,{debug:1});
peer.on('open',()=>{say('Room ready — share your room code or link.');showLobby('lobby')});
peer.on('connection',c=>{c.on('data',m=>guestMessage(c,m));c.on('close',()=>{guestConns.delete(c.peer);remotePlayers.delete(c.peer);broadcastState();updateRoster();say('Player disconnected')});c.on('error',peerError)});
peer.on('error',peerError);peer.on('disconnected',()=>say('Signalling disconnected. Existing teammates may remain linked.'));
}
function joinRoom(){closeNetwork();roomCode=goodCode(roomInput.value);myName=cleanName(nameInput.value);if(roomCode.length<5){say('Enter the 5-character room code.');return}role='guest';mySlot=1;reset();say('Connecting to host '+roomCode+'…');lobby.hidden=false;go.style.display='none';statusRoom();
if(typeof Peer==='undefined'){say('PeerJS did not load. Check your internet connection.');closeNetwork();return}
peer=new Peer(undefined,{debug:1});peer.on('open',()=>{hostConn=peer.connect('dead-air-4coop-'+roomCode,{reliable:true});
hostConn.on('open',()=>{sendHost({t:'join',name:myName});say('Connected — awaiting room confirmation…')});
hostConn.on('data',m=>{if(!m||typeof m!=='object')return;
if(m.t==='welcome'){mySlot=m.slot;player=newActor(mySlot,myName,peer.id);for(let p of m.people){if(p.id===peer.id){player.x=p.x;player.y=p.y} else otherPlayers.set(p.id,p)}say('Connected to '+m.room);statusRoom();if(m.started){running=true;showReady()}else showLobby('lobby')}
else if(m.t==='state')applySnapshot(m);
else if(m.t==='start'){running=true;showReady()}
else if(m.t==='purchase'){equip(m.gun);reserve=m.reserve;notice(m.notice||'PURCHASE COMPLETE',2)}
else if(m.t==='refill'){reserve+=m.reserve;notice(m.notice||'AMMUNITION RESTOCKED',2)}
else if(m.t==='maxammo'){ammo=guns[gun].size;reserve=guns[gun].reserve;reloadTime=0;notice('MAX AMMO!',3)}
else if(m.t==='notice')notice(String(m.message).slice(0,80),2);
else if(m.t==='gameover'){round=m.round;menu('dead')}
else if(m.t==='reject'){say(m.message||'ROOM REJECTED');if(hostConn)hostConn.close()}});
hostConn.on('close',()=>{running=false;showLobby('lobby');say('Host disconnected. This room has ended.')});hostConn.on('error',peerError);
joinTimeout=setTimeout(()=>{if(role==='guest'&&!hostConn?.open)say('Could not reach host. Check code, browser and network/firewall.')},18000)
});peer.on('error',peerError);peer.on('disconnected',()=>say('Signalling disconnected.'));
}
function startMatch(){if(role!=='host')return;reset();for(let p of remotePlayers.values())resetActor(p);running=true;newWave();broadcast({t:'start'});broadcastState();play();statusRoom()}
root.querySelector('#da-mute').onclick=e=>{audioEnabled=!audioEnabled;e.currentTarget.textContent=audioEnabled?'♫ Sound On':'♫ Sound Off'};
root.querySelector('#da-full').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen?.();else viewport.requestFullscreen?.()};
hostButton.onclick=createRoom;joinButton.onclick=joinRoom;
copyButton.onclick=async()=>{const url=new URL(location.href);url.searchParams.set('room',roomCode);url.hash='';try{await navigator.clipboard.writeText(url.href);say('Invite link copied!')}catch(e){roomInput.value=roomCode;roomInput.select();say('Copy the room code, or share this URL: '+url.href)}};
go.onclick=()=>{if(role==='host'&&!running)startMatch();else if(running)play()};
canvas.addEventListener('click',()=>{if(gameActive()&&!localPaused&&document.pointerLockElement!==canvas&&canvas.requestPointerLock)canvas.requestPointerLock().catch(()=>{})});
canvas.addEventListener('mousedown',e=>{if(gameActive()&&!localPaused&&e.button===0){mouseHeld=true;fire()}isDragging=true;prevMouse=e.clientX});
window.addEventListener('mouseup',()=>{mouseHeld=false;isDragging=false});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==canvas&&gameActive()&&!localPaused&&!isDragging)pauseLocal()});
window.addEventListener('mousemove',e=>{if(!gameActive()||localPaused)return;if(document.pointerLockElement===canvas)player.ang+=e.movementX*.0026;else if(isDragging){player.ang+=(e.clientX-prevMouse)*.005;prevMouse=e.clientX}});
canvas.addEventListener('touchstart',e=>{if(!gameActive()||localPaused)return;isDragging=true;prevMouse=e.touches[0]?.clientX||0;e.preventDefault()},{passive:false});
canvas.addEventListener('touchmove',e=>{if(!gameActive()||localPaused)return;let x=e.touches[0]?.clientX||prevMouse;player.ang+=(x-prevMouse)*.008;prevMouse=x;e.preventDefault()},{passive:false});
canvas.addEventListener('touchend',()=>{isDragging=false;mouseHeld=false});
window.addEventListener('keydown',e=>{if(!root.isConnected)return;let k=e.code;if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(k)&&gameActive())e.preventDefault();if(k==='Escape'&&gameActive()){pauseLocal();return}if(!gameActive()||localPaused)return;held[k]=true;if(k==='KeyR'&&!e.repeat)reload();if(k==='KeyE'&&!e.repeat)interact();if(k==='Space'&&!e.repeat)fire();if(k==='KeyP'&&!e.repeat)pauseLocal()});
window.addEventListener('keyup',e=>{held[e.code]=false});window.addEventListener('blur',()=>{held={};mouseHeld=false;if(gameActive())pauseLocal()});
nameInput.value='SURVIVOR';const codeQuery=new URLSearchParams(location.search).get('room');if(codeQuery){roomInput.value=goodCode(codeQuery);say('Invite detected — enter a name and press JOIN ROOM.')}else say('Create a room or join a friend.');
reset();showLobby('menu');requestAnimationFrame(frame);

})();
