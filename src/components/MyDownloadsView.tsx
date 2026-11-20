import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { Download, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { AppRelease, DownloadRecord } from '../types/app';

interface MyDownloadsViewProps {
  apps: AppRelease[];
  onSelectApp: (app: AppRelease) => void;
  onBrowseCatalog: () => void;
  onOpenAuth: () => void;
}

export function MyDownloadsView({
  apps,
  onSelectApp,
  onBrowseCatalog,
  onOpenAuth,
}: MyDownloadsViewProps) {
  const { user, authReady } = useAuth();
  const [records, setRecords] = useState<DownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const path = `users/${user.uid}/downloads`;
    const q = query(
      collection(db, 'users', user.uid, 'downloads'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: DownloadRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId || ''),
            appId: String(data.appId || ''),
            appName: String(data.appName || ''),
            version: String(data.version || ''),
            downloadedAt: data.downloadedAt ?? null,
          };
        });
        list.sort((a, b) => {
          const aMs =
            a.downloadedAt && typeof a.downloadedAt.toMillis === 'function'
              ? a.downloadedAt.toMillis()
              : 0;
          const bMs =
            b.downloadedAt && typeof b.downloadedAt.toMillis === 'function'
              ? b.downloadedAt.toMillis()
              : 0;
          return bMs - aMs;
        });
        setRecords(list);
        setLoading(false);
      },
      (error) => {
        console.error('Downloads listener failed:', path, error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authReady, user]);

  const handleRemoveRecord = async (recordId: string) => {
    if (!user) return;
    const path = `users/${user.uid}/downloads/${recordId}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'downloads', recordId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const formatDate = (ts?: DownloadRecord['downloadedAt']) => {
    if (!ts || typeof ts.toDate !== 'function') return 'Just now';
    return ts.toDate().toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="bg-white border border-zinc-200 rounded-xl p-10">
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">
            Sign in to view your downloads
          </h1>
          <p className="text-sm text-zinc-600 mt-2 max-w-md mx-auto leading-relaxed">
            Create an account or sign in with your email and password to keep a personal history of your downloaded Android APKs.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-6 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-zinc-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-950 tracking-tight">
            My Downloads
          </h1>
          <p className="text-sm text-zinc-600 mt-1">
            Private APK download log synced to your account.
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-zinc-500">
          {records.length} {records.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 bg-white border border-zinc-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="mt-8 bg-white border border-zinc-200 rounded-xl p-10 text-center">
          <Download className="w-7 h-7 text-zinc-400 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-zinc-950">
            No downloads recorded yet
          </h2>
          <p className="text-sm text-zinc-600 mt-1">
            Download any app from the catalog and it will appear here.
          </p>
          <button
            type="button"
            onClick={onBrowseCatalog}
            className="mt-5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
          >
            Browse Catalog
          </button>
        </div>
      ) : (
        <div className="mt-6 bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500 bg-zinc-50/70">
                  <th className="py-3 px-4">Application</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Downloaded</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm">
                {records.map((rec) => {
                  const matchedApp = apps.find((a) => a.id === rec.appId);
                  return (
                    <tr key={rec.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-zinc-950">
                        {rec.appName}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs tabular-nums text-zinc-600">
                        v{rec.version}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-zinc-500 tabular-nums">
                        {formatDate(rec.downloadedAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-3">
                          {matchedApp && (
                            <button
                              type="button"
                              onClick={() => onSelectApp(matchedApp)}
                              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
                            >
                              Open App
                            </button>
                          )}
                          <button
                            type="button"
                            aria-label={`Remove ${rec.appName} from history`}
                            onClick={() => void handleRemoveRecord(rec.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
