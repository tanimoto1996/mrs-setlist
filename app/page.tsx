"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ALBUM_DEBUT_STATS, projectNewAlbumSongs } from "@/lib/album-stats";
import { SHADOWS_OPENING } from "@/lib/event";
import type { Engine, PredictionResult, Slot, SongPrediction } from "@/lib/jev";
import { scoreSetlist, type ScoreBreakdown } from "@/lib/scoring";
import { ALBUM_ORDER, SONGS, SONG_MAP, type Song } from "@/lib/songs";
import { TOUR_STATS, projectCarriedSongs, recentTours, tourOf } from "@/lib/tour-stats";

type Mode = "mine" | "actual";
type Quick = "all" | "pops" | "staple" | "tieup" | "lastTour";

interface Saved {
  mine: string[];
  actual: string[];
  rumors: string;
  jev: PredictionResult | null;
  /** Gemini の予想。v1 のまま後から足したキーなので、読み込み時は EMPTY とのマージで null に埋まる */
  gemini: PredictionResult | null;
}

const STORAGE_KEY = "mga-setlist-oracle:v1";
const EMPTY: Saved = { mine: [], actual: [], rumors: "", jev: null, gemini: null };

/** 採点に参加するのは俺と各エンジン */
type Contestant = "mine" | Engine;

const WINNER_LABEL: Record<Contestant | "draw", string> = {
  mine: "俺の勝ち",
  jev: "Jev の勝ち",
  gemini: "Gemini の勝ち",
  draw: "引き分け",
};

const QUICK_FILTERS: { key: Quick; label: string; match: (s: Song) => boolean }[] = [
  { key: "all", label: "すべて", match: () => true },
  { key: "pops", label: "POPS 新曲", match: (s) => !!s.pops },
  { key: "staple", label: "ライブ定番", match: (s) => !!s.staple },
  { key: "tieup", label: "タイアップ", match: (s) => !!s.tieup },
  // 前回のワンマンツアー（lib/tour-stats.json の直近）で 1 回でも演奏された曲
  { key: "lastTour", label: "前回ツアー", match: (s) => !!TOUR_STATS.songs[s.id]?.playedIn[0] },
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

const pct = (p: SongPrediction) => Math.round(p.likelihood * 100);

const pctOf = (x: number) => `${Math.round(x * 100)}%`;

const today = () => new Date().toISOString().slice(0, 10);

/** 曲 id → 予想。チップの % とセトリ行のバーに使う */
function indexBySong(result: PredictionResult | null) {
  const m = new Map<string, SongPrediction>();
  result?.predictions.forEach((p) => m.set(p.songId, p));
  return m;
}

/** 予想がある参加者が 2 人以上いるときだけ勝敗を出す。最高点が並んだら引き分け */
function pickWinner(scores: Record<Contestant, ScoreBreakdown | null>): Contestant | "draw" | null {
  const entries = (Object.entries(scores) as [Contestant, ScoreBreakdown | null][]).filter(
    (e): e is [Contestant, ScoreBreakdown] => e[1] !== null,
  );
  if (entries.length < 2) return null;
  const top = Math.max(...entries.map(([, s]) => s.points));
  const leaders = entries.filter(([, s]) => s.points === top);
  return leaders.length === 1 ? leaders[0][0] : "draw";
}

/**
 * 予想を JSON ファイルとして保存する。
 * scripts/screenshot-setlist.ts（画像化）や /score-setlist --predicted（採点）にそのまま渡せる形
 */
function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
  /** いま予想中のエンジン。両方いっぺんには走らせない */
  const [loading, setLoading] = useState<Engine | null>(null);
  const [errors, setErrors] = useState<Record<Engine, string | null>>({ jev: null, gemini: null });
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

  const jevBySong = useMemo(() => indexBySong(saved.jev), [saved.jev]);
  const geminiBySong = useMemo(() => indexBySong(saved.gemini), [saved.gemini]);

  /** 同じ /api/predict に engine だけ変えて投げる。匂わせメモと曲数は共通 */
  const ask = async (engine: Engine) => {
    setLoading(engine);
    setErrors((prev) => ({ ...prev, [engine]: null }));
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rumors: saved.rumors, setlistSize: size, engine }),
      });
      const data = (await res.json()) as PredictionResult | { error: string };
      if (!res.ok || "error" in data) throw new Error("error" in data ? data.error : "予想に失敗");
      setSaved((s) => ({ ...s, [engine]: data }));
    } catch (e) {
      setErrors((prev) => ({ ...prev, [engine]: e instanceof Error ? e.message : "予想に失敗" }));
    } finally {
      setLoading(null);
    }
  };

  const clearActual = () => {
    if (window.confirm("入力した実セトリを消す？（俺・Jev・Gemini の予想は残る）")) {
      setSaved((s) => ({ ...s, actual: [] }));
    }
  };

  const hasActual = saved.actual.length > 0;
  const scores: Record<Contestant, ScoreBreakdown | null> = {
    mine: hasActual ? scoreSetlist(saved.mine, saved.actual) : null,
    jev: hasActual && saved.jev ? scoreSetlist(saved.jev.setlist, saved.actual) : null,
    gemini: hasActual && saved.gemini ? scoreSetlist(saved.gemini.setlist, saved.actual) : null,
  };
  const winner = pickWinner(scores);

  /** Jev と Gemini が同じ曲を何曲選んだか（予想同士の近さの目安） */
  const overlap = useMemo(() => {
    if (!saved.jev || !saved.gemini) return null;
    const jevSet = new Set(saved.jev.setlist);
    return saved.gemini.setlist.filter((id) => jevSet.has(id)).length;
  }, [saved.jev, saved.gemini]);

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
              Google の <span className="latin font-bold text-lime-light">Gemini</span> にも同じ前提を渡して、精度を比べる。
              ライブが終わったら実セトリを入れて答え合わせ。
            </p>
          </section>
        </div>
      </div>

      {/* ---- 本体（グレーの帯） ----
          aria-busy は localStorage から予想を読み戻すまで true。E2E（e2e/fixtures.ts の ui.open）はこれが false になるのを待つ */}
      <main className="band-fog" aria-busy={!hydrated}>
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
                  {(saved.jev || saved.gemini) && (
                    <p className="mt-1 text-xs font-bold text-dusk">
                      チップの % は演奏見込み{saved.jev && <span className="text-teal"> · 緑 = Jev</span>}
                      {saved.gemini && <span className="text-cobalt"> · 青 = Gemini</span>}
                    </p>
                  )}
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
                          const gp = geminiBySong.get(s.id);
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
                                  <span className="chip-meta" aria-label={`Jev の見込み ${pct(jp)}%`}>
                                    {pct(jp)}%
                                  </span>
                                )}
                                {gp && !on && (
                                  <span className="chip-meta-alt" aria-label={`Gemini の見込み ${pct(gp)}%`}>
                                    {pct(gp)}%
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
              <NewAlbumOdds setlistSize={size} />
              <TourCarryover />

              <section className="card rise p-6" aria-labelledby="mine-heading" style={rise(4)}>
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

              <section className="card rise p-6" aria-labelledby="jev-heading" style={rise(5)}>
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
                  <span className="font-bold text-dusk">匂わせ・話題メモ（Jev / Gemini 共通の判断材料に足す）</span>
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
                  <button
                    type="button"
                    onClick={() => ask("jev")}
                    disabled={loading !== null}
                    className="btn-primary"
                    aria-busy={loading === "jev"}
                  >
                    {loading === "jev" ? "Jev が全曲を採点中…" : saved.jev ? "もう一回予想させる" : "Jev に予想させる"}
                    <span aria-hidden="true">›</span>
                  </button>
                  {saved.jev && (
                    <button type="button" onClick={() => downloadJson(`jev-${today()}.json`, saved.jev)} className="btn-ghost">
                      JSON を保存
                    </button>
                  )}
                  <span className="text-xs text-dusk">全曲を 20 曲ずつ並列で判断。1 回に数十秒。</span>
                </div>
                {errors.jev && (
                  <p className="mt-4 rounded-[10px] border-l-4 border-rouge bg-fog px-4 py-3 text-sm text-rouge" role="alert">
                    {errors.jev}
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

              <section className="card rise p-6" aria-labelledby="gemini-heading" style={rise(6)}>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 id="gemini-heading" className="section-title">
                      Gemini&apos;s Call
                    </h2>
                    <p className="mt-1 text-sm font-bold text-dusk">Gemini の予想</p>
                  </div>
                  {saved.gemini && (
                    <p className="latin text-3xl font-bold text-deep tabular-nums">
                      {pad2(saved.gemini.setlist.length)}
                      <span className="text-base text-dusk"> / {size}</span>
                    </p>
                  )}
                </div>

                <p className="mt-4 text-sm leading-6 text-dusk">
                  Jev と同じ前提・同じ 4 段階の物差しを Google の <span className="latin font-bold text-deep">Gemini</span> に一括で渡す。
                  Gemini は曲の知識も持っているので、判断モデルの Jev とどれだけ違うかを見る用。匂わせメモは上と共通。
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => ask("gemini")}
                    disabled={loading !== null}
                    className="btn-primary"
                    aria-busy={loading === "gemini"}
                  >
                    {loading === "gemini" ? "Gemini が全曲を採点中…" : saved.gemini ? "もう一回予想させる" : "Gemini に予想させる"}
                    <span aria-hidden="true">›</span>
                  </button>
                  {saved.gemini && (
                    <button type="button" onClick={() => downloadJson(`gemini-${today()}.json`, saved.gemini)} className="btn-ghost">
                      JSON を保存
                    </button>
                  )}
                  <span className="text-xs text-dusk">全曲を 1 リクエストで判断。1 回に数十秒。</span>
                </div>
                {errors.gemini && (
                  <p className="mt-4 rounded-[10px] border-l-4 border-rouge bg-fog px-4 py-3 text-sm text-rouge" role="alert">
                    {errors.gemini}
                  </p>
                )}

                <div aria-live="polite">
                  {saved.gemini && (
                    <>
                      <SetlistView ids={saved.gemini.setlist} actual={saved.actual} editable={false} likelihood={geminiBySong} empty="" />
                      <p className="latin mt-4 text-xs font-semibold text-dusk">
                        {saved.gemini.model} · in {saved.gemini.usage.input_tokens.toLocaleString()} · out{" "}
                        {saved.gemini.usage.output_tokens.toLocaleString()} tokens
                      </p>
                      {overlap !== null && (
                        <p className="mt-2 text-xs font-bold text-dusk">
                          Jev と同じ曲 <span className="latin tabular-nums">{overlap} / {saved.gemini.setlist.length}</span>
                        </p>
                      )}
                    </>
                  )}
                </div>
              </section>

              <section className={`card rise p-6 ${hasActual ? "band-lime" : ""}`} aria-labelledby="result-heading" style={rise(7)}>
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
                    <div
                      className={`mt-5 grid items-center ${
                        saved.gemini ? "grid-cols-[1fr_auto_1fr_auto_1fr] gap-2" : "grid-cols-[1fr_auto_1fr] gap-3"
                      }`}
                    >
                      <ScoreCard label="俺" en="You" score={scores.mine} win={winner === "mine"} />
                      <span className="latin text-xl font-bold text-deep">vs</span>
                      <ScoreCard label="Jev" en="Jev" score={scores.jev} win={winner === "jev"} />
                      {saved.gemini && (
                        <>
                          <span className="latin text-xl font-bold text-deep">vs</span>
                          <ScoreCard label="Gemini" en="Gemini" score={scores.gemini} win={winner === "gemini"} />
                        </>
                      )}
                    </div>
                    {winner && (
                      <p className="mt-5 text-center text-lg font-black text-deep" role="status">
                        {WINNER_LABEL[winner]}
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

/**
 * フルアルバム発売直後のツアーで新譜曲がセトリを占めた割合（setlist.fm の過去実績）と、この公演での目安。
 * 同じ数字を lib/jev.ts の buildState() が Jev / Gemini の前提（newAlbumHistory）として渡している。
 */
function NewAlbumOdds({ setlistSize }: { setlistSize: number }) {
  const album = SHADOWS_OPENING.newAlbum ?? "POPS";
  const projection = projectNewAlbumSongs(album, setlistSize);
  const history = ALBUM_DEBUT_STATS.albums.filter((a) => a.status !== "upcoming");
  const measured = ALBUM_DEBUT_STATS.albums.filter((a) => a.status === "measured" && a.firstShow);
  const latest = measured.at(-1);
  const hasManual = measured.some((a) => a.firstShow?.source === "manual");
  const title = (id: string) => SONG_MAP.get(id)?.title ?? id;
  const range =
    projection.expectedLow === null || projection.expectedHigh === null
      ? null
      : projection.expectedLow === projection.expectedHigh
        ? `${projection.expectedLow}`
        : `${projection.expectedLow}〜${projection.expectedHigh}`;

  return (
    <section className="card rise p-6" aria-labelledby="odds-heading" style={rise(3)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="odds-heading" className="section-title">
            New Album Odds
          </h2>
          <p className="mt-1 text-sm font-bold text-dusk">フルアルバム発売直後のツアーで、新譜曲はセトリの何割か</p>
        </div>
        {projection.meanShare !== null && (
          <p className="text-right">
            <span className="latin block text-3xl font-bold text-deep tabular-nums" aria-label={`初日の新譜曲比率の平均 ${pctOf(projection.meanShare)}`}>
              {pctOf(projection.meanShare)}
            </span>
            {projection.latestShare !== null && (
              <span className="latin text-xs font-bold text-teal tabular-nums">
                {projection.latestAlbum} {pctOf(projection.latestShare)}
              </span>
            )}
          </p>
        )}
      </div>

      {projection.meanShare !== null && range !== null ? (
        <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm font-bold leading-6 text-deep">
          <span className="latin">{album}</span> から約 {range} 曲 / {setlistSize} 曲が入る目安（直近 {projection.latestAlbum} の比率〜過去 {measured.length} 枚の平均）。
          収録 {projection.trackCount} 曲 = 先行シングル {projection.preReleased.length}（演奏実績あり）＋ アルバム初出 {projection.albumOnly.length}。
        </p>
      ) : (
        <p className="mt-4 text-sm leading-6 text-dusk">過去のフルアルバムで測れたツアーが無いので、目安を出せない。</p>
      )}

      <ul className="mt-4 divide-y divide-line text-sm">
        {history.map((a) => (
          <li key={a.album} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
            <span className="latin font-bold text-deep">
              {a.album} <span className="text-xs text-teal tabular-nums">{a.released.slice(0, 4)}</span>
            </span>
            {a.status === "measured" && a.firstShow && a.tour ? (
              <span className="text-dusk tabular-nums">
                初日 {a.firstShow.newAlbumSongs}/{a.firstShow.songs} 曲 · {pctOf(a.firstShow.newAlbumShare)} · ツアー {a.tour.shows} 公演平均{" "}
                {pctOf(a.tour.avgNewAlbumShare)}
                {a.firstShow.source === "manual" && (
                  <a href={a.firstShow.url} target="_blank" rel="noreferrer" className="ml-1 text-xs text-teal underline" aria-label={`${a.album} 初日セトリの出典`}>
                    出典
                  </a>
                )}
              </span>
            ) : (
              <span className="text-xs text-dusk">setlist.fm にツアーのデータ無し</span>
            )}
          </li>
        ))}
      </ul>

      {latest?.firstShow && (
        <p className="mt-3 text-xs leading-5 text-dusk">
          直近の {latest.album} 初日は先行シングル {latest.firstShow.preReleasedPlayed}/{latest.preReleased.length}、アルバム初出{" "}
          {latest.firstShow.albumOnlyPlayed}/{latest.albumOnly.length} が演奏された。
          今回の先行シングルは {projection.preReleased.map(title).join(" / ")}。 この目安は Jev と Gemini の前提にも渡している。
          {hasManual && " setlist.fm に無い公演は LiveFans などの公開セトリから手で起こした（「出典」リンク）。"}
        </p>
      )}
    </section>
  );
}

/**
 * 連続するツアーの間で曲がどれだけ持ち越されたか（setlist.fm の過去実績）と、前回ツアーから残る曲数の目安。
 * 同じ数字を lib/jev.ts の buildTourHistory() が Jev / Gemini の前提（tourHistory）として渡している。
 */
function TourCarryover() {
  const s = TOUR_STATS.summary;
  const carried = projectCarriedSongs();
  const recent = recentTours();
  const fc = tourOf(s.lastFanClubTour);
  const title = (id: string) => SONG_MAP.get(id)?.title ?? id;
  const r3 = s.carriedRateByStreak["3+"];
  const r1 = s.carriedRateByStreak["1"];

  return (
    <section className="card rise p-6" aria-labelledby="carryover-heading" style={rise(3)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="carryover-heading" className="section-title">
            Tour Carryover
          </h2>
          <p className="mt-1 text-sm font-bold text-dusk">前のツアーの曲は、次のツアーにどれだけ残るか</p>
        </div>
        {s.carriedShare && (
          <p className="text-right">
            <span className="latin block text-3xl font-bold text-deep tabular-nums" aria-label={`持ち越し率の平均 ${pctOf(s.carriedShare.mean)}`}>
              {pctOf(s.carriedShare.mean)}
            </span>
            {r3 !== null && <span className="latin text-xs font-bold text-teal tabular-nums">連続 3 本以上の曲は {pctOf(r3)}</span>}
          </p>
        )}
      </div>

      {carried && s.carriedShare ? (
        <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm font-bold leading-6 text-deep">
          前回 <span className="latin">{carried.tour.shortName}</span>（{carried.tour.distinctSongs} 曲）からは {carried.mean} 曲前後（{carried.low}〜{carried.high} 曲）が残る目安。過去 {s.pairs} 組の持ち越し率は{" "}
          {pctOf(s.carriedShare.min)}〜{pctOf(s.carriedShare.max)}。
          {s.freshReturnedShare !== null && <> 新顔の {pctOf(s.freshReturnedShare)} は 1〜2 ツアー空けた曲の復活。</>}
        </p>
      ) : (
        <p className="mt-4 text-sm leading-6 text-dusk">比べられるツアーが 2 本無いので、目安を出せない。</p>
      )}

      <ul className="mt-4 divide-y divide-line text-sm">
        {TOUR_STATS.pairs.map((p) => {
          const next = tourOf(p.next);
          return (
            <li key={p.next} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
              <span className="font-bold text-deep">
                {p.prevName} → {p.nextName}
                {next?.fanClubOnly && <span className="ml-1 text-xs text-teal">FC</span>}
              </span>
              <span className="text-dusk tabular-nums">
                持ち越し {p.carried}/{p.nextSongs} 曲 · {pctOf(p.carriedShare)} · 復活 {p.freshReturned} · 初登場 {p.freshFirstTime}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs leading-5 text-dusk">
        {r1 !== null && r3 !== null && <>前のツアーで連続 1 本だけの曲は {pctOf(r1)}、3 本以上続いた曲は {pctOf(r3)} が次も演奏された。 </>}
        {s.playedInAllRecent.length > 0 && <>直近 {recent.length} ツアー全部で演奏: {s.playedInAllRecent.map(title).join(" / ")}。 </>}
        {fc && <>前回の FC 限定ツアー {fc.shortName} は平均 {Math.round(fc.avgSongs * 10) / 10} 曲。 </>}
        Library の「前回ツアー」で前回の曲だけ出せる。この数字は Jev と Gemini の前提にも渡している。
      </p>
    </section>
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

  // Jev / Gemini の並びはスロット順なので、スロットが切り替わる所に小見出しを挟む。
  // 並べ替え（lib/jev.ts の toSetlist）は skip を middle 扱いにしているので、表示も同じ扱いにしないと
  // Middle / Others が交互に出て見出しが重複する（key の重複警告にもなる）
  const rows: React.ReactNode[] = [];
  let lastSlot: Slot | null = null;
  ids.forEach((id, i) => {
    const s = SONG_MAP.get(id);
    const p = likelihood?.get(id);
    const slot: Slot | null = p ? (p.slot === "skip" ? "middle" : p.slot) : null;
    if (slot && slot !== lastSlot) {
      lastSlot = slot;
      rows.push(
        <li key={`slot-${slot}-${i}`} className="slot-label" aria-hidden="true">
          {SLOT_LABEL[slot]}
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
