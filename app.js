// LinkRoom — vanilla JS + Firebase (任意)。ビルドツール不要。
const ROOMS = {
  general: { title: '雑談ルーム', description: '気軽におしゃべりしよう', intro: 'なんでも気軽に話してね。ここから会話が始まります。' },
  vrchat: { title: 'VRChat', description: 'VRの話、ワールドやアバターの話をしよう', intro: 'ワールドやアバターのこと、VRでの出来事を共有しよう！' },
  gaming: { title: 'ゲーム・趣味', description: '好きなゲームや趣味について話そう', intro: '最近ハマっているゲームや趣味について自由に話そう！' }
};
const DEMO_KEY = 'linkroom.demo.messages.v1';
const NAME_KEY = 'linkroom.nickname.v1';
const UID_KEY = 'linkroom.demo.uid.v1';
const THEME_KEY = 'linkroom.theme.v1';
const COLOR_POOL = ['#8d7fe0','#46a5b8','#d28883','#b28b4f','#8a9c59','#c47db9','#627aba'];
const $ = (id) => document.getElementById(id);

let currentRoom = 'general';
let nickname = (localStorage.getItem(NAME_KEY) || 'ゲスト').trim().slice(0, 24) || 'ゲスト';
let demoUid = localStorage.getItem(UID_KEY);
if (!demoUid) {
  demoUid = `local-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  localStorage.setItem(UID_KEY, demoUid);
}
let currentUid = demoUid;
let mode = 'demo';
let firebase = null;
let unsubscribe = null;
let latestMessages = [];
let isSending = false;
let toastTimeout;
let roomLoadNumber = 0;

const config = window.CHAT_FIREBASE_CONFIG || {};
const hasFirebaseConfig = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId && !config.apiKey.includes('ここに'));

function safeTime(message) {
  if (message.createdAt && typeof message.createdAt.toMillis === 'function') return message.createdAt.toMillis();
  if (typeof message.createdAt === 'number') return message.createdAt;
  return Date.now();
}
function localDateKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function formattedDate(ms) {
  const d = new Date(ms);
  const today = new Date();
  if (localDateKey(ms) === localDateKey(Date.now())) return '今日';
  if (localDateKey(ms) === localDateKey(Date.now() - 86400000)) return '昨日';
  return new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(d);
}
function formattedTime(ms) {
  return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
}
function colorFromString(value) {
  let total = 0;
  for (const char of String(value)) total = ((total * 31) + char.charCodeAt(0)) | 0;
  return COLOR_POOL[Math.abs(total) % COLOR_POOL.length];
}
function avatarLetter(name) { return [...String(name || '?')][0]?.toUpperCase() || '?'; }
function makeIcon(id) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}
function notify(message) {
  clearTimeout(toastTimeout);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 3300);
}
function showError(message = '') {
  $('error-banner').textContent = message;
  $('error-banner').hidden = !message;
}
function setConnection(text, kind) {
  $('connection-text').textContent = text;
  $('connection-status').className = `connection-status ${kind || ''}`;
}
function updateProfile() {
  $('my-name').textContent = nickname;
  $('my-avatar').textContent = avatarLetter(nickname);
  $('my-avatar').style.background = colorFromString(currentUid);
}
function setTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  localStorage.setItem(THEME_KEY, theme);
  $('theme-button').title = theme === 'light' ? 'ダークモードにする' : 'ライトモードにする';
}

function seedDemoIfNeeded() {
  if (localStorage.getItem(DEMO_KEY) !== null) return;
  const now = Date.now();
  const sample = {
    general: [
      { id: 'sample-1', uid: 'sample-mio', name: 'みお', text: 'みなさん、こんにちは！ 👋\n今日もよろしくお願いします！', createdAt: now - 3600000 },
      { id: 'sample-2', uid: 'sample-kai', name: 'カイ', text: 'こんにちは〜！ここ、いい雰囲気ですね ✨', createdAt: now - 3100000 },
      { id: 'sample-3', uid: 'sample-mio', name: 'みお', text: '新しいメンバーも大歓迎です！気軽に話しかけてね 💜', createdAt: now - 2800000 }
    ],
    vrchat: [
      { id: 'sample-4', uid: 'sample-kai', name: 'カイ', text: '最近おすすめのワールドある？🌎', createdAt: now - 4200000 },
      { id: 'sample-5', uid: 'sample-mio', name: 'みお', text: 'まったりできるカフェワールドが好き！', createdAt: now - 3600000 }
    ],
    gaming: [
      { id: 'sample-6', uid: 'sample-mio', name: 'みお', text: '今週末なにかゲームする？ 🎮', createdAt: now - 2800000 }
    ]
  };
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(sample)); } catch (error) { console.warn('デモデータを保存できません', error); }
}
function readDemo() {
  try {
    const data = JSON.parse(localStorage.getItem(DEMO_KEY) || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch { return {}; }
}
function writeDemo(data) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(data)); }
  catch { notify('保存できませんでした。ブラウザの保存設定を確認してください。'); }
}
function scrollToBottom() {
  requestAnimationFrame(() => { $('conversation').scrollTop = $('conversation').scrollHeight; });
}
function renderMessages({ scroll = false } = {}) {
  const container = $('messages');
  const currentSearch = $('search-input').value.trim().toLocaleLowerCase();
  const visible = latestMessages.filter((m) =>
    !currentSearch || `${m.name} ${m.text}`.toLocaleLowerCase().includes(currentSearch)
  );
  const box = $('conversation');
  const shouldScroll = scroll || box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  const fragment = document.createDocumentFragment();
  let lastDay = '';

  for (const message of visible) {
    const timestamp = safeTime(message);
    const day = localDateKey(timestamp);
    if (day !== lastDay) {
      const divider = document.createElement('div');
      divider.className = 'date-divider';
      divider.textContent = formattedDate(timestamp);
      fragment.append(divider);
      lastDay = day;
    }
    const row = document.createElement('article');
    row.className = 'message-row';
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.style.backgroundColor = colorFromString(message.uid || message.name);
    avatar.textContent = avatarLetter(message.name);
    const content = document.createElement('div');
    content.className = 'message-content';
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    const name = document.createElement('strong');
    name.className = 'message-name';
    name.textContent = message.name || 'ゲスト';
    meta.append(name);
    if (message.uid === currentUid) {
      const ownTag = document.createElement('span');
      ownTag.className = 'own-tag';
      ownTag.textContent = '自分';
      meta.append(ownTag);
    }
    const time = document.createElement('time');
    time.className = 'message-time';
    time.textContent = formattedTime(timestamp);
    time.dateTime = new Date(timestamp).toISOString();
    meta.append(time);
    const text = document.createElement('div');
    text.className = 'message-text';
    text.textContent = message.text || '';
    content.append(meta, text);
    row.append(avatar, content);
    if (message.uid === currentUid) {
      const del = document.createElement('button');
      del.className = 'delete-message';
      del.type = 'button';
      del.title = 'このメッセージを削除';
      del.setAttribute('aria-label', 'このメッセージを削除');
      del.append(makeIcon('i-trash'));
      del.addEventListener('click', () => deleteMessage(message.id));
      row.append(del);
    }
    fragment.append(row);
  }
  container.replaceChildren(fragment);
  $('empty-state').hidden = visible.length > 0 || Boolean(currentSearch);
  if (currentSearch && visible.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'search-no-results';
    msg.textContent = '検索に一致するメッセージはありません。';
    container.append(msg);
  }
  if (shouldScroll) scrollToBottom();
}
function closeMobileMenu() {
  $('channel-panel').classList.remove('open');
  $('mobile-backdrop').hidden = true;
}
function updateRoomUI() {
  const room = ROOMS[currentRoom];
  $('room-title').textContent = room.title;
  $('room-subtitle').textContent = room.description;
  $('intro-title').textContent = `${room.title}へようこそ！`;
  $('intro-description').textContent = room.intro;
  $('composer-channel').textContent = `# ${room.title}`;
  $('info-room').textContent = `# ${room.title}`;
  $('info-description').textContent = room.description;
  document.querySelectorAll('[data-room]').forEach((btn) => {
    const active = btn.dataset.room === currentRoom;
    btn.classList.toggle('active', active);
    if (active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
    btn.querySelector('.channel-live-dot')?.remove();
    if (active) {
      const dot = document.createElement('span');
      dot.className = 'channel-live-dot';
      btn.append(dot);
    }
  });
}
function subscribeRoom() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  const loadId = ++roomLoadNumber;
  latestMessages = [];
  renderMessages({ scroll: true });
  if (mode === 'demo') {
    latestMessages = (readDemo()[currentRoom] || []).slice(-100).sort((a,b) => safeTime(a) - safeTime(b));
    renderMessages({ scroll: true });
    return;
  }
  if (!firebase) return;
  setConnection('読み込み中', '');
  const { db, fs } = firebase;
  const q = fs.query(fs.collection(db, 'rooms', currentRoom, 'messages'), fs.orderBy('createdAt', 'desc'), fs.limit(100));
  unsubscribe = fs.onSnapshot(q, (snapshot) => {
    if (loadId !== roomLoadNumber) return;
    latestMessages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).reverse();
    renderMessages({ scroll: false });
    setConnection('リアルタイム', 'connected');
    showError('');
  }, (error) => {
    if (loadId !== roomLoadNumber) return;
    console.error('受信エラー:', error);
    setConnection('受信エラー', '');
    showError('読み込みに失敗しました。Firestore のルール、Authentication の設定、ネット接続を確認してください。');
  });
}
function switchRoom(roomId) {
  if (!ROOMS[roomId] || roomId === currentRoom) { closeMobileMenu(); return; }
  currentRoom = roomId;
  $('search-input').value = '';
  $('search-bar').hidden = true;
  $('search-button').setAttribute('aria-expanded', 'false');
  updateRoomUI();
  subscribeRoom();
  closeMobileMenu();
}
async function deleteMessage(id) {
  if (!confirm('このメッセージを削除しますか？')) return;
  const roomAtClick = currentRoom;
  if (mode === 'demo') {
    const data = readDemo();
    data[roomAtClick] = (data[roomAtClick] || []).filter((m) => !(m.id === id && m.uid === currentUid));
    writeDemo(data);
    subscribeRoom();
    notify('メッセージを削除しました');
    return;
  }
  if (!firebase) return;
  try {
    await firebase.fs.deleteDoc(firebase.fs.doc(firebase.db, 'rooms', roomAtClick, 'messages', id));
    notify('メッセージを削除しました');
  } catch (error) {
    console.error(error);
    notify('削除できませんでした。接続や権限を確認してください。');
  }
}
async function sendMessage(event) {
  event.preventDefault();
  const content = $('message-input').value.trim();
  if (!content || isSending) return;
  if (content.length > 2000) { notify('メッセージは2000文字以内にしてください'); return; }
  if (mode === 'cloud' && !firebase) { notify('接続準備中です。少ししてから送信してください。'); return; }
  const roomAtSend = currentRoom;
  isSending = true;
  $('send-button').disabled = true;
  try {
    if (mode === 'demo') {
      const data = readDemo();
      if (!data[roomAtSend]) data[roomAtSend] = [];
      data[roomAtSend].push({ id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`, uid: currentUid, name: nickname, text: content, createdAt: Date.now() });
      data[roomAtSend] = data[roomAtSend].slice(-100);
      writeDemo(data);
      if (currentRoom === roomAtSend) subscribeRoom();
    } else {
      await firebase.fs.addDoc(firebase.fs.collection(firebase.db, 'rooms', roomAtSend, 'messages'), {
        uid: currentUid, name: nickname, text: content, createdAt: firebase.fs.serverTimestamp()
      });
    }
    // 送信中に書き足されていた場合は入力内容を消さない。
    if ($('message-input').value.trim() === content) $('message-input').value = '';
    updateCounter();
    scrollToBottom();
  } catch (error) {
    console.error('送信エラー:', error);
    notify('送信できませんでした。ネット接続またはFirestoreのルールを確認してね。');
  } finally {
    isSending = false;
    $('send-button').disabled = false;
    $('message-input').focus();
  }
}
function updateCounter() {
  const textarea = $('message-input');
  $('char-counter').textContent = `${textarea.value.length} / 2000`;
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 170)}px`;
}
function toggleSearch(show) {
  $('search-bar').hidden = !show;
  $('search-button').setAttribute('aria-expanded', String(show));
  if (show) $('search-input').focus();
  else { $('search-input').value = ''; renderMessages(); }
}
function setInfo(open) {
  $('info-panel').classList.toggle('open', open);
  $('info-button').setAttribute('aria-expanded', String(open));
}
async function startFirebase() {
  // 認証が終わるまで送信できないようにする（デモとの混同防止）。
  mode = 'cloud';
  $('message-input').disabled = true;
  $('send-button').disabled = true;
  setConnection('接続中', '');
  $('demo-banner').hidden = true;
  // 固定バージョンを使用（バンドラ不要）。更新時は3つすべて同じバージョンに。
  const SDK = 'https://www.gstatic.com/firebasejs/12.4.0/';
  try {
    const [app, auth, fs] = await Promise.all([
      import(`${SDK}firebase-app.js`),
      import(`${SDK}firebase-auth.js`),
      import(`${SDK}firebase-firestore.js`)
    ]);
    const firebaseApp = app.initializeApp(config);
    const authInstance = auth.getAuth(firebaseApp);
    const userCredential = await auth.signInAnonymously(authInstance);
    currentUid = userCredential.user.uid;
    firebase = { db: fs.getFirestore(firebaseApp), fs };
    mode = 'cloud';
    updateProfile();
    $('message-input').disabled = false;
    $('send-button').disabled = false;
    setConnection('リアルタイム', 'connected');
    subscribeRoom();
  } catch (error) {
    console.error('Firebase 初期化エラー:', error);
    // クラウド設定がある場合はデモに自動切替しない。送信先の誤認を防ぐ。
    mode = 'cloud';
    setConnection('接続エラー', '');
    showError('Firebaseへの接続に失敗しました。Firebase設定、匿名認証の有効化、許可ドメイン、ネット接続を確認してください。');
    $('send-button').disabled = true;
    $('message-input').disabled = true;
    $('message-input').placeholder = 'Firebaseへの接続を確認してください';
  }
}

function setupEvents() {
  document.querySelectorAll('[data-room]').forEach((btn) => btn.addEventListener('click', () => switchRoom(btn.dataset.room)));
  $('message-form').addEventListener('submit', sendMessage);
  $('message-input').addEventListener('input', updateCounter);
  $('message-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      $('message-form').requestSubmit();
    }
  });
  $('open-menu').addEventListener('click', () => { $('channel-panel').classList.add('open'); $('mobile-backdrop').hidden = false; });
  $('close-menu').addEventListener('click', closeMobileMenu);
  $('mobile-backdrop').addEventListener('click', closeMobileMenu);
  $('search-button').addEventListener('click', () => toggleSearch($('search-bar').hidden));
  $('close-search').addEventListener('click', () => toggleSearch(false));
  $('search-input').addEventListener('input', () => renderMessages());
  $('info-button').addEventListener('click', () => setInfo(!$('info-panel').classList.contains('open')));
  $('close-info').addEventListener('click', () => setInfo(false));
  $('theme-button').addEventListener('click', () => setTheme(document.body.classList.contains('light') ? 'dark' : 'light'));
  $('edit-profile-button').addEventListener('click', () => {
    $('nickname-input').value = nickname;
    $('profile-dialog').showModal();
    $('nickname-input').focus();
  });
  $('cancel-profile').addEventListener('click', () => $('profile-dialog').close());
  $('profile-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const newName = $('nickname-input').value.trim().slice(0, 24);
    if (!newName) { notify('名前を入力してください'); return; }
    nickname = newName;
    localStorage.setItem(NAME_KEY, nickname);
    updateProfile();
    $('profile-dialog').close();
    notify('表示名を変更しました！');
  });
  $('invite-button').addEventListener('click', async () => {
    if (mode === 'demo') notify('デモは端末内だけです。共有チャットにはFirebase設定が必要です。');
    try {
      await navigator.clipboard.writeText(location.href.split('#')[0]);
      notify('サイトのURLをコピーしました！');
    } catch { notify('URLをコピーできませんでした。ブラウザのURL欄からコピーしてください。'); }
  });
  window.addEventListener('storage', (event) => {
    if (event.key === DEMO_KEY && mode === 'demo') subscribeRoom();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { closeMobileMenu(); setInfo(false); }
  });
}

function init() {
  setupEvents();
  setTheme(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');
  updateProfile();
  updateRoomUI();
  updateCounter();
  if (hasFirebaseConfig) startFirebase();
  else {
    seedDemoIfNeeded();
    $('demo-banner').hidden = false;
    setConnection('デモモード', 'demo');
    subscribeRoom();
  }
}
init();
