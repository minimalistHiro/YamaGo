'use client';

import { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseServices } from '@/lib/firebase/client';
import { updatePlayer } from '@/lib/game';

interface PlayerProfileEditViewProps {
  gameId: string;
  user: {
    uid: string;
    nickname: string;
    role: 'oni' | 'runner';
    avatarUrl?: string;
  };
  onBack: () => void;
  onProfileUpdated: (profile: { nickname: string; avatarUrl?: string }) => void;
}

export default function PlayerProfileEditView({
  gameId,
  user,
  onBack,
  onProfileUpdated
}: PlayerProfileEditViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(user.nickname);
  const [imagePreview, setImagePreview] = useState<string | null>(user.avatarUrl || null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const isBusy = isSaving;

  const handleSelectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isBusy) return;
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('画像ファイルは5MB以下にしてください');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください');
      return;
    }

    setSelectedImage(file);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview((e.target?.result as string) || null);
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    if (isBusy) return;
    setSelectedImage(null);
    setImagePreview(null);
    setError('');
  };

  const uploadAvatarToStorage = async (file: File): Promise<string> => {
    const { storage } = getFirebaseServices();
    const extensionFromName = file.name?.split('.').pop()?.toLowerCase();
    const extensionFromType = file.type.split('/').pop();
    const safeExtension = (extensionFromName || extensionFromType || 'png').replace(/[^a-z0-9]/g, '');
    const fileRef = ref(storage, `avatars/${user.uid}_${Date.now()}.${safeExtension}`);

    await uploadBytes(fileRef, file, {
      contentType: file.type || 'application/octet-stream'
    });

    return await getDownloadURL(fileRef);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!nickname.trim()) {
      setError('ユーザー名を入力してください');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      let avatarUrl = user.avatarUrl;

      if (selectedImage) {
        avatarUrl = await uploadAvatarToStorage(selectedImage);
      } else if (!imagePreview) {
        avatarUrl = '';
      }

      await updatePlayer(gameId, user.uid, {
        nickname: nickname.trim(),
        ...(avatarUrl !== undefined ? { avatarUrl } : {})
      });

      onProfileUpdated({
        nickname: nickname.trim(),
        avatarUrl: avatarUrl || undefined
      });
    } catch (err) {
      console.error('Failed to update profile:', err);
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col relative">
      {isBusy && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="h-10 w-10 rounded-full border-2 border-cyber-green border-t-transparent animate-spin" aria-hidden />
          <p className="mt-3 text-xs text-gray-700 tracking-[0.25em] uppercase">保存中...</p>
        </div>
      )}
      <header className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
        <button
          onClick={onBack}
          type="button"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 bg-white hover:bg-gray-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={isBusy}
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-lg font-semibold text-gray-800">ユーザー情報を編集</h2>
          <p className="text-sm text-gray-500">ニックネームとアイコン画像を変更できます</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-gray-500 mb-2">
                ユーザー名
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-950 focus:outline-none focus:ring-2 focus:ring-cyber-green/60 focus:border-cyber-green/60"
                placeholder="ユーザー名を入力"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{nickname.length}/20</p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-gray-500 mb-2">
                アイコン画像
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-300 shadow-sm">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    <img
                      src="/icons/default-avatar.svg"
                      alt="デフォルトアイコン"
                      className="w-12 h-12 opacity-80"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSelectImage}
                    className="hidden"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={isBusy}
                    >
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      画像を選択
                    </button>
                    {(selectedImage || imagePreview) && (
                      <button
                        type="button"
                        onClick={handleClearImage}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={isBusy}
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        画像をクリア
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    JPG / PNG / GIF 形式、5MB 以下のファイルをアップロードできます
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 px-4 py-3 rounded-full border border-gray-300 text-gray-600 font-medium hover:bg-gray-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isBusy}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-3 rounded-full bg-cyber-green text-[#031f1a] font-semibold shadow hover:bg-cyber-glow transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? '保存中...' : '変更を保存'}
            </button>
          </section>
        </form>
      </main>
    </div>
  );
}
