# LinkRoom Ver.2.1 — 招待コード制・リアルタイムチャット

スマホとパソコンに対応した、Discord風のチャットサイトです。**GitHub Pages + Firebase Authentication + Cloud Firestore**で利用できます。HTML/CSS/JavaScriptのみなのでビルドは不要です。

## 新機能

- ウェルカムページ → 「始める」→ ニックネーム設定 → 部屋の新規作成／招待コードで参加
- チャット名を付けると、推測しづらい24文字の英数字の招待コードを自動作成（4文字区切り表示）
- 招待コードを持ち、匿名認証したユーザーだけが部屋に参加できる権限制御（Firestore Rules）
- メッセージへの絵文字リアクション：付ける・**別の絵文字に変更**・同じ絵文字を押して**取り消し**
- ライト／ダークモード（ウェルカム画面とチャット画面の両方）
- ファイル添付・ダウンロード：**Firebase無料のSparkプランでは最大3 MiB**（約3.1 MB）
- 既に参加した部屋を、このブラウザに記憶／部屋の切り替え／メッセージ検索／自分のメッセージ削除

## まず読む

**[`SETUP_GUIDE.md`](./SETUP_GUIDE.md)** に、更新方法・Firebaseルール設定・動作確認を順番に記載しています。

## 使い方

1. `index.html` を VS Code の **Live Server** で開きます。Firebase設定前は同じブラウザ内だけで動く**デモモード**です。
2. 「始める」から表示名を入力し、「新しいチャットを作る」を選択。
3. チャット名を入れて作成。表示された招待コードをコピーし、友達に送ります。
4. 友達は同じサイトの「始める」→ 表示名 →「招待コードで参加する」から入力します。
5. チャット画面のクリップでファイルを選択、送信ボタンで共有できます。リアクションは「☺ ＋」から選べます。
6. 背景テーマは上部の「ライトモード／ダークモード」ボタン、またはチャット左端の月ボタンで変更できます。

## ファイル構成

```text
linkroom/
├── index.html            # ウェルカム、入室フロー、チャット UI
├── styles.css            # Discord風デザイン（従来版）
├── v2.css                # 新しいページ・リアクション・添付・スマホ対応
├── app.js                # 部屋作成、招待、送信、リアクション、添付
├── firebase-config.js    # 【自分のFirebase設定値を入力】
├── firestore.rules       # 【Firebase Consoleで公開が必要】
├── storage.rules         # 8MBオプションを使う場合のみ
├── .nojekyll             # GitHub Pages向け
├── SETUP_GUIDE.md        # 導入・更新手順
└── README.md
```

## 無料プランとファイル添付

| 環境 | 最大ファイルサイズ | 保存方法 |
| --- | ---: | --- |
| Firebase設定なし（デモ） | 256 KiB | ブラウザのlocalStorage（他端末と共有しない） |
| Firebase Spark（無料） | 3 MiB | Firestore内で分割保存（256 KiB以下はメッセージに直接保存） |
| Cloud Storage追加（任意・Blazeプラン） | 8 MiB | 3 MiBまではFirestore、それ以上はCloud Storage |

ファイル形式：**PNG/JPG/WEBP/GIF/PDF/TXT/CSV/ZIP/DOCX/XLSX/PPTX**。

**注意：** FirebaseのFirestoreは、画像・ファイル保管に特化したサービスではありません。この実装は少人数・小容量向けです。大きなファイルを頻繁に送ると、無料枠の読み書き回数・保存容量・通信量を多く消費します。Cloud Storage for Firebaseは2026年2月3日以降、Blazeプランが必要です。

## 招待コードの安全性について

- **24文字を暗号学的乱数で生成**し、部屋IDとして扱います。部屋一覧の列挙はFirebaseのルールで禁止しています。
- メッセージ・添付・リアクションは、**その部屋のメンバー登録済み**の匿名認証ユーザーに限り読み書きできます。
- 招待コードを知る人は、誰でも匿名認証して参加できます。**参加の承認制、メンバー追放、コードの無効化、管理者による削除機能はまだありません**。
- これはエンドツーエンド暗号化チャットではありません。機密情報・個人情報の共有は控えてください。
- 匿名ログインのブラウザデータを消すとFirebaseのユーザーIDが変わります。再入室には招待コードが必要です。
- 旧版の公開チャンネル（雑談など）は新しい招待制ルームに**自動移行しません**。

## 公式ドキュメント

- [Firebase Console](https://console.firebase.google.com/)
- [Cloud Firestoreセキュリティルール](https://firebase.google.com/docs/firestore/security/get-started?hl=ja)
- [Firestore無料枠と制限](https://firebase.google.com/docs/firestore/quotas?hl=ja)
- [Cloud Storageの料金プラン要件](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)
- [GitHub Pages](https://docs.github.com/ja/pages/getting-started-with-github-pages/creating-a-github-pages-site)
