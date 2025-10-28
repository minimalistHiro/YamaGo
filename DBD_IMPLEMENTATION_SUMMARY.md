# YamaGo「DbDモード」実装完了サマリー

## 📋 実装内容

### 1. 定数定義 (`lib/constants.ts`)
新規作成。以下を定義:
- `CAPTURE_RADIUS_M = 50`
- `RUNNER_SEE_KILLER_RADIUS_M = 200`
- `KILLER_DETECT_RUNNER_RADIUS_M = 500`
- `RESCUE_RADIUS_M = 50`
- `MAX_DOWNS = 3`
- `REVEAL_DURATION_SEC = 120`
- `RESCUE_COOLDOWN_SEC = 30`

### 2. データモデル拡張 (`lib/game.ts`)
`Player`に追加:
- `state`: 'active' | 'downed' | 'eliminated'
- `downs`: number
- `lastDownAt`: timestamp
- `lastRescuedAt`: timestamp
- `lastRevealUntil`: timestamp
- `cooldownUntil`: timestamp

新規型:
- `Alert`
- `GameEvent`

新規関数:
- `subscribeToAlerts()`
- `subscribeToEvents()`

### 3. Cloud Functions実装 (`functions/src/index.ts`)
更新:
- `onLocationWrite`: 位置更新トリガー、捕獲・可視性・アラート処理
- `capture()`: 捕獲処理
- `rescue()`: 救助呼び出し可能関数
- `enqueueAlert()`: アラート通知
- `recordEvent()`: イベント記録

### 4. セキュリティルール更新 (`firestore.rules`)
- `/alerts/{alertId}`: 対象ユーザのみ読取可能
- `/events/{eventId}`: 全員読取可能、Functionsのみ書込可能

### 5. Firestoreインデックス (`firestore.indexes.json`)
- `alerts`: toUid + at の複合インデックス
- `events`: at のインデックス

### 6. フロントエンド更新

#### `components/MapView.tsx`
- DbD可視性ロジック
- 役割別表示（鬼:500m、逃走者:200m）
- ダウン状態の視覚化

#### `app/play/[gameId]/page.tsx`
- アラート購読
- 救助ボタン表示
- バイブレーション対応

### 7. ドキュメント更新 (`README.md`)
- DbD Modeルール
- スキーマ
- テスト項目

## 🎮 ゲームフロー

### 捕獲フロー
1. 鬼と逃走者が50m以内
2. `capture()`実行
3. `downs`増加
4. 3回で`eliminated`
5. 120秒間相互公開

### 救助フロー
1. ダウン逃走者を50m以内で検知
2. 救助ボタン表示
3. クリックで`rescue()`呼び出し
4. `state: 'active'`
5. 30秒クールダウン

### 可視性フロー
- 鬼→逃走者: 500m以内常時表示
- 逃走者→鬼: 200m以内で正確位置
- 逃走者→鬼: 500m以内でアラート
- 相互公開中: 双方常時表示

## 🧪 テスト手順

### 1. ビルド確認
```bash
cd functions && npm run build  # ✅ 成功
```

### 2. デプロイ
```bash
firebase deploy --only functions,firestore:rules,firestore:indexes
```

### 3. 動作テスト
- [ ] 50m捕獲テスト
- [ ] 120秒相互公開確認
- [ ] 救助ボタン表示・実行
- [ ] 3回捕獲で離脱
- [ ] 可視性ルール確認
- [ ] アラート通知（バイブ）

## 📝 次のステップ

### 運用前確認
1. Cloud Functionsデプロイ
2. Firestoreルール・インデックスデプロイ
3. エミュレータでの統合テスト
4. 実機での位置情報精度テスト

### 最適化候補
1. 20人規模のパフォーマンス確認
2. セル分割による距離計算最適化
3. コメント追加
4. エラーハンドリング強化

## ✅ チェックリスト

- [x] 定数定義
- [x] データモデル拡張
- [x] Cloud Functions実装
- [x] セキュリティルール更新
- [x] Firestoreインデックス追加
- [x] フロントエンド更新
- [x] ドキュメント更新
- [x] TypeScriptビルド成功
- [x] Lintエラーなし

## 🚀 デプロイコマンド

```bash
# Cloud Functions
cd functions && npm run build
firebase deploy --only functions

# Firestore Rules & Indexes
firebase deploy --only firestore:rules,firestore:indexes

# フロントエンド（Vercel等）
# 自動デプロイ or vercel deploy
```

## 📊 パフォーマンス
- 20人規模想定
- 全員走査で許容範囲
- 必要に応じて最適化

