'use client';

import { useState, useEffect, useCallback } from 'react';
import Chat from '../components/Chat';
import './Page.css';

interface Regulation {
  id: number | string;
  title: string;
  body: string;
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Teams SDK初期化
  const initTeams = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      if (typeof window === 'undefined' || !window.microsoftTeams) {
        console.warn('Not running in Teams. Using mock mode.');
        setIsAuthenticated(true);
        resolve();
        return;
      }
      try {
        window.microsoftTeams.initialize();
        window.microsoftTeams.ready();
        resolve();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Teams init error:', message);
        reject(err);
      }
    });
  }, []);

  // Microsoft認証（Teams SSO）
  const authenticate = useCallback(async (): Promise<string | null> => {
    if (typeof window === 'undefined' || !window.microsoftTeams) {
      console.warn('Mock auth: returning dummy token');
      return 'mock-token';
    }
    return new Promise((resolve) => {
      try {
        window.microsoftTeams!.authentication.getAuthToken(
          { scopes: ['sites.read.all'] },
          (error: string | null, token: string) => {
            if (error) {
              console.error('Auth error:', error);
              setAuthError(error);
              resolve(null);
            } else {
              console.log('Authentication successful');
              setIsAuthenticated(true);
              resolve(token);
            }
          }
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Auth exception:', message);
        setAuthError(message);
        resolve(null);
      }
    });
  }, []);

  // SharePointから規定をフェッチ
  const fetchRegulations = useCallback(async (token: string) => {
    try {
      const response = await fetch('/api/sharepoint', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`SharePoint API error: ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      if (data.regulations && data.regulations.length > 0) {
        setRegulations(data.regulations);
        console.log(`Loaded ${data.regulations.length} regulations`);
      } else {
        setError('規定が見つかりませんでした。SharePointの「サイトページ」リストにアクセスできるか確認してください。');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Fetch regulations error:', message);
      setError(`規定の読み込みに失敗しました: ${message}`);
    }
  }, []);

  // メイン初期化フロー
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        await initTeams();
        if (cancelled) return;
        const token = await authenticate();
        if (cancelled) return;
        if (token) await fetchRegulations(token);
        setLoading(false);
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          console.error('Init error:', message);
          setError(message);
          setLoading(false);
        }
      }
    };
    init();
    return () => { cancelled = true; };
  }, [initTeams, authenticate, fetchRegulations]);

  // ローディング表示
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>社内規定を読み込んでいます...</p>
      </div>
    );
  }

  // エラー表示
  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <p className="error-message">エラーが発生しました</p>
        <p className="error-detail">{error}</p>
      </div>
    );
  }

  return (
    <Chat
      isAuthenticated={isAuthenticated}
      regulations={regulations}
      loading={loading}
      error={error}
    />
  );
}
