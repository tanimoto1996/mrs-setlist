"use client";

import { useEffect, useMemo, useState } from "react";
import { SHADOWS_OPENING } from "@/lib/event";
import type { PredictionResult, SongPrediction } from "@/lib/jev";
import { scoreSetlist } from "@/lib/scoring";
import { ALBUM_ORDER, SONGS, SONG_MAP } from "@/lib/songs";

type Mode = "mine" | "actual";

interface Saved {
  mine: string[];
  actual: string[];
  rumors: string;
  jev: PredictionResult | null;
}

const STORAGE_KEY = "mga-setlist-oracle:v1";
const EMPTY: Saved = { mine: [], actual: [], rumors: "", jev: null };

export default function Page() {
  const [saved, setSaved] = useState<Saved>(EMPTY);
  const [mode, setMode] = useState<Mode>("mine");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved({ ...EMPTY, ...(JSON.parse(raw) as Partial<Saved>) });
    } catch {
      // 壊れてたら初期値で
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [saved, hydrated]);

  const list = mode === "mine" ? saved.mine : saved.actual;
  const setList = (next: string[]) =>
    setSaved((s) => (mode === "mine" ? { ...s, mine: next } : { ...s, actual: next }));

  const toggle = (id: string) => {
    if (list.includes(id)) setList(list.filter((x) => x !== id));
    else if (mode === "actual" || list.length < SHADOWS_OPENING.setlistSize) setList([...list, id]);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
  };

  const grouped = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return ALBUM_ORDER.map((album) => ({
      album,
      songs: SONGS.filter((s) => s.album === album && (!q || s.title.toLowerCase().includes(q))),
    })).filter((g) => g.songs.length > 0);
  }, [filter]);

  const jevBySong = useMemo(() => {
    const m = new Map<string, SongPrediction>();
    saved.jev?.predictions.forEach((p) => m.set(p.songId, p));
    return m;
  }, [saved.jev]);

  const askJev = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rumors: saved.rumors, setlistSize: SHADOWS_OPENING.setlistSize }),
      });
      const data = (await res.json()) as PredictionResult | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : "予想に失敗");
      setSaved((s) => ({ ...s, jev: data }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "予想に失敗");
    } finally {
      setLoading(false);
    }
  };

  const hasActual = saved.actual.length > 0;
  const myScore = hasActual ? scoreSetlist(saved.mine, saved.actual) : null;
  const jevScore = hasActual && saved.jev ? scoreSetlist(saved.jev.setlist, saved.actual) : null;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-8">
      <header className="mb-12">
        <h1 className="shadow-title text-[clamp(3.5rem,12vw,9rem)]">SHADOWS</h1>
        <p className="mt-6 max-w-[38rem] text-base leading-7">
          {SHADOWS_OPENING.date.replaceAll("-", "/")}、{SHADOWS_OPENING.venue}。
          ツアー初日のセットリストを、俺と Jev で当てる。左の全曲から{SHADOWS_OPENING.setlistSize}曲まで選んで並べたら、Jev
          にも同じ条件で予想させて、ライブ後に答え合わせ。
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* ---- 全曲 ---- */}
        <section aria-labelledby="songs-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <h2 id="songs-heading" className="font-display text-2xl font-bold">
              全曲 <span className="text-base font-normal text-dusk">{SONGS.length}曲</span>
            </h2>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="曲名で絞る"
              aria-label="曲名で絞る"
              className="cast-sm w-44 px-3 py-1.5 text-sm placeholder:text-dusk"
            />
          </div>

          <div className="cast-sm mb-4 inline-flex text-sm" role="tablist" aria-label="どのリストに入れるか">
            {(["mine", "actual"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 ${mode === m ? "bg-ink text-paper" : ""}`}
              >
                {m === "mine" ? "俺の予想に入れる" : "実セトリを入力"}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {grouped.map(({ album, songs }) => (
              <div key={album}>
                <h3 className="mb-2 font-display text-lg font-bold">{album === "single" ? "シングル・配信" : album}</h3>
                <ul className="flex flex-wrap gap-2">
                  {songs.map((s) => {
                    const on = list.includes(s.id);
                    const jp = jevBySong.get(s.id);
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => toggle(s.id)}
                          aria-pressed={on}
                          title={s.tieup ?? `${s.year}年`}
                          className={`cast-sm px-3 py-1.5 text-sm ${on ? "pressed" : "hover:bg-mist"}`}
                        >
                          {s.title}
                          {jp && !on && (
                            <span className="ml-2 text-xs text-dusk" aria-label="Jev の見込み">
                              {Math.round(jp.likelihood * 100)}%
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ---- 予想と答え合わせ ---- */}
        <div className="space-y-10">
          <section className="cast p-5" aria-labelledby="mine-heading">
            <h2 id="mine-heading" className="font-display text-2xl font-bold">
              俺の予想{" "}
              <span className="text-base font-normal text-dusk">
                {saved.mine.length}/{SHADOWS_OPENING.setlistSize}曲
              </span>
            </h2>
            <SetlistView
              ids={saved.mine}
              actual={saved.actual}
              editable={mode === "mine"}
              onMove={move}
              onRemove={(id) => setSaved((s) => ({ ...s, mine: s.mine.filter((x) => x !== id) }))}
              empty="左の曲を押すと、ここに順番どおり積まれていく。"
            />
          </section>

          <section className="cast p-5" aria-labelledby="jev-heading">
            <h2 id="jev-heading" className="font-display text-2xl font-bold">
              Jev の予想
            </h2>
            <label className="mt-3 block text-sm">
              匂わせ・話題メモ（Jev の判断材料に足す）
              <textarea
                value={saved.rumors}
                onChange={(e) => setSaved((s) => ({ ...s, rumors: e.target.value }))}
                rows={3}
                placeholder="例: テレビ×ミセスで大森がインディーズ曲やりたいと言ってた / リハ音漏れで Soranji"
                className="cast-sm mt-1 w-full px-3 py-2 text-sm placeholder:text-dusk"
              />
            </label>
            <button
              onClick={askJev}
              disabled={loading}
              className="cast-sm mt-3 bg-apple px-4 py-2 font-bold text-paper disabled:opacity-60"
            >
              {loading ? "Jev が全曲を採点中…" : saved.jev ? "もう一回予想させる" : "Jev に予想させる"}
            </button>
            {error && <p className="mt-3 text-sm text-rouge">{error}</p>}

            {saved.jev && (
              <>
                <SetlistView
                  ids={saved.jev.setlist}
                  actual={saved.actual}
                  editable={false}
                  likelihood={jevBySong}
                  empty=""
                />
                <p className="mt-3 text-xs text-dusk">
                  model {saved.jev.model} / 入力 {saved.jev.usage.input_tokens.toLocaleString()} tokens
                </p>
              </>
            )}
          </section>

          <section className="cast p-5" aria-labelledby="result-heading">
            <h2 id="result-heading" className="font-display text-2xl font-bold">
              答え合わせ
            </h2>
            {!hasActual ? (
              <p className="mt-3 text-sm leading-6">
                ライブが終わったら「実セトリを入力」に切り替えて、演奏順に曲を押していく。入力した瞬間に採点される。
              </p>
            ) : (
              <>
                <p className="mt-3 text-sm text-dusk">実セトリ {saved.actual.length}曲</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <ScoreCard label="俺" score={myScore} />
                  <ScoreCard label="Jev" score={jevScore} />
                </div>
                <p className="mt-3 text-xs leading-5 text-dusk">
                  曲一致 10点、順番±2 以内で +5、1曲目とラスト曲の的中は各 +15。
                </p>
                <button
                  onClick={() => setSaved((s) => ({ ...s, actual: [] }))}
                  className="mt-3 text-sm underline"
                >
                  実セトリを消す
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function SetlistView({
  ids,
  actual,
  editable,
  likelihood,
  onMove,
  onRemove,
  empty,
}: {
  ids: string[];
  actual: string[];
  editable: boolean;
  likelihood?: Map<string, SongPrediction>;
  onMove?: (i: number, dir: -1 | 1) => void;
  onRemove?: (id: string) => void;
  empty: string;
}) {
  if (ids.length === 0) return empty ? <p className="mt-3 text-sm leading-6 text-dusk">{empty}</p> : null;
  const actualSet = new Set(actual);
  return (
    <ol className="mt-4 space-y-1.5">
      {ids.map((id, i) => {
        const s = SONG_MAP.get(id);
        const p = likelihood?.get(id);
        const hit = actual.length > 0 && actualSet.has(id);
        return (
          <li key={id} className="flex items-center gap-3 text-sm">
            <span className="w-6 shrink-0 text-right font-display font-bold tabular-nums">{i + 1}</span>
            <span className={`min-w-0 flex-1 truncate ${actual.length > 0 && !hit ? "text-dusk line-through" : ""}`}>
              {s?.title ?? id}
            </span>
            {p && (
              <span className="flex w-24 shrink-0 items-center gap-1.5" title={`確信度 ${Math.round(p.confidence * 100)}%`}>
                <span className="h-2 flex-1 border border-ink bg-paper">
                  <span className="block h-full bg-apple" style={{ width: `${Math.round(p.likelihood * 100)}%` }} />
                </span>
                <span className="w-8 text-right text-xs tabular-nums">{Math.round(p.likelihood * 100)}</span>
              </span>
            )}
            {editable && onMove && onRemove && (
              <span className="flex shrink-0 gap-1">
                <IconButton label="上へ" onClick={() => onMove(i, -1)}>
                  ↑
                </IconButton>
                <IconButton label="下へ" onClick={() => onMove(i, 1)}>
                  ↓
                </IconButton>
                <IconButton label="外す" onClick={() => onRemove(id)}>
                  ×
                </IconButton>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} className="h-6 w-6 border border-ink text-xs leading-none hover:bg-mist">
      {children}
    </button>
  );
}

function ScoreCard({ label, score }: { label: string; score: ReturnType<typeof scoreSetlist> | null }) {
  return (
    <div className="cast-sm p-3">
      <p className="font-display text-lg font-bold">{label}</p>
      {score ? (
        <>
          <p className="font-display text-4xl font-extrabold tabular-nums">{score.points}</p>
          <p className="mt-1 text-xs leading-5 text-dusk">
            {score.hits}/{score.total}曲 一致、順番 {score.positionHits}曲
            {score.openerHit ? "、1曲目◎" : ""}
            {score.closerHit ? "、ラスト◎" : ""}
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-dusk">予想なし</p>
      )}
    </div>
  );
}
