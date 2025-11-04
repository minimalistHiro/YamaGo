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
  - state: "active" | "downed" | "eliminated" (DbD mode)
  - downs: number (DbD mode - cumulative downs)
  - lastDownAt: timestamp | null (DbD mode)
  - lastRescuedAt: timestamp | null (DbD mode)
  - lastRevealUntil: timestamp | null (DbD mode - mutual visibility)
  - cooldownUntil: timestamp | null (DbD mode)
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

/games/{gameId}/alerts/{id} (DbD mode)
  - toUid: string
  - type: "killer-near" | "runner-near"
  - distanceM: number
  - at: timestamp
  - meta: object

/games/{gameId}/events/{id} (DbD mode)
  - type: "capture" | "rescue" | "elimination" | "game-start" | "game-end"
  - gameId: string
  - actorUid: string (optional)
  - targetUid: string (optional)
  - at: timestamp
  - data: object
```

## ⚙️ 主要機能

### 基本機能
1. **匿名ログイン** - ニックネーム登録のみ
2. **位置情報共有** - 10秒おきにFirestore更新
3. **リアルタイムマップ** - 全プレイヤー表示（鬼＝赤、逃走者＝緑）
4. **自動捕獲判定** - 50m以内で自動捕獲（Cloud Functions）
5. **境界制限** - 山手線外に出たら自動で鬼化
6. **遅延開始** - ゲーム開始30分後に鬼が有効化
7. **PWA対応** - ホーム画面インストール可能

### DbD Mode機能（追加）
8. **ダウンシステム** - 捕獲で`downed`、3回で`eliminated`
9. **救助メカニクス** - `downed`プレイヤーを50m以内で救助可能
10. **相互公開** - 捕獲後120秒間、双方の位置を常時表示
11. **非対称可視性**:
    - 鬼→逃走者：500m以内の逃走者を可視化
    - 逃走者→鬼：200m以内で正確位置、500m以内でアラート
12. **アラートシステム** - 敵接近時にバイブレーション＆通知
13. **クールダウン** - 救助直後30秒間は再ダウン不可

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

### 4. Storage の CORS 設定（ブラウザから直接アップロードする場合）

`storage-cors.json` を編集し、`origin` に Vercel で公開するドメインとローカル開発用の URL を記載します。次に以下のコマンドで Cloud Storage に反映します。

```bash
# ログイン済み前提で実行
gsutil cors set storage-cors.json gs://<your-project-id>.appspot.com

# 反映内容を確認
gsutil cors get gs://<your-project-id>.appspot.com
```

### 5. 開発サーバー起動

```bash
# Firebase エミュレータを起動
firebase emulators:start

# 別ターミナルでNext.js開発サーバーを起動
npm run dev
```

### 6. アクセス

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

## 🎮 DbD Mode ルール詳細

### ゲームメカニクス
- **CAPTURE (50m)**: 鬼が逃走者を50m以内に誘導すると自動的に`downed`状態へ
- **DOWNED**: 発電機操作不可、地図上は黄色枠で表示
- **REVEAL (120秒)**: 捕獲後、鬼と被捕獲者が相互に位置を常時表示
- **RESCUE (50m)**: 逃走者は`downed`仲間を50m以内で救助可能
- **ELIMINATE (3回)**: 同一逃走者が3回`downed`になると`eliminated`（永久離脱）
- **COOLDOWN (30秒)**: 救助直後30秒は再捕獲されない保護期間

### 可視性ルール
- **鬼の視界**: 500m以内の逃走者を常に表示（地図に赤円で表示）
- **逃走者の視界**: 
  - 200m以内: 鬼の正確位置を表示
  - 500m以内: アラート（バイブ＋通知）
  - 500m超: 鬼は非表示

### 定数
```typescript
CAPTURE_RADIUS_M = 50          // 捕獲距離
RUNNER_SEE_KILLER_RADIUS_M = 200    // 逃走者が鬼を見られる距離
KILLER_DETECT_RUNNER_RADIUS_M = 500 // 鬼が逃走者を見られる距離
MAX_DOWNS = 3                   // 最大ダウン回数
REVEAL_DURATION_SEC = 120       // 相互公開時間（秒）
RESCUE_COOLDOWN_SEC = 30        // 救助後クールダウン（秒）
```

## 🧪 DbD Mode テスト項目

### 受入テストチェックリスト
- [ ] **捕獲テスト**: 50m以内で逃行者が`downed`になり、`downs`が増加
- [ ] **相互公開テスト**: 捕獲後120秒間、捕獲者・被捕獲者の位置が常に表示
- [ ] **救助テスト**: `downed`逃行者が50m以内で救助可能、`active`に復帰
- [ ] **離脱テスト**: 同一プレイヤー3回目の捕獲で`eliminated`状態へ
- [ ] **クールダウン**: 救助直後30秒は即座に再捕獲されない
- [ ] **鬼の視界**: 500m以内の逃走者を鬼が地図上で確認できる
- [ ] **逃行者のアラート**: 鬼が500m以内に入るとバイブ＋トースト表示
- [ ] **逃行者の視界**: 200m以内で鬼の正確位置、500m以上で非表示
- [ ] **ダウン中の操作制限**: `state==="downed"`時は発電機操作不可

### テスト手順
1. 2台の端末でゲームに参加（鬼1名、逃走者1名）
2. 逃走者を鬼に50m以内に接近させて捕獲確認
3. 相互位置確認（120秒継続）
4. 第三者逃走者で救助を実施
5. 同一逃走者で3回捕獲して離脱確認
6. 距離ベース可視性を実機テスト

## ⚠️ 注意事項

- 位置情報の精度は端末に依存します
- 山手線の境界は簡略化されています（本格運用時は正確な境界データを使用）
- 捕獲判定はCloud Functionsで実行されます
- ゲーム開始30分後に鬼が有効化されます
- DbDモードの定数は`lib/constants.ts`で調整可能

## 🤝 貢献

プルリクエストやイシューの報告を歓迎します。

## 📄 ライセンス

MIT License
