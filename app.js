// LinkRoom v2 — GitHub Pages / Vanilla JS / Firebase Auth + Firestore.
// A room ID is a random, secret, 24-character invite capability. NEVER query all rooms.
const NAME_KEY = 'linkroom.nickname.v1';
const UID_KEY = 'linkroom.demo.uid.v1';
const THEME_KEY = 'linkroom.theme.v1';
const HISTORY_KEY = 'linkroom.v2.rooms';
const DEMO_KEY = 'linkroom.v2.demo';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{24}$/;
const EMOJIS = ['👍', '❤️', '😂', '😮', '🎉', '👀'];
const INLINE_MAX = 256 * 1024;
const FIRESTORE_FILE_MAX = 3 * 1024 * 1024; // Sparkでも使える、分割保存した添付ファイルの上限
const CHUNK_BYTES = 96 * 1024; // Firestoreの1ドキュメント1MiB制限より十分小さくする
const STORAGE_MAX = 8 * 1024 * 1024;
const COLOR_POOL = ['#8d7fe0','#46a5b8','#d28883','#b28b4f','#8a9c59','#c47db9','#627aba'];
const EXT_TO_MIME = {
  png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', gif:'image/gif',
  pdf:'application/pdf', txt:'text/plain', csv:'text/csv', zip:'application/zip',
  docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};
const ALLOWED_MIMES = Object.values(EXT_TO_MIME);
const $ = (id) => document.getElementById(id);
let nickname = (localStorage.getItem(NAME_KEY) || '').trim().slice(0,24);
let demoUid = localStorage.getItem(UID_KEY);
if (!demoUid) { demoUid = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem(UID_KEY, demoUid); }
let currentUid = demoUid;
let mode = 'demo';
let firebase = null;
let readyPromise = Promise.resolve();
let currentRoom = null;
let joinedRooms = readRoomHistory();
let latestMessages = [];
let reactionRecords = [];
let unsubscribeMessages = null;
let unsubscribeReactions = null;
let loadVersion = 0;
let selectedFile = null;
let sending = false;
let openPickerMessage = null;
let toastTimeout = 0;
const config = window.CHAT_FIREBASE_CONFIG || {};
const configured = !!(config.apiKey && config.authDomain && config.projectId && config.appId && !config.apiKey.includes('ここに'));
const uploadEnabled = configured && Boolean(config.storageBucket && window.CHAT_ENABLE_STORAGE_UPLOADS === true);

function getLocal() {
  try { const d = JSON.parse(localStorage.getItem(DEMO_KEY) || '{}'); return { rooms: d.rooms || {}, messages: d.messages || {}, reactions: d.reactions || {} }; }
  catch { return { rooms:{}, messages:{}, reactions:{} }; }
}
function writeLocal(d) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); return true; }
  catch { notify('保存容量が不足しています。大きな添付ファイルを減らしてください。'); return false; }
}
function readRoomHistory() {
  try { const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); return Array.isArray(data) ? data.filter(x => x && CODE_PATTERN.test(x.code) && typeof x.title === 'string').slice(0,40) : []; }
  catch { return []; }
}
function saveRoom(code, title) {
  joinedRooms = [{code,title}, ...joinedRooms.filter(x => x.code !== code)].slice(0,40);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(joinedRooms)); } catch { /* optional */ }
  renderRoomButtons(); renderSavedRooms();
}
function generateCode() {
  const values = new Uint8Array(24);
  // 32文字のアルファベットなので剰余でも偏りなし。
  crypto.getRandomValues(values);
  return Array.from(values, n => CODE_CHARS[n % CODE_CHARS.length]).join('');
}
function normalizedCode(s) { return String(s || '').toUpperCase().replace(/[\s-]/g,''); }
function prettyCode(s) { return String(s || '').match(/.{1,4}/g)?.join('-') || ''; }
function safeTime(m) { return m.createdAt?.toMillis?.() ?? (typeof m.createdAt === 'number' ? m.createdAt : Date.now()); }
function localDay(ms) { const d=new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function dateLabel(ms) { if (localDay(ms)===localDay(Date.now())) return '今日'; if(localDay(ms)===localDay(Date.now()-86400000))return'昨日';return new Intl.DateTimeFormat('ja-JP',{month:'long',day:'numeric',weekday:'short'}).format(ms); }
function timeLabel(ms) { return new Intl.DateTimeFormat('ja-JP',{hour:'2-digit',minute:'2-digit'}).format(ms); }
function colorFor(str) {let n=0;for(const c of String(str))n=(n*31+c.charCodeAt(0))|0;return COLOR_POOL[Math.abs(n)%COLOR_POOL.length];}
function avatarLetter(str) {return [...String(str||'?')][0]?.toUpperCase()||'?';}
function icon(id) {const el=document.createElementNS('http://www.w3.org/2000/svg','svg');el.classList.add('icon');el.setAttribute('aria-hidden','true');const u=document.createElementNS('http://www.w3.org/2000/svg','use');u.setAttribute('href',`#${id}`);el.append(u);return el;}
function notify(text) {clearTimeout(toastTimeout);$('toast').textContent=text;$('toast').hidden=false;toastTimeout=setTimeout(()=>{$('toast').hidden=true;},3800);}
function showError(text='') {$('error-banner').textContent=text;$('error-banner').hidden=!text;}
function setStatus(text,kind='') {$('connection-text').textContent=text;$('connection-status').className=`connection-status ${kind}`; $('onboard-connection').textContent = mode==='demo' ? 'デモモード：この端末だけで試せます' : `Firebase: ${text}`;}
function updateProfile() {$('my-name').textContent=nickname||'ゲスト';$('my-avatar').textContent=avatarLetter(nickname);$('my-avatar').style.background=colorFor(currentUid);}
function setTheme(theme) {
  document.body.classList.toggle('light',theme==='light');
  localStorage.setItem(THEME_KEY,theme);
  $('theme-button').title=theme==='light'?'ダークモードに切り替え':'ライトモードに切り替え';
  $('theme-button').setAttribute('aria-label',$('theme-button').title);
  $('welcome-theme-button').textContent=theme==='light'?'🌙 ダークモード':'☀️ ライトモード';
}
function clearOnboardError() {$('onboard-alert').hidden=true;$('onboard-alert').textContent='';}
function onboardError(message) {$('onboard-alert').hidden=false;$('onboard-alert').textContent=message;}
function step(name) {
  document.querySelectorAll('.step-page').forEach(x => x.hidden=x.dataset.step!==name);
  clearOnboardError();
  $('onboarding').hidden=false;
  $('app-shell').hidden=true;
  const focus = {nickname:'onboard-nickname',create:'create-room-name',join:'join-code'}[name];
  if(focus) setTimeout(()=>$(focus).focus(),40);
  renderSavedRooms();
}
function toChoice() { $('choice-name').textContent=nickname||'ゲスト';step('choice'); }
function renderSavedRooms() {
  const area=$('saved-room-section'),list=$('saved-room-buttons');list.replaceChildren();
  area.hidden=joinedRooms.length===0;
  joinedRooms.forEach(room=>{const b=document.createElement('button');b.type='button';b.className='saved-room-button';b.textContent=`# ${room.title}`;b.addEventListener('click',()=>openRoomByCode(room.code));list.append(b);});
}
function renderRoomButtons() {
  const list=$('channel-buttons');list.replaceChildren();
  joinedRooms.forEach(room=>{
    const b=document.createElement('button');b.type='button';b.className=`channel ${room.code===currentRoom?'active':''}`;
    b.setAttribute('aria-label',`${room.title}を開く`);
    if(room.code===currentRoom)b.setAttribute('aria-current','page');
    const hash=document.createElement('span');hash.className='channel-hash';hash.textContent='#';
    const label=document.createElement('span');label.textContent=room.title;label.style.cssText='overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1';
    b.append(hash,label);
    if(room.code===currentRoom){const dot=document.createElement('span');dot.className='channel-live-dot';b.append(dot);}
    b.addEventListener('click',()=>openRoomByCode(room.code));list.append(b);
  });
}
function closeMenu() {$('channel-panel').classList.remove('open');$('mobile-backdrop').hidden=true;}
function showInfo(open) {$('info-panel').classList.toggle('open',open);$('info-button').setAttribute('aria-expanded',String(open));}
function scrollBottom() {requestAnimationFrame(()=>{$('conversation').scrollTop=$('conversation').scrollHeight;});}
function updateRoomUI() {
  const r=joinedRooms.find(x=>x.code===currentRoom);
  const title=r?.title||'チャット';
  $('room-title').textContent=title;$('room-subtitle').textContent='招待された仲間だけのチャットルーム';
  $('intro-title').textContent=`${title}へようこそ！`;$('intro-description').textContent='リアクションやファイルを使って、みんなと楽しく話そう。';
  $('composer-channel').textContent=`# ${title}`;$('info-room').textContent=`# ${title}`;
  $('info-code').textContent=prettyCode(currentRoom);$('info-description').textContent='招待コードを知っている人が参加できます。';
  renderRoomButtons();
}
async function ensureReady() {await readyPromise;if(mode==='cloud'&&!firebase)throw new Error('Firebaseに接続できません。設定と匿名認証を確認してください。');}
async function createRoom(title) {
  await ensureReady();
  let code=generateCode();
  if(mode==='demo') {
    const d=getLocal();while(d.rooms[code])code=generateCode();
    d.rooms[code]={title,ownerUid:currentUid,createdAt:Date.now()};d.messages[code]=[];d.reactions[code]={};
    if(!writeLocal(d))throw new Error('ローカル保存に失敗しました');
  } else {
    const {fs,db}=firebase;
    await fs.setDoc(fs.doc(db,'rooms',code),{title,ownerUid:currentUid,createdAt:fs.serverTimestamp()});
    await joinMembership(code);
  }
  saveRoom(code,title);currentRoom=code;
  $('created-room-name').textContent=title;$('created-code').textContent=prettyCode(code);
  step('created');
}
async function joinMembership(code) {
  if(mode==='demo')return;
  const {fs,db}=firebase;
  const ref=fs.doc(db,'rooms',code,'members',currentUid);
  const existing=await fs.getDoc(ref);
  if(!existing.exists())await fs.setDoc(ref,{name:nickname,joinedAt:fs.serverTimestamp()});
}
async function openRoomByCode(raw) {
  const code=normalizedCode(raw);
  if(!CODE_PATTERN.test(code)){onboardError('招待コードは英数字24文字です。正しいコードを入力してください。');return;}
  const sourceButton=$('join-room-submit');sourceButton.disabled=true;
  clearOnboardError();
  try {
    await ensureReady();
    let title;
    if(mode==='demo') {
      const room=getLocal().rooms[code];
      if(!room)throw new Error('この端末のデモデータに部屋がありません。別の端末と話す場合はFirebaseの設定が必要です。');
      title=room.title;
    } else {
      const {fs,db}=firebase;
      const snap=await fs.getDoc(fs.doc(db,'rooms',code));
      if(!snap.exists())throw new Error('招待コードが見つかりません。もう一度確認してください。');
      title=snap.data().title;
      await joinMembership(code);
    }
    currentRoom=code;saveRoom(code,title);showChat();
  } catch(error){console.error('部屋への参加失敗',error);onboardError(error.message||'部屋への参加に失敗しました。');}
  finally{sourceButton.disabled=false;}
}
function showChat() {
  if(!currentRoom)return;
  $('onboarding').hidden=true;$('app-shell').hidden=false;
  updateRoomUI();updateProfile();closeMenu();showInfo(false);showError('');
  $('search-input').value='';$('search-bar').hidden=true;$('search-button').setAttribute('aria-expanded','false');
  subscribeRoom();
}
function stopSubscriptions() {if(unsubscribeMessages){unsubscribeMessages();unsubscribeMessages=null;}if(unsubscribeReactions){unsubscribeReactions();unsubscribeReactions=null;}}
function subscribeRoom() {
  stopSubscriptions();const version=++loadVersion;
  latestMessages=[];reactionRecords=[];openPickerMessage=null;renderMessages({scroll:true});
  if(!currentRoom)return;
  if(mode==='demo') {
    const d=getLocal();latestMessages=(d.messages[currentRoom]||[]).slice(-100).sort((a,b)=>safeTime(a)-safeTime(b));
    reactionRecords=Object.values(d.reactions[currentRoom]||{});
    renderMessages({scroll:true});setStatus('デモモード','demo');return;
  }
  if(!firebase)return;
  setStatus('読み込み中');
  const {fs,db}=firebase;
  const q=fs.query(fs.collection(db,'rooms',currentRoom,'messages'),fs.orderBy('createdAt','desc'),fs.limit(100));
  unsubscribeMessages=fs.onSnapshot(q,(snapshot)=>{
    if(version!==loadVersion)return;
    latestMessages=snapshot.docs.map(d=>({id:d.id,...d.data()})).reverse();
    renderMessages();setStatus('リアルタイム','connected');showError('');
  },error=>{if(version!==loadVersion)return;console.error(error);setStatus('読み込みエラー');showError('メッセージを取得できません。Firestoreの新しいルールと匿名認証を確認してください。');});
  const rq=fs.query(fs.collection(db,'rooms',currentRoom,'reactions'),fs.orderBy('createdAt','desc'),fs.limit(500));
  unsubscribeReactions=fs.onSnapshot(rq,(snapshot)=>{
    if(version!==loadVersion)return;
    reactionRecords=snapshot.docs.map(d=>({id:d.id,...d.data()}));renderMessages();
  },error=>{console.error('リアクション受信エラー',error);notify('リアクションを読み込めません。Firestoreルールを確認してください。');});
}
function renderMessages({scroll=false}={}) {
  const search=$('search-input').value.trim().toLocaleLowerCase();
  const visible=latestMessages.filter(m=>!search||`${m.name} ${m.text} ${m.file?.name||''}`.toLocaleLowerCase().includes(search));
  const pane=$('conversation');const shouldScroll=scroll||(pane.scrollHeight-pane.scrollTop-pane.clientHeight<125);
  const root=$('messages'),frag=document.createDocumentFragment();let lastDay='';
  const reactionsByMessage={};
  for(const r of reactionRecords){(reactionsByMessage[r.messageId]??=[]).push(r);}
  for(const message of visible) {
    const created=safeTime(message),day=localDay(created);
    if(day!==lastDay){const d=document.createElement('div');d.className='date-divider';d.textContent=dateLabel(created);frag.append(d);lastDay=day;}
    const row=document.createElement('article');row.className='message-row';row.dataset.messageId=message.id;
    const avatar=document.createElement('div');avatar.className='message-avatar';avatar.textContent=avatarLetter(message.name);avatar.style.backgroundColor=colorFor(message.uid||message.name);
    const content=document.createElement('div');content.className='message-content';
    const meta=document.createElement('div');meta.className='message-meta';
    const name=document.createElement('strong');name.className='message-name';name.textContent=message.name||'ゲスト';meta.append(name);
    if(message.uid===currentUid){const tag=document.createElement('span');tag.className='own-tag';tag.textContent='自分';meta.append(tag);}
    const time=document.createElement('time');time.className='message-time';time.textContent=timeLabel(created);time.dateTime=new Date(created).toISOString();meta.append(time);
    const text=document.createElement('div');text.className='message-text';text.textContent=message.text||'';content.append(meta,text);
    if(message.file)renderAttachment(message,content);
    const reactionBar=document.createElement('div');reactionBar.className='reactions';
    const current=reactionsByMessage[message.id]||[];
    const grouped=new Map();for(const r of current){if(!EMOJIS.includes(r.emoji))continue;const g=grouped.get(r.emoji)||{count:0,mine:false};g.count++;g.mine ||= r.uid===currentUid;grouped.set(r.emoji,g);}
    for(const emoji of EMOJIS){if(!grouped.has(emoji))continue;const g=grouped.get(emoji);const button=document.createElement('button');button.type='button';button.className=`reaction-chip ${g.mine?'my-reaction':''}`;button.textContent=`${emoji} ${g.count}`;button.title=`${emoji} リアクション ${g.count}件`;button.setAttribute('aria-pressed',String(g.mine));button.addEventListener('click',()=>react(message.id,emoji));reactionBar.append(button);}
    const add=document.createElement('button');add.type='button';add.className='react-add';add.textContent='☺ ＋';add.title='リアクションを付ける';add.setAttribute('aria-label','リアクションを付ける');add.setAttribute('aria-expanded',String(openPickerMessage===message.id));add.addEventListener('click',()=>{openPickerMessage=openPickerMessage===message.id?null:message.id;renderMessages();});reactionBar.append(add);
    content.append(reactionBar);
    if(openPickerMessage===message.id){const picker=document.createElement('div');picker.className='react-picker';picker.setAttribute('role','group');picker.setAttribute('aria-label','絵文字を選択');EMOJIS.forEach(emoji=>{const b=document.createElement('button');b.type='button';b.textContent=emoji;b.setAttribute('aria-label',`${emoji} を付ける`);b.addEventListener('click',()=>{openPickerMessage=null;react(message.id,emoji);});picker.append(b);});content.append(picker);}
    row.append(avatar,content);
    if(message.uid===currentUid){const del=document.createElement('button');del.type='button';del.className='delete-message';del.title='投稿を削除';del.setAttribute('aria-label','投稿を削除');del.append(icon('i-trash'));del.addEventListener('click',()=>deleteMessage(message));row.append(del);}
    frag.append(row);
  }
  root.replaceChildren(frag);$('empty-state').hidden=visible.length>0||!!search;
  if(search&&!visible.length){const p=document.createElement('p');p.className='search-no-results';p.textContent='該当するメッセージはありません。';root.append(p);}
  if(shouldScroll)scrollBottom();
}
function formatBytes(n){return n>=1048576?`${(n/1048576).toFixed(1)} MB`:`${Math.ceil(n/1024)} KB`;}
function renderAttachment(message,container){
  const f=message.file;if(!f||typeof f!=='object')return;
  const bar=document.createElement('div');bar.className='attached-file';
  const ico=document.createElement('div');ico.className='file-icon';ico.textContent=f.mime?.startsWith('image/')?'🖼️':'📄';
  const details=document.createElement('div');details.className='file-details';const name=document.createElement('strong');name.textContent=f.name||'添付ファイル';
  const size=document.createElement('small');size.textContent=formatBytes(f.bytes||0);details.append(name,size);
  const button=document.createElement('button');button.type='button';button.className='file-download';button.textContent='保存';button.addEventListener('click',()=>downloadAttachment(f));bar.append(ico,details,button);container.append(bar);
  if(f.kind==='chunks' && f.mime?.startsWith('image/')){
    const preview=document.createElement('button');preview.type='button';preview.className='file-preview-open';preview.textContent='画像を表示';
    preview.addEventListener('click',async()=>{
      preview.disabled=true;preview.textContent='読み込み中…';
      try{const blob=await getAttachmentBlob(f);const url=URL.createObjectURL(blob);const img=document.createElement('img');img.className='attached-image';img.alt=`${f.name} の画像`;img.src=url;img.onload=()=>URL.revokeObjectURL(url);img.onerror=()=>URL.revokeObjectURL(url);preview.replaceWith(img);}
      catch(e){console.error(e);notify('画像を読み込めませんでした');preview.disabled=false;preview.textContent='画像を表示';}
    });container.append(preview);
  }
  if(f.kind==='inline' && f.mime?.startsWith('image/') && typeof f.data==='string'){
    const img=document.createElement('img');img.className='attached-image';img.alt=`${f.name} の画像`;img.loading='lazy';img.src=`data:${f.mime};base64,${f.data}`;container.append(img);
  }
}
function downloadBlob(blob,name) {const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=String(name||'file').replace(/[\\/\x00-\x1f]/g,'_');document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function bytesToBase64(bytes){
  let raw='';for(let i=0;i<bytes.length;i+=32768)raw+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return btoa(raw);
}
function base64ToBytes(data){
  const raw=atob(data);const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return bytes;
}
async function getAttachmentBlob(f){
  if(f.kind==='inline')return new Blob([base64ToBytes(f.data||'')],{type:f.mime||'application/octet-stream'});
  if(f.kind==='storage'){
    if(!firebase?.storage)throw new Error('Storageが設定されていません。');
    return firebase.st.getBlob(firebase.st.ref(firebase.storage,f.path),STORAGE_MAX);
  }
  if(f.kind==='chunks'){
    if(!firebase)throw new Error('Firebaseが利用できません');
    if(!Number.isInteger(f.chunks)||f.chunks<1||f.chunks>32)throw new Error('不正なファイル情報です');
    const {db,fs}=firebase;const parts=[];let total=0;
    for(let i=0;i<f.chunks;i+=6){
      const indexes=Array.from({length:Math.min(6,f.chunks-i)},(_,k)=>i+k);
      const docs=await Promise.all(indexes.map(n=>fs.getDoc(fs.doc(db,'rooms',currentRoom,'files',f.fileId,'chunks',String(n).padStart(4,'0')))));
      for(const doc of docs){if(!doc.exists())throw new Error('ファイルの一部が見つかりません');const bytes=base64ToBytes(doc.data().data);total+=bytes.length;parts.push(bytes);}
    }
    if(total!==f.bytes)throw new Error('ファイルサイズが一致しません');
    return new Blob(parts,{type:f.mime||'application/octet-stream'});
  }
  throw new Error('不明な添付方式です');
}
async function downloadAttachment(f){
  try { const blob=await getAttachmentBlob(f); downloadBlob(blob,f.name); }
  catch(error){console.error(error);notify('ダウンロードできません。接続とFirestoreのルールを確認してください。');}
}
async function uploadChunkedFile({file,mime,code,baseMessage}){
  const {fs,db}=firebase;
  const allBytes=new Uint8Array(await file.arrayBuffer());
  const fileId=generateCode(),chunks=Math.ceil(allBytes.length/CHUNK_BYTES);
  const fileName=file.name.slice(0,120);
  const fileRef=fs.doc(db,'rooms',code,'files',fileId);
  await fs.setDoc(fileRef,{uid:currentUid,name:fileName,mime,bytes:file.size,chunks,ready:false,createdAt:fs.serverTimestamp()});
  try{
    for(let i=0;i<chunks;i+=4){
      const indexes=Array.from({length:Math.min(4,chunks-i)},(_,k)=>i+k);
      await Promise.all(indexes.map(n=>{
        const data=bytesToBase64(allBytes.subarray(n*CHUNK_BYTES,Math.min((n+1)*CHUNK_BYTES,allBytes.length)));
        return fs.setDoc(fs.doc(db,'rooms',code,'files',fileId,'chunks',String(n).padStart(4,'0')),{index:n,data});
      }));
      $('upload-status').hidden=false;$('upload-status').textContent=`ファイルを送信中… ${Math.min(i+4,chunks)} / ${chunks} パート`;
    }
    await fs.updateDoc(fileRef,{ready:true});
    await fs.addDoc(fs.collection(db,'rooms',code,'messages'),{...baseMessage,file:{kind:'chunks',fileId,name:fileName,mime,bytes:file.size,chunks}});
  }catch(error){
    // 送信失敗時にできる限り分割データを片付ける（ネット切断中などは残る場合あり）。
    try{
      for(let i=0;i<chunks;i+=8){
        await Promise.all(Array.from({length:Math.min(8,chunks-i)},(_,k)=>i+k).map(n=>fs.deleteDoc(fs.doc(db,'rooms',code,'files',fileId,'chunks',String(n).padStart(4,'0'))).catch(()=>{})));
      }
      await fs.deleteDoc(fileRef);
    }catch(e){console.warn('未完了アップロードの片付けに失敗:',e);}
    throw error;
  }finally{$('upload-status').hidden=true;}
}

async function react(messageId,emoji){
  if(!EMOJIS.includes(emoji)||!currentRoom)return;
  const old=reactionRecords.find(r=>r.messageId===messageId&&r.uid===currentUid);
  const code=currentRoom;
  if(mode==='demo'){
    const d=getLocal();d.reactions[code] ||= {};const id=`${messageId}_${currentUid}`;
    if(old?.emoji===emoji)delete d.reactions[code][id];else d.reactions[code][id]={uid:currentUid,messageId,emoji,createdAt:old?.createdAt||Date.now()};
    if(writeLocal(d))subscribeRoom();return;
  }
  try {
    const {fs,db}=firebase;const ref=fs.doc(db,'rooms',code,'reactions',`${messageId}_${currentUid}`);
    if(old?.emoji===emoji)await fs.deleteDoc(ref);
    else if(old)await fs.updateDoc(ref,{emoji});
    else await fs.setDoc(ref,{uid:currentUid,messageId,emoji,createdAt:fs.serverTimestamp()});
  }catch(error){console.error(error);notify('リアクションを付けられませんでした。');}
}
async function deleteMessage(message){
  if(!confirm('このメッセージを削除しますか？'))return;
  const code=currentRoom;
  try{
    if(mode==='demo'){
      const d=getLocal();d.messages[code]=(d.messages[code]||[]).filter(m=>m.id!==message.id||m.uid!==currentUid);
      const r=d.reactions[code]||{};for(const id of Object.keys(r))if(r[id].messageId===message.id)delete r[id];
      if(writeLocal(d))subscribeRoom();
    }else{
      const {fs,db}=firebase;
      if(message.file?.kind==='storage' && firebase.storage){await firebase.st.deleteObject(firebase.st.ref(firebase.storage,message.file.path));}
      if(message.file?.kind==='chunks'){
        const f=message.file;
        for(let i=0;i<f.chunks;i+=8)await Promise.all(Array.from({length:Math.min(8,f.chunks-i)},(_,k)=>i+k).map(n=>fs.deleteDoc(fs.doc(db,'rooms',code,'files',f.fileId,'chunks',String(n).padStart(4,'0'))).catch(()=>{})));
        await fs.deleteDoc(fs.doc(db,'rooms',code,'files',f.fileId));
      }
      // Remove reactions first (the message owner is authorized to remove its reactions).
      const related=reactionRecords.filter(r=>r.messageId===message.id);
      for(const r of related){await fs.deleteDoc(fs.doc(db,'rooms',code,'reactions',r.id));}
      await fs.deleteDoc(fs.doc(db,'rooms',code,'messages',message.id));
    }
    notify('メッセージを削除しました');
  }catch(error){console.error(error);notify('削除できませんでした。権限や接続を確認してください。');}
}
function detectMime(file){
  const ext=file.name.split('.').pop().toLowerCase();
  const expected=EXT_TO_MIME[ext];
  // Explicit extension AND type allowlist; prevents HTML, SVG and executables.
  if(!expected)return null;
  if(file.type && file.type!==expected && !(ext==='zip'&&file.type==='application/x-zip-compressed') && !(ext==='csv'&&file.type==='application/vnd.ms-excel'))return null;
  return expected;
}
function previewFile(file){selectedFile=file;$('file-preview').hidden=!file;
  $('file-preview-name').textContent=file?`📎 ${file.name}（${formatBytes(file.size)}）`:'';
  $('file-input').value='';
}
async function fileBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(r.error);r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.readAsDataURL(file);});}
async function sendMessage(event){
  event.preventDefault();if(sending||!currentRoom)return;
  const text=$('message-input').value.trim();const file=selectedFile;
  if(!text&&!file){notify('メッセージを入力するか、ファイルを添付してください。');return;}
  if(text.length>2000){notify('メッセージは2000文字までです。');return;}
  const mime=file&&detectMime(file);
  if(file&&(!mime||file.size===0)){notify('送信できるのは画像・PDF・テキスト・CSV・ZIP・Officeファイルです。空のファイルは送れません。');return;}
  const maxFileBytes=mode==='demo'?INLINE_MAX:(uploadEnabled?STORAGE_MAX:FIRESTORE_FILE_MAX);
  if(file&&file.size>maxFileBytes){
    notify(mode==='demo'?'デモモードの添付は256KBまでです。':uploadEnabled?'ファイルは最大8MBです。':'無料プランの添付は最大3MBです。');return;
  }
  const code=currentRoom;sending=true;$('send-button').disabled=true;$('attach-button').disabled=true;
  try{
    await ensureReady();
    const data={uid:currentUid,name:nickname,text,createdAt:mode==='demo'?Date.now():firebase.fs.serverTimestamp()};
    if(file&&file.size<=INLINE_MAX)data.file={kind:'inline',name:file.name.slice(0,120),mime,bytes:file.size,data:await fileBase64(file)};
    if(mode==='demo'){
      const d=getLocal();d.messages[code] ||= [];
      d.messages[code].push({id:`msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,...data});
      d.messages[code]=d.messages[code].slice(-100);
      if(!writeLocal(d))return;
      if(currentRoom===code)subscribeRoom();
    }else{
      const {db,fs}=firebase;
      if(file&&file.size>INLINE_MAX&&file.size<=FIRESTORE_FILE_MAX){
        await uploadChunkedFile({file,mime,code,baseMessage:data});
      }else if(file&&file.size>FIRESTORE_FILE_MAX){
        const messageRef=fs.doc(fs.collection(db,'rooms',code,'messages'));
        const fileId=generateCode(),path=`rooms/${code}/${messageRef.id}/${fileId}`;
        data.file={kind:'storage',name:file.name.slice(0,120),mime,bytes:file.size,path};
        await fs.setDoc(messageRef,data);
        try{await firebase.st.uploadBytes(firebase.st.ref(firebase.storage,path),file,{contentType:mime});}
        catch(error){try{await fs.deleteDoc(messageRef);}catch{}throw error;}
      }else await fs.addDoc(fs.collection(db,'rooms',code,'messages'),data);
    }
    if($('message-input').value.trim()===text)$('message-input').value='';
    if(selectedFile===file)previewFile(null);
    updateCounter();scrollBottom();
  }catch(error){console.error('送信に失敗',error);notify('送信に失敗しました。Firestore/Storageのルールや接続を確認してください。');}
  finally{sending=false;$('send-button').disabled=false;$('attach-button').disabled=false;$('upload-status').hidden=true;}
}
function updateCounter(){const el=$('message-input');$('char-counter').textContent=`${el.value.length} / 2000`;el.style.height='auto';el.style.height=`${Math.min(el.scrollHeight,170)}px`;}
function toggleSearch(show){$('search-bar').hidden=!show;$('search-button').setAttribute('aria-expanded',String(show));if(show)$('search-input').focus();else{$('search-input').value='';renderMessages();}}
async function copyCode(){if(!currentRoom){notify('先にチャットを作成・参加してください');return;}await copyText(prettyCode(currentRoom));}
async function copyText(value){try{await navigator.clipboard.writeText(value);notify('招待コードをコピーしました！');}catch{notify('コピーできない場合はコードを長押ししてコピーしてください。');}}
function showRoomChoice(){if(!nickname){step('nickname');return;}toChoice();closeMenu();}
async function initFirebase(){
  mode='cloud';setStatus('接続中');
  const SDK='https://www.gstatic.com/firebasejs/12.4.0/';
  try{
    const [app,auth,fs,st]=await Promise.all([import(`${SDK}firebase-app.js`),import(`${SDK}firebase-auth.js`),import(`${SDK}firebase-firestore.js`),uploadEnabled?import(`${SDK}firebase-storage.js`):Promise.resolve(null)]);
    const firebaseApp=app.initializeApp(config);
    const authInstance=auth.getAuth(firebaseApp);
    const creds=await auth.signInAnonymously(authInstance);
    currentUid=creds.user.uid;
    firebase={db:fs.getFirestore(firebaseApp),fs,st,storage:st?st.getStorage(firebaseApp):null};
    updateProfile();setStatus('接続済み','connected');
  }catch(error){console.error('Firebase接続エラー',error);setStatus('接続エラー');onboardError('Firebaseに接続できません。匿名認証が有効か、設定とネット接続を確認してください。');}
}
function setupEvents(){
  $('welcome-start').addEventListener('click',()=>{if(nickname)$('onboard-nickname').value=nickname;step('nickname');});
  $('onboard-name-form').addEventListener('submit',e=>{e.preventDefault();const n=$('onboard-nickname').value.trim().slice(0,24);if(!n){onboardError('ニックネームを入力してください');return;}nickname=n;localStorage.setItem(NAME_KEY,nickname);updateProfile();toChoice();});
  document.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.back==='choice')toChoice();else step(b.dataset.back);}));
  $('choose-create').addEventListener('click',()=>step('create'));
  $('choose-join').addEventListener('click',()=>step('join'));
  $('create-room-form').addEventListener('submit',async e=>{e.preventDefault();const title=$('create-room-name').value.trim().slice(0,60);if(!title){onboardError('チャット名を入力してください');return;}const b=$('create-room-submit');b.disabled=true;clearOnboardError();try{await createRoom(title);}catch(err){console.error(err);onboardError('部屋を作れませんでした。Firebase接続・新しいFirestoreルールを確認してください。');}finally{b.disabled=false;}});
  $('join-room-form').addEventListener('submit',e=>{e.preventDefault();openRoomByCode($('join-code').value);});
  $('created-copy').addEventListener('click',copyCode);
  $('created-enter').addEventListener('click',showChat);
  $('add-room-button').addEventListener('click',showRoomChoice);
  $('invite-button').addEventListener('click',copyCode);
  $('info-copy').addEventListener('click',copyCode);
  $('message-form').addEventListener('submit',sendMessage);
  $('message-input').addEventListener('input',updateCounter);
  $('message-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();$('message-form').requestSubmit();}});
  $('attach-button').addEventListener('click',()=>$('file-input').click());
  $('file-input').addEventListener('change',()=>{const file=$('file-input').files[0];if(!file)return;const mime=detectMime(file);if(!mime){notify('画像・PDF・テキスト・CSV・ZIP・Officeファイルのみ送信できます。');$('file-input').value='';return;}const max=mode==='demo'?INLINE_MAX:(uploadEnabled?STORAGE_MAX:FIRESTORE_FILE_MAX);if(file.size===0||file.size>max){notify(mode==='demo'?'デモの添付は256KBまでです。':uploadEnabled?'8MB以下のファイルを選択してね。':'無料の添付は3MB以下です。');$('file-input').value='';return;}previewFile(file);});
  $('remove-file').addEventListener('click',()=>previewFile(null));
  $('open-menu').addEventListener('click',()=>{$('channel-panel').classList.add('open');$('mobile-backdrop').hidden=false;});
  $('close-menu').addEventListener('click',closeMenu);$('mobile-backdrop').addEventListener('click',closeMenu);
  $('search-button').addEventListener('click',()=>toggleSearch($('search-bar').hidden));$('close-search').addEventListener('click',()=>toggleSearch(false));
  $('search-input').addEventListener('input',()=>renderMessages());
  $('info-button').addEventListener('click',()=>showInfo(!$('info-panel').classList.contains('open')));$('close-info').addEventListener('click',()=>showInfo(false));
  $('theme-button').addEventListener('click',()=>setTheme(document.body.classList.contains('light')?'dark':'light'));
  $('welcome-theme-button').addEventListener('click',()=>setTheme(document.body.classList.contains('light')?'dark':'light'));
  $('edit-profile-button').addEventListener('click',()=>{$('nickname-input').value=nickname;$('profile-dialog').showModal();$('nickname-input').focus();});
  $('cancel-profile').addEventListener('click',()=>$('profile-dialog').close());
  $('profile-form').addEventListener('submit',e=>{e.preventDefault();const n=$('nickname-input').value.trim().slice(0,24);if(!n){notify('名前を入力してください');return;}nickname=n;localStorage.setItem(NAME_KEY,nickname);updateProfile();$('profile-dialog').close();notify('名前を更新しました');});
  window.addEventListener('storage',e=>{if(e.key===DEMO_KEY&&mode==='demo'&&currentRoom)subscribeRoom();if(e.key===HISTORY_KEY){joinedRooms=readRoomHistory();renderRoomButtons();renderSavedRooms();}});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();showInfo(false);}});
}
function init(){setupEvents();setTheme(localStorage.getItem(THEME_KEY)==='light'?'light':'dark');
  updateProfile();renderSavedRooms();renderRoomButtons();updateCounter();$('upload-info').textContent=mode==='demo'?'📎 デモは256KBまで':uploadEnabled?'📎 3MBまで無料枠／Storageなら8MBまで':'📎 Firestore無料枠で最大3MBまで';
  if(configured)readyPromise=initFirebase();else{$('demo-banner').hidden=false;setStatus('デモモード','demo');}
  $('upload-info').textContent=configured?(uploadEnabled?'📎 3MBまでFirestore／Storageなら8MBまで':'📎 Firestore無料枠で最大3MBまで'):'📎 デモは256KBまで';
  const incoming=new URLSearchParams(location.search).get('invite');if(incoming&&CODE_PATTERN.test(normalizedCode(incoming)))$('join-code').value=prettyCode(normalizedCode(incoming));
  step('welcome');
}
init();
