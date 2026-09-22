"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { SHADOWS_OPENING } from "@/lib/event";
import type { PredictionResult, Slot, SongPrediction } from "@/lib/jev";
import { scoreSetlist } from "@/lib/scoring";
import { ALBUM_ORDER, SONGS, SONG_MAP, type Song } from "@/lib/songs";

type Mode = "mine" | "actual";
type Quick = "all" | "pops" | "staple" | "tieup";

interface Saved {
  mine: string[];
  actual: string[];
  rumors: string;
  jev: PredictionResult | null;
}

const STORAGE_KEY = "mga-setlist-oracle:v1";
const EMPTY: Saved = { mine: [], actual: [], rumors: "", jev: null };

const QUICK_FILTERS: { key: Quick; label: string; match: (s: Song) => boolean }[] = [
  { key: "all", label: "すべて", match: () => true },
  { key: "pops", label: "POPS 新曲", match: (s) => !!s.pops },
  { key: "staple", label: "ライブ定番", match: (s) => !!s.staple },
  { key: "tieup", label: "タイアップ", match: (s) => !!s.tieup },
];

const SLOT_LABEL: Record<Slot, string> = {
  opener: "Opening",
  middle: "Middle",
  encore: "Encore",
  skip: "Others",
};

/** 順送りリビール用の遅延インデックス */
const rise = (i: number) => ({ "--i": i }) as CSSProperties;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 公式 Schedule の「2026 09.30 (Wed)」表記 */
function formatEventDate(iso: string) {
  const [y, m, d] = iso.split("-");
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Tokyo" }).format(
    new Date(`${iso}T12:00:00+09:00`),
  );
  return { year: y, day: `${m}.${d}`, weekday };
}

export default function Page() {
  const [saved, setSaved] = useState<Saved>(EMPTY);
  const [mode, setMode] = useState<Mode>("mine");
  const [filter, setFilter] = useState("");
  const [quick, setQuick] = useState<Quick>("all");
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

  const size = SHADOWS_OPENING.setlistSize;
  const list = mode === "mine" ? saved.mine : saved.actual;
  const setList = (next: string[]) =>
    setSaved((s) => (mode === "mine" ? { ...s, mine: next } : { ...s, actual: next }));

  const full = mode === "mine" && list.length >= size;

  const toggle = (id: string) => {
    if (list.includes(id)) setList(list.filter((x) => x !== id));
    else if (!full) setList([...list, id]);
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
    const quickMatch = QUICK_FILTERS.find((f) => f.key === quick)?.match ?? (() => true);
    return ALBUM_ORDER.map((album) => {
      const songs = SONGS.filter(
        (s) => s.album === album && quickMatch(s) && (!q || s.title.toLowerCase().includes(q)),
      );
      const years = songs.map((s) => s.year);
      return { album, songs, from: Math.min(...years), to: Math.max(...years) };
    }).filter((g) => g.songs.length > 0);
  }, [filter, quick]);

  const shown = grouped.reduce((n, g) => n + g.songs.length, 0);

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
        body: JSON.stringify({ rumors: saved.rumors, setlistSize: size }),
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

  const clearActual = () => {
    if (window.confirm("入力した実セトリを消す？（俺の予想と Jev の予想は残る）")) {
      setSaved((s) => ({ ...s, actual: [] }));
    }
  };

  const hasActual = saved.actual.length > 0;
  const myScore = hasActual ? scoreSetlist(saved.mine, saved.actual) : null;
  const jevScore = hasActual && saved.jev ? scoreSetlist(saved.jev.setlist, saved.actual) : null;
  const winner =
    myScore && jevScore ? (myScore.points === jevScore.points ? "draw" : myScore.points > jevScore.points ? "mine" : "jev") : null;

  const date = formatEventDate(SHADOWS_OPENING.date);

  return (
    <>
      <a
        href="#songs-heading"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-20 focus:rounded-full focus:bg-deep focus:px-4 focus:py-2 focus:text-white"
      >
        全曲ライブラリへ飛ぶ
      </a>

      {/* ---- ヒーロー（ライムの帯） ---- */}
      <div className="band-lime">
        <div className="mx-auto max-w-7xl px-5 pb-14 pt-6 sm:px-8 lg:pb-20">
          <header className="rise flex items-center justify-between gap-4" style={rise(0)}>
            <div className="flex items-center gap-3">
              <AppleMark />
              <p className="latin text-lg font-bold tracking-tight text-deep sm:text-2xl">
                SHADOWS <span className="font-body text-base font-bold sm:text-lg">セトリ予想</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="latin hidden rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-deep sm:inline">
                Ringo Jam Tour
              </span>
              <span
                className="latin grid h-12 w-12 place-items-center rounded-full bg-white text-sm font-bold text-deep tabular-nums shadow-card"
                aria-label={`俺の予想 ${saved.mine.length} / ${size} 曲`}
              >
                {pad2(saved.mine.length)}
              </span>
            </div>
          </header>

          <section className="poster rise mt-6 px-7 py-12 sm:px-14 sm:py-16 lg:mt-8" style={rise(1)} aria-labelledby="tour-heading">
            <p className="kicker text-lime-light">Mrs. GREEN APPLE — Ringo Jam Tour</p>
            <h1 id="tour-heading" className="wordmark mt-3">
              SHADOWS
            </h1>
            <div className="mt-8 flex flex-wrap items-end gap-x-10 gap-y-5">
              <div>
                <p className="kicker text-lime-light">Day 1</p>
                <p className="latin mt-1 font-semibold leading-none tabular-nums">
                  <span className="text-base text-white/70">{date.year} </span>
                  <span className="text-4xl sm:text-5xl">{date.day}</span>
                  <span className="text-base text-white/70"> ({date.weekday})</span>
                </p>
              </div>
              <div>
                <p className="kicker text-lime-light">Venue</p>
                <p className="mt-1 text-lg font-bold leading-tight sm:text-xl">{SHADOWS_OPENING.venue}</p>
              </div>
              <div>
                <p className="kicker text-lime-light">Setlist</p>
                <p className="latin mt-1 text-lg font-semibold leading-tight sm:text-xl">
                  {size} songs <span className="font-body text-sm font-medium text-white/70">本編＋アンコール想定</span>
                </p>
              </div>
            </div>
            <p className="mt-8 max-w-prose text-sm leading-7 text-white/80 sm:text-base sm:leading-8">
              Mrs. GREEN APPLE の全 {SONGS.length} 曲から、初日のセットリストを当てる遊び。 {size} 曲まで選んで並べたら、
              TypeSafe の判断モデル <span className="latin font-bold text-lime-light">Jev</span> にも同じ条件で予想させる。
              ライブが終わったら実セトリを入れて答え合わせ。
            </p>
          </section>
        </div>
      </div>

      {/* ---- 本体（グレーの帯） ---- */}
      <main className="band-fog">
        <div className="mx-auto max-w-7xl px-5 pb-32 pt-12 sm:px-8 lg:pt-16">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-10">
            {/* ---- 全曲ライブラリ ---- */}
            <section aria-labelledby="songs-heading" className="rise" style={rise(2)}>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 id="songs-heading" className="section-title scroll-mt-6">
                    Library
                  </h2>
                  <p className="mt-1 text-sm font-bold text-dusk">
                    全曲{" "}
                    <span className="latin tabular-nums">{shown === SONGS.length ? SONGS.length : `${shown} / ${SONGS.length}`}</span>
                  </p>
                </div>
                <label className="block w-full sm:w-64">
                  <span className="sr-only">曲名で絞る</span>
                  <input
                    type="search"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="曲名で絞る…"
                    name="filter"
                    autoComplete="off"
                    className="field"
                  />
                </label>
              </div>

              <div className="mb-6 flex flex-wrap items-center gap-3">
                <div className="seg" role="tablist" aria-label="どのリストに入れるか">
                  {(["mine", "actual"] as const).map((m) => (
                    <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>
                      {m === "mine" ? "俺の予想に入れる" : "実セトリを入力"}
                    </button>
                  ))}
                </div>
                <div className="seg" role="group" aria-label="クイックフィルタ">
                  {QUICK_FILTERS.map((f) => (
                    <button key={f.key} type="button" aria-pressed={quick === f.key} onClick={() => setQuick(f.key)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {mode === "actual" && (
                <p className="card mb-5 border-l-4 border-teal px-4 py-3 text-sm leading-6 text-dusk">
                  いま押した曲は<span className="font-bold text-deep">実セトリ</span>に、演奏順で積まれる。
                  入力した瞬間に右の Result で採点される。
                </p>
              )}
              {full && (
                <p className="card mb-5 border-l-4 border-lime px-4 py-3 text-sm leading-6 text-dusk" role="status">
                  {size} 曲そろった。入れ替えるなら、まず My Setlist から 1 曲外す。
                </p>
              )}

              {grouped.length === 0 ? (
                <p className="card px-6 py-16 text-center text-sm text-dusk">
                  該当する曲が無い。表記を変えるか、フィルタを「すべて」に戻す。
                </p>
              ) : (
                <div className="space-y-4">
                  {grouped.map(({ album, songs, from, to }) => (
                    <div key={album} className="card p-5 sm:p-6">
                      <h3 className="mb-4 flex items-baseline gap-3">
                        <span className="latin text-lg font-bold text-deep">{album === "single" ? "Singles" : album}</span>
                        <span className="latin text-xs font-bold text-teal tabular-nums">
                          {from === to ? from : `${from}–${to}`} · {songs.length}
                        </span>
                        {album === "single" && <span className="text-xs font-bold text-dusk">シングル・配信</span>}
                      </h3>
                      <ul className="flex flex-wrap gap-2">
                        {songs.map((s) => {
                          const idx = list.indexOf(s.id);
                          const on = idx >= 0;
                          const jp = jevBySong.get(s.id);
                          return (
                            <li key={s.id}>
                              <button
                                type="button"
                                onClick={() => toggle(s.id)}
                                aria-pressed={on}
                                disabled={!on && full}
                                title={s.tieup ?? `${s.year}年`}
                                className={`chip ${on ? "chip-on" : ""} disabled:cursor-not-allowed disabled:opacity-40`}
                              >
                                {on && <span className="chip-num">{idx + 1}</span>}
                                <span>{s.title}</span>
                                {s.pops && <span className="tag-new">NEW</span>}
                                {jp && !on && (
                                  <span className="chip-meta" aria-label={`Jev の見込み ${Math.round(jp.likelihood * 100)}%`}>
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
              )}
            </section>

            {/* ---- 予想と答え合わせ ---- */}
            <div className="rail space-y-6">
              <section className="card rise p-6" aria-labelledby="mine-heading" style={rise(3)}>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 id="mine-heading" className="section-title scroll-mt-6">
                      My Setlist
                    </h2>
                    <p className="mt-1 text-sm font-bold text-dusk">俺の予想</p>
                  </div>
                  <p className="latin text-3xl font-bold text-deep tabular-nums">
                    {pad2(saved.mine.length)}
                    <span className="text-base text-dusk"> / {size}</span>
                  </p>
                </div>
                <div
                  className="bar mt-4"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={size}
                  aria-valuenow={saved.mine.length}
                  aria-label="選んだ曲数"
                >
                  <span className="bar-fill" style={{ width: `${Math.min(100, (saved.mine.length / size) * 100)}%` }} />
                </div>
                <SetlistView
                  ids={saved.mine}
                  actual={saved.actual}
                  editable={mode === "mine"}
                  onMove={move}
                  onRemove={(id) => setSaved((s) => ({ ...s, mine: s.mine.filter((x) => x !== id) }))}
                  empty="Library で曲を押すと、ここに演奏順で積まれていく。"
                />
              </section>

              <section className="card rise p-6" aria-labelledby="jev-heading" style={rise(4)}>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 id="jev-heading" className="section-title">
                      Jev&apos;s Call
                    </h2>
                    <p className="mt-1 text-sm font-bold text-dusk">Jev の予想</p>
                  </div>
                  {saved.jev && (
                    <p className="latin text-3xl font-bold text-deep tabular-nums">
                      {pad2(saved.jev.setlist.length)}
                      <span className="text-base text-dusk"> / {size}</span>
                    </p>
                  )}
                </div>

                <label className="mt-5 block text-sm">
                  <span className="font-bold text-dusk">匂わせ・話題メモ（Jev の判断材料に足す）</span>
                  <textarea
                    value={saved.rumors}
                    onChange={(e) => setSaved((s) => ({ ...s, rumors: e.target.value }))}
                    rows={3}
                    placeholder="例: テレビ×ミセスで大森がインディーズ曲やりたいと言ってた / リハ音漏れで Soranji…"
                    name="rumors"
                    autoComplete="off"
                    className="field mt-2 resize-y"
                  />
                </label>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={askJev} disabled={loading} className="btn-primary" aria-busy={loading}>
                    {loading ? "Jev が全曲を採点中…" : saved.jev ? "もう一回予想させる" : "Jev に予想させる"}
                    <span aria-hidden="true">›</span>
                  </button>
                  <span className="text-xs text-dusk">全曲を 20 曲ずつ並列で判断。1 回に数十秒。</span>
                </div>
                {error && (
                  <p className="mt-4 rounded-[10px] border-l-4 border-rouge bg-fog px-4 py-3 text-sm text-rouge" role="alert">
                    {error}
                  </p>
                )}

                <div aria-live="polite">
                  {saved.jev && (
                    <>
                      <SetlistView ids={saved.jev.setlist} actual={saved.actual} editable={false} likelihood={jevBySong} empty="" />
                      <p className="latin mt-4 text-xs font-semibold text-dusk">
                        {saved.jev.model} · in {saved.jev.usage.input_tokens.toLocaleString()} · out{" "}
                        {saved.jev.usage.output_tokens.toLocaleString()} tokens
                      </p>
                    </>
                  )}
                </div>
              </section>

              <section className={`card rise p-6 ${hasActual ? "band-lime" : ""}`} aria-labelledby="result-heading" style={rise(5)}>
                <h2 id="result-heading" className="section-title">
                  Result
                </h2>
                <p className="mt-1 text-sm font-bold text-dusk">答え合わせ</p>
                {!hasActual ? (
                  <>
                    <p className="mt-4 text-sm leading-7 text-dusk">
                      ライブが終わったら「実セトリを入力」に切り替えて、演奏順に曲を押していく。入力した瞬間に採点される。
                    </p>
                    {mode === "mine" && (
                      <button type="button" onClick={() => setMode("actual")} className="btn-ghost mt-4">
                        実セトリを入力する
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm font-bold text-deep">
                      実セトリ <span className="latin text-base tabular-nums">{saved.actual.length}</span> 曲
                    </p>
                    <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <ScoreCard label="俺" en="You" score={myScore} win={winner === "mine"} />
                      <span className="latin text-xl font-bold text-deep">vs</span>
                      <ScoreCard label="Jev" en="Jev" score={jevScore} win={winner === "jev"} />
                    </div>
                    {winner && (
                      <p className="mt-5 text-center text-lg font-black text-deep" role="status">
                        {winner === "draw" ? "引き分け" : winner === "mine" ? "俺の勝ち" : "Jev の勝ち"}
                      </p>
                    )}
                    <p className="mt-4 text-xs leading-6 text-deep/70">
                      曲一致 10 点、順番 ±2 以内で +5、1 曲目とラスト曲の的中は各 +15。
                    </p>
                    <button type="button" onClick={clearActual} className="btn-ghost mt-4">
                      実セトリを消す
                    </button>
                  </>
                )}
              </section>
            </div>
          </div>
        </div>

        {/* スマホ: ライブラリを見ながら自分のリストへ飛べる下部バー */}
        <a href="#mine-heading" className="dock lg:hidden" aria-label="俺の予想へ移動">
          <span className="kicker">{mode === "mine" ? "My Setlist" : "Actual"}</span>
          <span className="latin text-xl font-bold tabular-nums">
            {pad2(list.length)}
            {mode === "mine" && <span className="text-dusk"> / {size}</span>}
          </span>
          <span className="bar flex-1">
            <span className="bar-fill" style={{ width: `${Math.min(100, (list.length / size) * 100)}%` }} />
          </span>
          <span className="text-sm text-dusk" aria-hidden="true">
            ↓
          </span>
        </a>
      </main>
    </>
  );
}

/** 青りんごのマーク。公式ロゴは使わないので自前の簡素な形 */
function AppleMark() {
  return (
    <svg viewBox="0 0 64 64" className="h-10 w-10" aria-hidden="true">
      <circle cx="32" cy="37" r="17" fill="#002928" />
      <path d="M33 21c1-6 5-9 10-9-1 6-5 9-10 9z" fill="#002928" />
      <path d="M32 21V14" stroke="#002928" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="26" cy="33" r="4" fill="#e2ff91" />
    </svg>
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
  if (ids.length === 0) return empty ? <p className="mt-5 text-sm leading-7 text-dusk">{empty}</p> : null;
  const actualSet = new Set(actual);
  const judged = actual.length > 0;

  // Jev の並びはスロット順なので、スロットが切り替わる所に小見出しを挟む
  const rows: React.ReactNode[] = [];
  let lastSlot: Slot | null = null;
  ids.forEach((id, i) => {
    const s = SONG_MAP.get(id);
    const p = likelihood?.get(id);
    if (p && p.slot !== lastSlot) {
      lastSlot = p.slot;
      rows.push(
        <li key={`slot-${p.slot}`} className="slot-label" aria-hidden="true">
          {SLOT_LABEL[p.slot]}
        </li>,
      );
    }
    const hit = judged && actualSet.has(id);
    rows.push(
      <li key={id} className={`track ${judged ? (hit ? "track-hit" : "track-miss") : ""}`}>
        <span className="track-num">{pad2(i + 1)}</span>
        <span className="track-title min-w-0 flex-1 truncate">
          {s?.title ?? id}
          {judged && <span className="sr-only">{hit ? "（的中）" : "（外れ）"}</span>}
        </span>
        {p && (
          <span
            className="flex w-24 shrink-0 items-center gap-2"
            title={`見込み ${Math.round(p.likelihood * 100)}% / 確信度 ${Math.round(p.confidence * 100)}%`}
          >
            <span className="bar flex-1 bg-white">
              <span className="bar-fill" style={{ width: `${Math.round(p.likelihood * 100)}%` }} />
            </span>
            <span className="latin w-7 text-right text-xs font-bold text-dusk tabular-nums">{Math.round(p.likelihood * 100)}</span>
          </span>
        )}
        {editable && onMove && onRemove && (
          <span className="flex shrink-0 gap-0.5">
            <button type="button" className="icon-btn" aria-label={`${s?.title ?? id} を上へ`} onClick={() => onMove(i, -1)} disabled={i === 0}>
              ↑
            </button>
            <button type="button" className="icon-btn" aria-label={`${s?.title ?? id} を下へ`} onClick={() => onMove(i, 1)} disabled={i === ids.length - 1}>
              ↓
            </button>
            <button type="button" className="icon-btn" aria-label={`${s?.title ?? id} を外す`} onClick={() => onRemove(id)}>
              ×
            </button>
          </span>
        )}
      </li>,
    );
  });

  return <ol className="mt-5 space-y-1.5">{rows}</ol>;
}

function ScoreCard({ label, en, score, win }: { label: string; en: string; score: ReturnType<typeof scoreSetlist> | null; win: boolean }) {
  return (
    <div className={`card p-4 text-center ${win ? "score-win" : ""}`}>
      <p className="kicker">{en}</p>
      <p className="text-sm font-bold text-deep">{label}</p>
      {score ? (
        <>
          <p className="score-num mt-2">{score.points}</p>
          <p className="mt-3 text-xs leading-5 text-dusk">
            {score.hits}/{score.total} 曲一致 · 順番 {score.positionHits}
            {score.openerHit ? " · 1曲目◎" : ""}
            {score.closerHit ? " · ラスト◎" : ""}
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-dusk">予想なし</p>
      )}
    </div>
  );
}
