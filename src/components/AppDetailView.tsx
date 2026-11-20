import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  Film,
  Image as ImageIcon,
  ShieldCheck,
} from 'lucide-react';
import { AppImage } from './AppImage';
import { formatBytes, getVideoEmbedInfo } from '../lib/storage';
import type { AppRelease } from '../types/app';

interface AppDetailViewProps {
  app: AppRelease;
  downloading: boolean;
  onBack: () => void;
  onDownload: (app: AppRelease) => Promise<void>;
}

export function AppDetailView({
  app,
  downloading,
  onBack,
  onDownload,
}: AppDetailViewProps) {
  const [selectedShot, setSelectedShot] = useState(0);
  const [copiedSha, setCopiedSha] = useState(false);

  const videoInfo = getVideoEmbedInfo(app.videoUrl || '');
  const hasVideo = videoInfo.type !== 'none';
  const hasScreenshots = app.screenshots && app.screenshots.length > 0;
  const [mediaTab, setMediaTab] = useState<'video' | 'screenshots'>(() =>
    hasVideo ? 'video' : 'screenshots'
  );

  const handleCopySha = async () => {
    if (!app.apkSha256) return;
    try {
      await navigator.clipboard.writeText(app.apkSha256);
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2000);
    } catch {
      // Clipboard unavailable in restricted context
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-950 transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Catalog
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Column: App Video, Screenshots Gallery, Overview, Release Notes */}
        <div className="lg:col-span-8 space-y-10">
          {/* App Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <AppImage
              src={app.iconUrl}
              alt={`${app.name} icon`}
              fallbackLabel={app.name.slice(0, 2).toUpperCase()}
              className="w-20 h-20 rounded-2xl object-cover border border-zinc-200 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 mb-1.5">
                <span className="font-medium text-zinc-700">{app.category}</span>
                <span aria-hidden="true">·</span>
                <span>{app.developer}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">v{app.version}</span>
                {hasVideo && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-emerald-700">
                      Video Preview Available
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 text-balance">
                {app.name}
              </h1>
              <p className="text-base text-zinc-600 mt-1.5 leading-relaxed">
                {app.tagline}
              </p>
            </div>
          </div>

          {/* Media Showcase: App Video & Screenshots */}
          {(hasScreenshots || hasVideo) && (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-semibold text-zinc-900">
                  {mediaTab === 'video' && hasVideo
                    ? 'App Video Preview'
                    : 'Screenshots'}
                </h2>
                {hasVideo && hasScreenshots && (
                  <div className="inline-flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setMediaTab('video')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                        mediaTab === 'video'
                          ? 'bg-white text-zinc-950 shadow-sm'
                          : 'text-zinc-600 hover:text-zinc-950'
                      }`}
                    >
                      <Film className="w-3.5 h-3.5" />
                      App Video
                    </button>
                    <button
                      type="button"
                      onClick={() => setMediaTab('screenshots')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                        mediaTab === 'screenshots'
                          ? 'bg-white text-zinc-950 shadow-sm'
                          : 'text-zinc-600 hover:text-zinc-950'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      Screenshots ({app.screenshots.length})
                    </button>
                  </div>
                )}
              </div>

              <div className="aspect-video w-full rounded-xl overflow-hidden bg-zinc-950 border border-zinc-200">
                {(mediaTab === 'video' && hasVideo) || !hasScreenshots ? (
                  videoInfo.type === 'direct' ? (
                    <video
                      src={videoInfo.src}
                      controls
                      playsInline
                      className="w-full h-full object-contain bg-black"
                    />
                  ) : videoInfo.type === 'youtube' || videoInfo.type === 'drive' ? (
                    <iframe
                      src={videoInfo.src}
                      title={`${app.name} app video`}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : null
                ) : (
                  <AppImage
                    src={app.screenshots[selectedShot] || app.screenshots[0]}
                    alt={`${app.name} screenshot ${selectedShot + 1}`}
                    fallbackLabel="Screenshot Preview"
                    className="w-full h-full object-cover bg-zinc-100"
                  />
                )}
              </div>

              {hasScreenshots &&
                app.screenshots.length > 1 &&
                mediaTab === 'screenshots' && (
                  <div className="grid grid-cols-4 gap-3">
                    {app.screenshots.map((shot, index) => (
                      <button
                        key={`${shot}-${index}`}
                        type="button"
                        onClick={() => setSelectedShot(index)}
                        className={`aspect-video rounded-lg overflow-hidden border transition-all ${
                          selectedShot === index
                            ? 'border-emerald-600 ring-2 ring-emerald-600/20'
                            : 'border-zinc-200 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <AppImage
                          src={shot}
                          alt={`${app.name} thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
            </section>
          )}

          {/* Overview */}
          <section className="pt-8 border-t border-zinc-200 space-y-3">
            <h2 className="text-lg font-semibold text-zinc-950">About this app</h2>
            <p className="text-sm sm:text-base text-zinc-600 leading-relaxed whitespace-pre-line max-w-[70ch]">
              {app.description || 'No description provided for this release.'}
            </p>
          </section>

          {/* Release Notes */}
          {app.whatsNew && (
            <section className="pt-8 border-t border-zinc-200 space-y-3">
              <h2 className="text-lg font-semibold text-zinc-950">
                What&apos;s new in v{app.version}
              </h2>
              <div className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">
                {app.whatsNew}
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Sticky Contiguous Download Module */}
        <aside className="lg:col-span-4 lg:sticky lg:top-24">
          <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6">
            <div>
              <p className="text-xs font-medium text-zinc-500">
                Direct Android Package
              </p>
              <p className="text-base sm:text-lg font-bold text-zinc-950 mt-1 break-all font-mono">
                {app.apkFileName}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 mt-2 font-mono tabular-nums">
                <span>{formatBytes(app.apkSizeBytes)}</span>
                <span aria-hidden="true">·</span>
                <span>{app.minAndroid}</span>
                <span aria-hidden="true">·</span>
                <span>{app.downloads.toLocaleString()} downloads</span>
              </div>
            </div>

            <button
              type="button"
              disabled={downloading}
              onClick={() => void onDownload(app)}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              {downloading ? 'Preparing APK...' : 'Download APK'}
            </button>

            <a
              href={app.apkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-950 transition-colors"
            >
              Open direct download link
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <dl className="pt-5 border-t border-zinc-100 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-zinc-500">Package ID</dt>
                <dd className="font-mono text-zinc-900 truncate max-w-[200px]">
                  {app.packageId}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-4">
                <dt className="text-zinc-500">Version</dt>
                <dd className="font-mono tabular-nums text-zinc-900">
                  {app.version}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-4">
                <dt className="text-zinc-500">Minimum OS</dt>
                <dd className="font-medium text-zinc-900">{app.minAndroid}</dd>
              </div>

              <div className="flex items-center justify-between gap-4">
                <dt className="text-zinc-500">Developer</dt>
                <dd className="font-medium text-zinc-900 truncate max-w-[200px]">
                  {app.developer}
                </dd>
              </div>
            </dl>

            {app.apkSha256 && (
              <div className="pt-5 border-t border-zinc-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    SHA-256 Checksum
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopySha()}
                    className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-950"
                  >
                    {copiedSha ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="font-mono text-[11px] text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 break-all">
                  {app.apkSha256}
                </p>
              </div>
            )}

            <div className="pt-5 border-t border-zinc-100 text-xs text-zinc-500 leading-relaxed">
              <p className="font-medium text-zinc-700 mb-1">
                Android Installation Guide
              </p>
              <p>
                After downloading the APK file, open it from your Downloads folder and enable &ldquo;Install unknown apps&rdquo; for your browser if prompted.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
