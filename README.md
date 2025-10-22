# Yamago - 山手線リアル鬼ごっこ

山手線内で行うリアル鬼ごっこイベント用のPWAアプリです。位置情報を共有し、鬼が50m以内に近づくと自動で捕獲判定する仕組みを構築しています。

## 🚀 技術スタック

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Firebase (Auth, Firestore, Cloud Functions)
- **Map**: MapLibre GL JS (OpenStreetMap)
- **PWA**: Service Worker, Web App Manifest
- **Deployment**: Vercel (App Router最適化)

## 📁 プロジェクト構成

```
/app
  /join/page.tsx         // ニックネーム入力→参加登録
  /create/page.tsx       // ゲーム作成
  /play/[gameId]/page.tsx // 位置共有＋マップ表示
  /admin/[gameId]/page.tsx // 主催者モード（開始・終了・鬼変更）
/components
  MapView.tsx            // MapLibre描画
  HUD.tsx                // タイマー・アラート
/lib
  firebase.ts            // Firebase初期化
  geo.ts                 // haversine距離計算
  game.ts                // Firestore操作
/functions
  src/index.ts           // Cloud Functions
/public
  manifest.json          // PWA設定
  service-worker.js      // Service Worker
```

## 🔐 Firestoreスキーマ

```
/games/{gameId}
  - status: "pending" | "running" | "ended"
  - startAt: timestamp
  - captureRadiusM: number (default: 50)
  - startDelaySec: number (default: 1800)
  - ownerUid: string

/games/{gameId}/players/{uid}
  - nickname: string
  - role: "oni" | "runner"
  - active: boolean
  - stats: { captures: number, capturedTimes: number }

/games/{gameId}/locations/{uid}
  - lat: number
  - lng: number
  - accM: number
  - at: timestamp

/games/{gameId}/captures/{id}
  - attackerUid: string
  - victimUid: string
  - at: timestamp
```

## ⚙️ 主要機能

1. **匿名ログイン** - ニックネーム登録のみ
2. **位置情報共有** - 10秒おきにFirestore更新
3. **リアルタイムマップ** - 全プレイヤー表示（鬼＝赤、逃走者＝緑）
4. **自動捕獲判定** - 50m以内で自動捕獲（Cloud Functions）
5. **境界制限** - 山手線外に出たら自動で鬼化
6. **遅延開始** - ゲーム開始30分後に鬼が有効化
7. **PWA対応** - ホーム画面インストール可能

## 🛠️ セットアップ手順

### 1. 依存関係のインストール

```bash
# メインプロジェクト（functions/も自動でインストール）
npm ci
```

### 2. Firebase設定

1. [Firebase Console](https://console.firebase.google.com/)でプロジェクトを作成
2. Authentication、Firestore、Functionsを有効化
3. 環境変数を設定：

```bash
cp env.example .env.local
```

`.env.local`に以下を設定：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. Firebase CLI設定

```bash
# Firebase CLIをインストール（未インストールの場合）
npm install -g firebase-tools

# Firebaseにログイン
firebase login

# プロジェクトを初期化
firebase init
```

### 4. 開発サーバー起動

```bash
# Firebase エミュレータを起動
firebase emulators:start

# 別ターミナルでNext.js開発サーバーを起動
npm run dev
```

### 5. アクセス

- **アプリ**: http://localhost:3000
- **Firebase Emulator UI**: http://localhost:4000

## 🎮 使用方法

### ゲーム作成者（鬼）

1. アプリにアクセス
2. 「ゲームを作成」をクリック
3. ニックネームを入力してゲーム作成
4. 管理者ページでゲームを開始
5. 他のプレイヤーにゲームIDを共有

### 参加者（逃走者）

1. アプリにアクセス
2. 「ゲームに参加」をクリック
3. ニックネームとゲームIDを入力
4. 位置情報の許可を求められたら「許可」
5. マップ上で自分の位置と他のプレイヤーを確認

## 🔧 開発・デバッグ

### ログ確認

```bash
# Cloud Functions のログ
firebase functions:log

# エミュレータのログ
firebase emulators:start --debug
```

### データベース確認

Firebase Emulator UI (http://localhost:4000) でFirestoreデータを確認できます。

## 🚀 Build & Deploy

### Local Build

```bash
# App build
npm run build

# Functions build (independent)
cd functions && npm run build
```

### Vercel Deploy

Vercel でのデプロイを前提としています。GitHub リポジトリを接続するか、Vercel CLI から直接デプロイしてください。

```bash
# (任意) Vercel CLIをインストール
npm install -g vercel

# 初回のみ、プロジェクトをVercelにリンク
vercel link

# 本番デプロイ
vercel deploy --prod
```

#### 必須環境変数

Vercel プロジェクトの **Settings > Environment Variables** で、以下の変数を `Production` と `Preview` に設定してください。

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (Analytics を使う場合のみ)
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`

Firebase のバックエンド (Cloud Functions 等) を利用する場合は、Firebase CLI で別途デプロイしてください。

```bash
cd functions
npm run build
firebase deploy --only functions
```

## 📱 PWA機能

- ホーム画面に追加可能
- オフライン対応（Service Worker）
- プッシュ通知対応（要設定）

## ⚠️ 注意事項

- 位置情報の精度は端末に依存します
- 山手線の境界は簡略化されています（本格運用時は正確な境界データを使用）
- 捕獲判定は2秒間隔で実行されます
- ゲーム開始30分後に鬼が有効化されます

## 🤝 貢献

プルリクエストやイシューの報告を歓迎します。

## 📄 ライセンス

MIT License

