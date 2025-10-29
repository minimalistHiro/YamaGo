# Firestore セキュリティルールのガイド

## 現在のルール（プロダクション用）
`firestore.rules` - セキュアな本番環境用

## 緩和ルールのオプション

### 1. 完全オープン（開発/デバッグ用）
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
**使用目的**: ローカル開発、デバッグ
**デプロイコマンド**: `firebase deploy --only firestore:rules`

### 2. 認証済みユーザーのみ（中程度のセキュリティ）
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
**使用目的**: 認証ユーザーのみアクセス可能

### 3. 特定コレクションのみ緩和
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // games コレクションのみ緩和
    match /games/{gameId} {
      allow read, write: if true;
      
      match /players/{playerId} {
        allow read, write: if true;
      }
    }
    
    // 他のコレクションは厳格
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 現在の問題に対する緩和案

### 問題: ownerUid更新が拒否される

#### オプション A: ゲーム作成者を自動的にオーナーにする
```javascript
match /games/{gameId} {
  allow read: if true;
  allow create, update: if request.auth != null;
  allow delete: if request.auth != null && 
    resource.data.ownerUid == request.auth.uid;
}
```

#### オプション B: 最初のプレイヤーをオーナーにする
```javascript
match /games/{gameId} {
  allow read: if true;
  
  // オーナーの更新をより柔軟に
  allow update: if request.auth != null && (
    // 現在のオーナー
    resource.data.ownerUid == request.auth.uid ||
    // プレイヤーがいない場合
    !exists(/databases/$(database)/documents/games/$(gameId)/players)
  );
}
```

### 問題: プレイヤー参加時の権限エラー

#### より緩いルール
```javascript
match /players/{playerId} {
  allow read: if true;
  allow create, update: if request.auth != null && 
    playerId == request.auth.uid;
  allow delete: if request.auth != null && (
    playerId == request.auth.uid ||
    get(/databases/$(database)/documents/games/$(gameId)).data.ownerUid == request.auth.uid
  );
}
```

## デプロイ方法

### 開発用ルールをデプロイ
```bash
firebase deploy --only firestore:rules --project your-project-id
```

### ローカルでテスト
```bash
firebase emulators:start --only firestore
```

### 本番環境のルールに戻す
開発用の`firestore.rules.development`を本番用に戻す必要があります。

## 推奨アプローチ

1. **開発環境**: 緩いルールを使用
2. **ステージング**: 中程度のセキュリティ
3. **本番環境**: 現在の厳格なルール

## 現在の実装

現在の実装では以下を試行しました：

```javascript
// games/{gameId} の update を緩和
allow update: if request.auth != null && (
  resource.data.ownerUid == request.auth.uid ||
  (
    request.resource.data.keys().hasOnly(['ownerUid']) &&
    !exists(/databases/$(database)/documents/games/$(gameId)/players)
  )
);
```

これにより、プレイヤーがいない状態でownerUidのみを更新することが可能になりました。

