# 🚀 YamaGo TestFlight リリース手順

## 📋 事前準備

### 1. Apple Developer Account
- Apple Developer Programに参加済みであることを確認
- App Store Connectにアクセス可能であることを確認

### 2. App Store Connect設定
- App Store Connectで新しいアプリを作成
- Bundle ID: `io.groumap.yamago`
- App Name: `YamaGo`

## 🔧 Xcodeでの設定

### 1. Signing & Capabilities
1. Xcodeでプロジェクトを開く（既に開いている）
2. プロジェクトナビゲーターで「App」を選択
3. 「Signing & Capabilities」タブを選択
4. 「Automatically manage signing」をチェック
5. Team: あなたのApple Developer Teamを選択
6. Bundle Identifier: `io.groumap.yamago`を確認

### 2. Build Settings
1. 「Build Settings」タブを選択
2. 「Version」を検索
3. `MARKETING_VERSION`: `1.0.0`
4. `CURRENT_PROJECT_VERSION`: `1`

### 3. App Icons設定
現在のアイコン設定を確認：
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/`に必要なサイズのアイコンを配置
- 1024x1024のApp Store用アイコンが必要

## 🏗️ Archive作成とアップロード

### 1. Archive作成
1. Xcodeで「Product」→「Archive」を選択
2. ビルドが完了するまで待機（数分かかる場合があります）

### 2. App Store Connectにアップロード
1. Archive完了後、「Distribute App」をクリック
2. 「App Store Connect」を選択
3. 「Upload」を選択
4. 「Upload」をクリックしてアップロード開始

### 3. App Store Connectでの設定
1. App Store Connectにログイン
2. 「My Apps」→「YamaGo」を選択
3. 「TestFlight」タブを選択
4. アップロードされたビルドを確認
5. 「Test Information」を入力：
   - What to Test: 位置情報を使った鬼ごっこゲームのテスト
   - Description: バックグラウンド位置情報トラッキング機能のテスト
6. 「Add External Testers」でテスターを追加

## 📱 テスト用設定

### 1. Firebase Functions デプロイ
```bash
cd functions
npm run deploy
```

### 2. 環境変数確認
- Firebase設定が正しく動作することを確認
- Cloud FunctionsのURLが正しいことを確認

## ⚠️ 重要な注意事項

### 1. 位置情報権限
- アプリは位置情報の「Always」権限を要求します
- TestFlightテスターには事前にこの点を説明してください

### 2. バックグラウンド実行
- アプリはバックグラウンドで位置情報を送信します
- バッテリー使用量についてテスターに説明してください

### 3. テスト環境
- 実際のデバイスでのテストが必要です
- シミュレーターでは位置情報機能が制限されます

## 🔍 テスト項目

### 1. 基本機能
- [ ] アプリの起動
- [ ] ゲーム参加
- [ ] 位置情報の取得
- [ ] マップ表示

### 2. バックグラウンド機能
- [ ] アプリを閉じた後の位置情報送信
- [ ] 通知の表示
- [ ] バッテリー使用量

### 3. ゲーム機能
- [ ] 鬼ごっこの基本ルール
- [ ] 位置情報に基づく判定
- [ ] チャット機能

## 📞 サポート

問題が発生した場合：
1. Xcodeのコンソールログを確認
2. Firebase Consoleでエラーログを確認
3. TestFlightのフィードバックを確認

## 🎯 次のステップ

TestFlightテストが成功したら：
1. App Store審査用のメタデータを準備
2. スクリーンショットとアプリ説明を作成
3. App Store審査に提出
