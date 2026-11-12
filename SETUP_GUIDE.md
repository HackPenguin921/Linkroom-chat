# LinkRoom Ver.2.1 設定・更新説明書

> 初めてFirebaseを使う場合も、旧版のLinkRoomから更新する場合も、この順番で作業してください。

## 1. VS Codeで開く

1. 配布ZIPを解凍し、`discord_style_chat` フォルダを VS Code で開きます。
2. VS Code に **Live Server** 拡張機能を入れます。
3. `index.html` を右クリックして **Open with Live Server**。
4. ホーム画面が出て、「始める」→ ニックネーム → 部屋作成を試せればOKです。

**注意：** Firebase未設定のときは「デモモード」です。**他のスマホ・PCからは同じ部屋に入れません**。画面操作を試す専用です。

## 2. 既に動いているLinkRoomから更新する場合

**公開中のファイルをバックアップしてから実施してください。**

1. GitHubの既存リポジトリの内容をバックアップします。
2. 新しいZIPの `index.html`、`styles.css`、`v2.css`、`app.js`、`firestore.rules`、`storage.rules`、`.nojekyll`、説明書を入れます。
3. **あなたが使っている旧版の`firebase-config.js`を優先して残す**のが簡単です。新しいファイルに置き換えた場合は、旧ファイルの`apiKey`、`authDomain`、`projectId`、`appId`の値を転記してください。
4. 既存のFirebaseプロジェクトをそのまま再利用できます。匿名認証を最初から設定し直す必要はありません。
5. **新しい `firestore.rules` をFirebase Consoleへ貼り直して公開**してください。古いルールのままでは部屋作成・参加・メッセージ送信ができません。
6. ブラウザで `Ctrl + Shift + R` を押して再読み込みします（スマホはページ再読み込み）。

※ 旧版の雑談・VRChat・ゲームの**公開チャンネルの投稿は自動で移行しません**。新しい招待制部屋は別データとして作成します。

## 3. Firebaseプロジェクトの準備（新規作成の場合）

1. [Firebase Console](https://console.firebase.google.com/)にアクセスします。
2. 「プロジェクトを追加」→ 任意の名前（例：`linkroom-chat`）で作成。
3. **Spark（無料）** プランのまま進めます。
4. 「プロジェクトの設定」→「マイアプリ」→ `</>`（ウェブアプリ）を登録。
5. 「SDK の設定と構成」で表示される `firebaseConfig` の値を控えます。
6. ZIPに含まれる `firebase-config.js` の以下の4つに貼り付けます。

```javascript
window.CHAT_FIREBASE_CONFIG = {
  apiKey: "Firebaseで表示された値",
  authDomain: "プロジェクトID.firebaseapp.com",
  projectId: "プロジェクトID",
  appId: "Firebaseで表示された値",
  storageBucket: "" // 無料プランなら空でOK
};
window.CHAT_ENABLE_STORAGE_UPLOADS = false;
```

**`firebase-config.js`は公開されるファイルです。** FirebaseのWeb APIキー自体は公開用識別子ですが、アクセスを保護するため必ずFirestoreセキュリティルールを設定してください。サービスアカウントの秘密鍵などは絶対に入れません。

## 4. 匿名認証を有効にする

1. Firebase Console → 左メニュー「Authentication」→「始める」。
2. 「Sign-in method」→「匿名」→ **有効にする** → 保存。
3. メールアドレス登録なしで一人ずつFirebaseのUIDが発行されます。

## 5. Firestoreデータベースを作る

1. Firebase Console →「Firestore Database」→「データベースを作成」。
2. 任意の近いリージョンを選びます（作成後は変更しにくいため確認してください）。
3. 作成後「ルール」タブを開きます。
4. ZIP同梱の **`firestore.rules` の内容全体**をコピーして貼り付け、「公開」を押します。
5. `allow read, write: if true;` のような公開ルールは絶対に使わないでください。

**とても重要：** ルールが旧版のままだと、新しい24文字の招待制ルームへアクセスできません。GitHubに`firestore.rules`を置くだけでは反映されず、**Firebase Console上でも公開する必要があります**。

Firestoreのルールでは、部屋を24文字の予測困難なコードで識別し、メッセージと添付ファイルの読み取りを**部屋のメンバー登録後のみ**許可しています。コードを知らない人が部屋一覧を取得する操作も禁止しています。

## 6. 送受信テスト

1. VS CodeのLive Serverで`index.html`を開きます。上部のステータスが「Firebase: 接続済み」になっていることを確認します。
2. 「始める」→ニックネーム入力→「新しいチャットを作る」。
3. チャット名（例：`VRChatの友達`）を入力し「チャットを作成する」。
4. **招待コード（24文字、ハイフン区切り表示）**が発行されます。「コードをコピー」を押します。
5. スマホでGitHub PagesのURLを開き、「始める」→名前→「招待コードで参加する」からコードを入力します。
6. スマホで送ったメッセージがパソコンにも表示されたら成功！
7. メッセージ下の「☺ ＋」で絵文字を付けます。**別の絵文字を選べば変更、同じ絵文字を押せば取り消し**です。
8. クリップのボタンからPNGなどの小さなファイルを選んで送信し、別端末で「保存」が機能するか確認します。
9. ライト／ダークの切り替えも試しましょう。

### ファイル添付の制限

- Firebase Spark（無料）：**最大3 MiB（約3.1 MB）**。256 KiBまで直接保存、それより大きいファイルはFirestoreで約96KiBずつ分割して送信します。
- 対応：PNG、JPG/JPEG、WEBP、GIF、PDF、TXT、CSV、ZIP、DOCX、XLSX、PPTX。
- ファイルを大量に送るとFirestoreの**データ保存容量・読み書き・通信量**を消費します。少人数向けです。
- デモモードだけはブラウザ保存容量の都合で**256 KiB**まで。
- **任意**：Blazeプラン + Firebase Storageを用意し`storageBucket`を設定、`storage.rules`をCloud Storageの「ルール」に公開して`window.CHAT_ENABLE_STORAGE_UPLOADS = true`にすると8 MiBまで利用できます（3 MiBを超えるファイルをStorageへ保存）。**従量課金に注意**してください。

Cloud Storage for Firebaseは**2026年2月3日以降Blazeプラン必須**です。無料で使いたい場合、Storageは設定しないでください。

## 7. GitHub Pagesへ公開

1. GitHubで新規リポジトリを作るか、既存リポジトリを開きます。
2. `index.html` などファイル一式をリポジトリのルートに配置し、コミット・プッシュします。ZIPの外側フォルダごと置いてしまわないようにしてください。
3. GitHub → リポジトリ **Settings → Pages** を開きます。
4. **Build and deployment → Deploy from a branch**、ブランチ `main`、フォルダ `/(root)` を指定します。
5. 表示された公開URL（例：`https://ユーザー名.github.io/リポジトリ名/`）をスマホ・友達へ送ります。
6. GitHub PagesのURLで初めからチャット作成〜招待〜リアクションまで再テストしてください。

GitHub PagesはHTTPSなので、ファイルコピーやFirebase認証を利用できます。サイトは公開URLから誰でも**開くこと自体はできます**が、個別の部屋の中身は招待コードとメンバー登録で保護します。

## 8. よくあるトラブル

| 現象 | 確認箇所 |
| --- | --- |
| 「デモモード」と表示される | `firebase-config.js` の4項目が空ではないか、正しいファイルを公開したか |
| Firebase接続エラー | Authenticationの「匿名」が有効か、SDK設定値・ネット接続を確認 |
| 部屋を作れない／参加できない | **新しい `firestore.rules` をConsoleに公開したか**を確認 |
| スマホから招待コードで参加できない | Firebase設定済みか、コードの入力誤りがないかを確認。デモは別端末で共有不可 |
| 画像やファイルを送れない | ファイル形式と上限3 MiBを確認。Firestoreルールを最新版にする |
| 既存投稿が表示されない | 旧版の公開チャンネルは新しい招待制ルームへ移行しない仕様 |
| 更新したのに以前のページが表示される | GitHub Pagesの公開状態を確認し、強制再読み込み（Ctrl+Shift+R） |
| リアクションができない | 新しいリアクション用ルールが公開されているか確認 |
| 別ブラウザで以前の部屋が出ない | 参加履歴はブラウザ単位。もう一度招待コードを入力する |

## 9. 安全に使うために

- **招待コードはパスワードの代わりになる合言葉です**。知らない人に公開しないでください。
- コードを入手した人は、誰でも匿名認証で参加できます。現在、**参加承認・追放・コード再発行・有効期限設定はありません**。
- Firestoreが認可していても、エンドツーエンド暗号化ではありません。
- 非公開の個人情報、重要文書は送らないでください。ファイルは受け取る前に送信者を確認しましょう。
- 匿名認証を消す、ブラウザのサイトデータを削除するなどでUIDが変わると、同じ端末でも再入室にコードが必要になります。

---

参考：[Firebase Console](https://console.firebase.google.com/) ／ [Firestore制限](https://firebase.google.com/docs/firestore/quotas?hl=ja) ／ [Storage Blaze要件](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024) ／ [GitHub Pages](https://docs.github.com/ja/pages)
