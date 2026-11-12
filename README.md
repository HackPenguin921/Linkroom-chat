# LinkRoom — Discord風のチャットサイト

VS Code と GitHub Pages で使える、スマホ・PC対応のチャットサイトです。HTML / CSS / JavaScript で構築しています。

## 機能
- Discord風のレスポンシブなダークUI（ライトモードもあり）
- 3つの部屋：雑談 / VRChat / ゲーム・趣味
- テキスト投稿、Enterで送信・Shift+Enterで改行、日本語IME対応
- 表示名の変更、自分の投稿の削除、最新100件の検索
- **Firebase 設定後**：別々のスマホ・PCから、リアルタイムにメッセージを共有
- **Firebase 未設定**：そのブラウザ内だけで保存されるデモモード

> **注意**：これは初学者向けの公開チャットのひな形です。ログイン必須のプライベートサーバー、DM、音声通話、ファイル添付、既読、オンライン人数、通報・BAN、スパム対策は未実装です。Firebaseは匿名認証のため、URLを知っていれば基本的に誰でも参加できます。本格公開時は参加制限やモデレーションが必要です。

## 1. VS Codeで動かす（デモ）

1. フォルダ `discord_style_chat` を VS Code で開きます。
2. VS Code の拡張機能 **Live Server**（Ritwick Dey）をインストールします。
3. `index.html` を右クリックし **Open with Live Server** を選びます。
4. チャットできます。投稿はブラウザの localStorage に保存されます（**他の端末には届きません**）。

**必ず Live Server などのローカルWebサーバーから開いてください。** `file://` で直接開くと、ブラウザが JavaScript モジュールをブロックすることがあります。

## 2. Firebaseで本物のリアルタイムチャットにする

1. https://console.firebase.google.com/ で **プロジェクトを追加**。
2. **プロジェクトの設定 → マイアプリ → ウェブアプリ（`</>`）** を登録します。表示される `firebaseConfig` の値を確認します。
3. このフォルダの `firebase-config.js` を開いて、`apiKey`, `authDomain`, `projectId`, `appId` に実際の値を入れて保存します（必要なら `messagingSenderId` や `storageBucket` も追加可）。
4. Firebaseコンソールの **Authentication → Sign-in method** で **匿名（Anonymous）** を有効にします。
5. Firebaseコンソールの **Firestore Database** でデータベースを作成します（初期の試用では無料枠を利用できる構成を選択）。リージョンは後から簡単に変えられないので選択に注意してください。
6. **Firestore Database → ルール（Rules）** に `firestore.rules` の内容を**すべて**貼り、**公開（Publish）**します。テストモードの全開放ルールをそのまま公開しないでください。
7. 認証画面で、必要に応じて **Settings → Authorized domains** に公開ドメインを追加してください。最近のFirebaseプロジェクトでは localhost が自動追加されない場合があります。
8. ブラウザを更新して、右上が **リアルタイム** になればOK！別の端末も同じURLにアクセスするとメッセージを共有できます。

Firestore の保存先は `rooms/{roomId}/messages/{messageId}` です。チャンネルIDは `general`, `vrchat`, `gaming` の3種類です。

### Firebase設定の例（実値ではありません）

```js
window.CHAT_FIREBASE_CONFIG = {
  apiKey: "AIzaxxxxxxxxxxxxxxxxx",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  appId: "1:123456789:web:abcdefgh"
};
```

FirebaseのWeb用設定情報は通常、公開クライアントに含めて構いません。ただし**Firebaseのセキュリティルールは必須**です。サービスアカウントのJSONや秘密鍵は絶対にGitHubへ公開しないでください。

## 3. GitHub Pagesで公開する

1. GitHubで新しいリポジトリ（例：`linkroom-chat`）を作成します。
2. このフォルダのファイルをリポジトリのルートにアップロード / push します（`index.html` は最上位に置きます）。
3. リポジトリの **Settings → Pages → Build and deployment** で **Deploy from a branch** を選択し、`main` / `/(root)` → **Save**。
4. 公開URL例：`https://<あなたのユーザー名>.github.io/linkroom-chat/`
5. Firebaseの Authentication に許可ドメイン設定が必要な場合、`<あなたのユーザー名>.github.io` を追加してください（URLパスは含めません）。

> VS Codeのターミナルから Git を使う場合：
>
> ```bash
> git init
> git add .
> git commit -m "Create LinkRoom chat"
> git branch -M main
> git remote add origin https://github.com/USER/linkroom-chat.git
> git push -u origin main
> ```
> `USER` は自分のGitHubユーザー名に置き換え、先に空のリポジトリを作ってください。

## 4. デザイン・部屋を変える

- 色・サイズ・スマホ表示：`styles.css`
- 文章・部屋の見た目：`index.html`
- 部屋の名前・説明：`app.js` 冒頭の `ROOMS`
- 部屋の追加は `ROOMS` だけでなく `index.html` の `[data-room]` ボタンと `firestore.rules` の `validRoom()` にも追加してください。

## よくあるエラー

- **デモモードのまま**：`firebase-config.js` の4項目が空欄です。Firebase設定を埋めて更新してください。
- **接続エラー**：匿名認証の有効化、設定の値、インターネット接続を確認してください。
- **Missing or insufficient permissions**：Firestore の `firestore.rules` が未公開か、ルールが一致していない可能性があります。
- **他端末と共有されない**：両端末が同じFirebaseプロジェクトに接続し、右上が「リアルタイム」か確かめてください。
- **投稿が増えて課金**：Firestore には読み書きなどの利用枠・上限があります。Firebaseの利用量と請求設定を確認してください。

## セキュリティ上の制限

匿名認証は、利用者本人確認ではありません。名前も自由に変えられます。このひな形は**一般公開の参加制限つきチャットではありません**。利用を限定したい場合は、Googleログインなどのアカウント認証と Firestore のアクセス制御を追加してください。連投制限、NGワード、管理者削除、通報、App Check などは別途設計が必要です。メッセージは参加できるユーザーなら閲覧できます。個人情報や秘密の会話は投稿しないでください。

## 公式ドキュメント

- Firebase 匿名認証：https://firebase.google.com/docs/auth/web/anonymous-auth
- Firestore リアルタイム更新：https://firebase.google.com/docs/firestore/query-data/listen
- Firestore セキュリティルール：https://firebase.google.com/docs/firestore/security/get-started
- GitHub Pages：https://docs.github.com/ja/pages/getting-started-with-github-pages/creating-a-github-pages-site
