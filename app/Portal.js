"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { FIELDS, SYN, termsOf, termRegex, scoreArt, lineClass, sensitiveCheck, artKey } from "../lib/rulecore.mjs";

const LETTERS = "가나다라마바사아자차카타파하".split("");
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

function Hl({ text, re }) {
  if (!re || !text) return text || null;
  return String(text).split(re).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}

function Compass() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M16 6 L20 16 L16 26 L12 16 Z" fill="currentColor" opacity=".35" />
      <path d="M16 6 L20 16 L12 16 Z" fill="currentColor" />
    </svg>
  );
}

/* ---------- 추천 키워드 순위 ---------- */
function useRanking(rules, tick) {
  return useMemo(() => {
    const weight = {};
    rules.forEach((r) => (r.keywords || []).forEach((k, i) => { weight[k] = Math.max(weight[k] || 0, Math.max(10 - i * 0.5, 3)); }));
    const logs = typeof window === "undefined" ? {} : store.get("rc_logs", {});
    const now = Date.now();
    Object.keys(logs).forEach((k) => { if (!(k in weight)) weight[k] = 0; });
    const rows = Object.keys(weight).map((k) => {
      const L = logs[k] || { s: [], c: 0 };
      const s7 = (L.s || []).filter((t) => now - t < 7 * 864e5).length;
      return { k, score: 0.5 * s7 + 0.3 * (L.c || 0) + 0.2 * weight[k] };
    }).sort((a, b) => b.score - a.score).slice(0, 10);
    const prev = typeof window === "undefined" ? null : store.get("rc_prevrank", null);
    return rows.map((x, i) => {
      let d = "";
      if (prev) { const p = prev.indexOf(x.k); d = p < 0 ? "NEW" : p > i ? "▲" + (p - i) : p < i ? "▼" + (i - p) : "–"; }
      return { ...x, rank: i + 1, d };
    });
  }, [rules, tick]);
}
function logSearch(q) {
  const k = q.trim(); if (!k) return;
  const logs = store.get("rc_logs", {}); const now = Date.now();
  logs[k] = logs[k] || { s: [], c: 0 };
  logs[k].s = [...(logs[k].s || []), now].filter((t) => now - t < 7 * 864e5).slice(-200);
  store.set("rc_logs", logs);
}
function logClick(q) {
  const k = q.trim(); if (!k) return;
  const logs = store.get("rc_logs", {}); logs[k] = logs[k] || { s: [], c: 0 }; logs[k].c = (logs[k].c || 0) + 1; store.set("rc_logs", logs);
}

/* ---------- 검색창 + 자동완성 ---------- */
function SearchBox({ id, rules, ranking, initial, onSearch, big }) {
  const [v, setV] = useState(initial || "");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(-1);
  useEffect(() => { setV(initial || ""); }, [initial]);
  const items = useMemo(() => {
    const n = v.replace(/\s+/g, ""); if (!n) return [];
    const out = [];
    ranking.forEach((x) => { if (x.k.replace(/\s+/g, "").includes(n)) out.push({ label: x.k, tag: "추천 " + x.rank + "위", q: x.k }); });
    Object.keys(SYN).forEach((k) => { if (k.includes(n) && !out.some((o) => o.q === k)) out.push({ label: k, tag: "동의어", q: k }); });
    rules.forEach((r) => { if (r.name.replace(/\s+/g, "").includes(n)) out.push({ label: r.name, tag: r.kind, q: r.name, ruleId: r.id }); });
    return out.slice(0, 8);
  }, [v, rules, ranking]);
  const re = useMemo(() => termRegex([v.trim()]), [v]);
  const go = (q, item) => { setOpen(false); setV(q); onSearch(q, item); };
  return (
    <div className="searchbox">
      <form role="search" onSubmit={(e) => { e.preventDefault(); if (sel >= 0 && open && items[sel]) go(items[sel].q, items[sel]); else go(v); }}>
        <input
          id={id} type="search" autoComplete="off" value={v} aria-label="규정 검색"
          placeholder={big ? "궁금한 걸 그대로 물어보세요 (예: 데이터센터도 이 훈령 적용 대상이야?)" : "키워드나 질문"}
          onChange={(e) => { setV(e.target.value); setOpen(true); setSel(-1); }}
          onKeyDown={(e) => {
            if (!open || !items.length) return;
            if (e.key === "ArrowDown") { setSel((s) => Math.min(items.length - 1, s + 1)); e.preventDefault(); }
            else if (e.key === "ArrowUp") { setSel((s) => Math.max(-1, s - 1)); e.preventDefault(); }
            else if (e.key === "Escape") setOpen(false);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        <button className="go" type="submit">검색</button>
      </form>
      {open && items.length > 0 && (
        <div className="ac" role="listbox">
          {items.map((c, i) => (
            <button key={i} type="button" role="option" aria-selected={i === sel} onMouseDown={(e) => { e.preventDefault(); go(c.q, c); }}>
              <span><Hl text={c.label} re={re} /></span><span className="tag">{c.tag}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- 메인 ---------- */
export default function Portal({ rules }) {
  const ruleById = useMemo(() => Object.fromEntries(rules.map((r) => [r.id, r])), [rules]);
  const [view, setView] = useState("home");
  const [q, setQ] = useState("");
  const [field, setField] = useState(null);
  const [ruleId, setRuleId] = useState(null);
  const [focusArt, setFocusArt] = useState(null);
  const [tab, setTab] = useState("body");
  const [onlyHits, setOnlyHits] = useState(false);
  const [res, setRes] = useState(null); // {loading, ai, hits, notice, error}
  const [basket, setBasket] = useState([]);
  const [withNo, setWithNo] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState("");
  const [tick, setTick] = useState(0);
  const ranking = useRanking(rules, tick);
  const recent = useMemo(() => {
    const d = (x) => { const m = String(x || "").match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/); return m ? +m[1] * 10000 + +m[2] * 100 + +m[3] : 0; };
    return [...rules].sort((a, b) => d(b.eff) - d(a.eff)).slice(0, 8);
  }, [rules]);
  const [browseFilter, setBrowseFilter] = useState("");
  const reqId = useRef(0);

  useEffect(() => {
    setBasket(store.get("rc_basket", []));
    if (!store.get("rc_prevrank", null)) store.set("rc_prevrank", ranking.map((x) => x.k));
    setTick((t) => t + 1);
    const onPop = (e) => {
      const s = e.state || { view: "home" };
      setView(s.view); setQ(s.q || ""); setField(s.field || null); setRuleId(s.ruleId || null); setFocusArt(null);
      if (s.view === "results" && s.q) runSearch(s.q, s.field || null, false);
    };
    window.addEventListener("popstate", onPop);
    history.replaceState({ view: "home" }, "");
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { store.set("rc_basket", basket); }, [basket]);

  const say = (m) => { setToast(m); clearTimeout(say.t); say.t = setTimeout(() => setToast(""), 1800); };
  const nav = (s) => { history.pushState(s, ""); window.scrollTo(0, 0); };

  const runSearch = useCallback(async (query, fld, push = true) => {
    const qq = String(query || "").trim();
    if (!qq) return;
    const blocked = sensitiveCheck(qq);
    setQ(qq); setField(fld); setView("results"); setOnlyHits(false);
    if (push) nav({ view: "results", q: qq, field: fld });
    if (blocked) { setRes({ error: blocked }); return; }
    logSearch(qq); setTick((t) => t + 1);
    const my = ++reqId.current;
    setRes({ loading: true, hits: [], ai: null });
    try {
      const r = await fetch("/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: qq, field: fld }) });
      const data = await r.json();
      if (my !== reqId.current) return;
      if (!r.ok) setRes({ error: data.error || "검색에 실패했습니다.", hits: [] });
      else setRes({ ai: data.ai, hits: data.hits || [], notice: data.notice, plan: data.plan });
    } catch {
      if (my !== reqId.current) return;
      setRes({ hits: [], ai: null, error: "서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요." });
    }
  }, []);

  const onSearch = (x, item) => { if (item?.ruleId) { setQ(""); setRes(null); openRule(item.ruleId); } else runSearch(x, field); };

  const browseField = (f) => {
    setField(f); setQ(""); setView("results"); setRes({ hits: [], ai: null, browse: true });
    nav({ view: "results", q: "", field: f });
  };
  const openRule = (id, num) => {
    if (q) logClick(q);
    setRuleId(id); setFocusArt(num || null); setTab("body"); setView("detail");
    nav({ view: "detail", q, field, ruleId: id });
  };
  const goHome = () => {
    store.set("rc_prevrank", ranking.map((x) => x.k));
    setView("home"); setQ(""); setField(null); setRes(null); nav({ view: "home" });
  };

  /* 강조 용어 & 관련 조항 */
  const hlTerms = useMemo(() => termsOf(q, res?.ai?.keywords || []), [q, res]);
  const hlRe = useMemo(() => (q ? termRegex(hlTerms) : null), [q, hlTerms]);
  const aiRel = useMemo(() => {
    const m = new Map();
    (res?.ai?.related || []).forEach((x, i) => m.set(artKey(x.ruleId, x.num), { ...x, order: i }));
    return m;
  }, [res]);

  const grouped = useMemo(() => {
    if (!res || res.browse) return rules.filter((r) => !field || r.field === field).map((r) => ({ r, arts: [] }));
    const g = new Map();
    const add = (h, extra) => {
      const r = ruleById[h.ruleId];
      if (!r || (field && r.field !== field)) return;
      if (!g.has(h.ruleId)) g.set(h.ruleId, { r, arts: new Map(), rank: Infinity });
      const e = g.get(h.ruleId);
      e.arts.set(h.num, { ...(e.arts.get(h.num) || {}), num: h.num, title: h.title, snippet: h.snippet, ...extra });
      if (extra.order !== undefined) e.rank = Math.min(e.rank, extra.order);
    };
    (res.ai?.related || []).forEach((x, i) => add(x, { ai: true, reason: x.reason, order: i }));
    (res.hits || []).forEach((h) => add(h, { score: h.score }));
    return [...g.values()].map((x) => ({
      r: x.r, rank: x.rank,
      arts: [...x.arts.values()].sort((a, b) => (!!a.ai === !!b.ai ? (b.score || 0) - (a.score || 0) : a.ai ? -1 : 1)),
      total: [...x.arts.values()].reduce((s, a) => s + (a.score || 0) + (a.ai ? 50 : 0), 0),
    })).sort((a, b) => a.rank - b.rank || b.total - a.total);
  }, [res, rules, ruleById, field]);

  /* 근거 바구니 */
  const citeLine = (b) => {
    const r = ruleById[b.ruleId];
    if (!r) return null;
    const base = withNo && r.no ? `${r.name}(${r.no}${r.date ? ", " + r.date : ""})` : `「${r.name}」`;
    return `${base} ${b.num}${b.title ? `(${b.title})` : ""}`;
  };
  const citeText = () => {
    const lines = basket.map(citeLine).filter(Boolean);
    if (!lines.length) return "";
    if (lines.length === 1) return `1. 관련 근거 : ${lines[0]}`;
    return "1. 관련 근거\n" + lines.map((l, i) => `  ${LETTERS[i]}. ${l}`).join("\n");
  };
  const addCite = (rid, num, title) => {
    if (basket.some((b) => b.ruleId === rid && b.num === num)) return say("이미 담겨 있습니다");
    setBasket([...basket, { ruleId: rid, num, title }]); say(`${num}을 근거 바구니에 담았습니다`);
  };
  const copy = async (txt) => {
    try { await navigator.clipboard.writeText(txt); say("복사했습니다"); }
    catch { say("복사가 막혀 있습니다. 내용을 직접 선택해 복사하세요"); }
  };

  return (
    <div className="wrap">
      <header className="top">
        <button className="brand" type="button" onClick={goHome} aria-label="규정나침반 홈"><Compass />규정나침반</button>
        <nav className="nav" aria-label="메뉴">
          <button type="button" aria-current={true} onClick={goHome}>검색</button>
          <a className="navlink" href="/admin">규정 등록(관리자)</a>
        </nav>
      </header>

      {view === "home" && (
        <section>
          <div className="hero">
            <h1>키워드 하나로 군 규정 근거를 찾습니다</h1>
            <p>AI가 질문을 이해해 관련 조항을 찾고, 조항 원문을 근거로 답합니다.</p>
            <SearchBox id="sb-home" big rules={rules} ranking={ranking} onSearch={onSearch} />
            <div className="chips" role="group" aria-label="분야">
              {FIELDS.map((f) => (
                <button key={f} className="chip" type="button" aria-pressed={field === f} onClick={() => browseField(f)}>{f}</button>
              ))}
            </div>
          </div>
          <div className="home-grid">
            <div className="panel">
              <h2>추천 키워드 순위 <small>관리자 추천 + 내 최근 7일 검색</small></h2>
              <ol className="rank">
                {ranking.map((x) => (
                  <li key={x.k}>
                    <button type="button" onClick={() => runSearch(x.k, null)}>
                      <span className="n">{x.rank}</span><span>{x.k}</span>
                      <span className={"d " + (x.d.startsWith("▲") ? "up" : x.d.startsWith("▼") ? "down" : "")}>{x.d}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <div className="panel">
              <h2>최근 개정된 규정 <small>전체 {rules.length}건 · 조문 {rules.reduce((s, r) => s + (r.arts || 0), 0).toLocaleString()}개</small></h2>
              <div className="recent">
                {recent.map((r) => (
                  <button key={r.id} type="button" onClick={() => { setQ(""); setRes(null); openRule(r.id); }}>
                    <div className="t">{r.name} <span className="badge">{r.kind}</span></div>
                    <div className="m">[시행 {r.eff || "-"}] {r.no} · {r.field}</div>
                  </button>
                ))}
              </div>
              <button className="btn" type="button" style={{ marginTop: 12 }} onClick={() => browseField(null)}>전체 규정 목록 보기</button>
            </div>
          </div>
        </section>
      )}

      {view === "results" && (
        <section>
          <div className="results-head">
            <SearchBox id="sb-results" rules={rules} ranking={ranking} initial={q} onSearch={onSearch} />
          </div>
          <div className="filters" role="group" aria-label="분야 필터">
            <button className="chip" type="button" aria-pressed={!field} onClick={() => (q ? runSearch(q, null) : browseField(null))}>전체</button>
            {FIELDS.map((f) => (
              <button key={f} className="chip" type="button" aria-pressed={field === f} onClick={() => (q ? runSearch(q, f) : browseField(f))}>{f}</button>
            ))}
          </div>

          {res?.error && <div className="notice" role="alert">{res.error}</div>}
          {res?.notice && <div className="notice">{res.notice}</div>}

          {q && res?.loading && <div className="loading">AI가 전체 규정에서 관련 조항을 찾는 중</div>}
          {q && res?.ai && (
            <div className="aibox">
              <div className="aihead"><b>AI 답변</b><span className={"conf " + res.ai.confidence}>신뢰도 {res.ai.confidence}</span><span>근거 조항만 보고 작성 · 최종 판단은 원문과 담당자 확인</span></div>
              <p className="ans">{res.ai.answer}</p>
              {res.ai.related.length > 0 && (
                <div className="cites">
                  {res.ai.related.map((x) => (
                    <button key={x.ruleId + x.num} type="button" onClick={() => openRule(x.ruleId, x.num)}>{ruleById[x.ruleId]?.name} {x.num}</button>
                  ))}
                </div>
              )}
              {res.ai.keywords?.length > 0 && <p className="why">AI가 함께 찾은 말: {res.ai.keywords.join(", ")}</p>}
            </div>
          )}

          {!res?.error && !res?.loading && (
            <p className="summary">
              {q ? <><b>{q}</b> 검색 결과 · 규정 {grouped.length}건, 관련 조항 {grouped.reduce((s, g) => s + g.arts.length, 0)}개</> : <><b>{field || "전체"}</b> 규정 {grouped.length}건</>}
            </p>
          )}

          {!res?.loading && !res?.error && grouped.length === 0 && (
            <div className="empty">
              {field ? <><b>{field}</b> 분야에서 </> : null}일치하는 조항이 없습니다.<br />다른 키워드로 찾거나, 필요한 규정을 등록해 주세요.<br />
              <a className="btn" href="/admin">규정 등록하기</a>
            </div>
          )}

          {res?.browse && (
            <div className="browse">
              <input className="browse-filter" value={browseFilter} onChange={(e) => setBrowseFilter(e.target.value)} placeholder="규정명으로 거르기 (예: 예비군)" aria-label="규정명으로 거르기" />
              <ul>
                {grouped.filter(({ r }) => !browseFilter || r.name.includes(browseFilter.trim())).map(({ r }) => (
                  <li key={r.id}><button type="button" onClick={() => openRule(r.id)}><span className="t">{r.name}</span><span className="m">{r.kind} · {r.field} · 조문 {r.arts || 0}개 · 시행 {r.eff || "-"}</span></button></li>
                ))}
              </ul>
            </div>
          )}

          {!res?.browse && grouped.map(({ r, arts }) => (
            <article className="card" key={r.id}>
              <h3>
                <button type="button" onClick={() => openRule(r.id)}><Hl text={r.name} re={hlRe} /></button>
                {arts.length > 0 && <span className="hitcount">관련 조항 {arts.length}개</span>}
              </h3>
              <div className="meta">[시행 {r.eff || "-"}] [{r.no}{r.date ? ", " + r.date : ""}{r.rev ? ", " + r.rev : ""}] · {r.kind} · {r.field}</div>
              {arts.slice(0, 3).map((x) => (
                <div className="snip" key={x.num}>
                  <button type="button" onClick={() => openRule(r.id, x.num)}>{x.num}{x.title ? <>(<Hl text={x.title} re={hlRe} />)</> : null}{x.ai && <span className="hitcount">AI 추천</span>}</button>
                  {x.snippet && <p><Hl text={x.snippet} re={hlRe} /></p>}
                  {x.reason && <div className="reason">{x.reason}</div>}
                </div>
              ))}
              {arts.length > 3 && <div className="meta">외 {arts.length - 3}개 조항 · 규정을 열면 모두 강조됩니다</div>}
            </article>
          ))}
        </section>
      )}

      {view === "detail" && ruleById[ruleId] && (
        <Detail
          meta={ruleById[ruleId]} q={q} hlRe={hlRe} aiRel={aiRel} focusArt={focusArt}
          tab={tab} setTab={setTab} onlyHits={onlyHits} setOnlyHits={setOnlyHits}
          addCite={addCite} copy={copy} setBasket={setBasket} basket={basket} say={say}
          searchBox={<SearchBox id="sb-detail" rules={rules} ranking={ranking} initial={q} onSearch={onSearch} />}
        />
      )}

      <button className="fab" type="button" onClick={() => setSheet(!sheet)}>근거 바구니<span className="c">{basket.length}</span></button>
      {sheet && (
        <div className="sheet" role="dialog" aria-label="근거 바구니">
          {!basket.length ? (
            <>
              <h3>근거 바구니</h3>
              <p className="note">규정 상세 화면에서 조항의 [관련 근거로 담기]를 누르면 여기에 모입니다. 모은 조항은 공문 첫 항목 &quot;1. 관련 근거&quot; 형식으로 한 번에 복사됩니다.</p>
            </>
          ) : (
            <>
              <h3>근거 바구니 · {basket.length}개</h3>
              <ol>
                {basket.map((b, i) => (
                  <li key={b.ruleId + b.num}>
                    <span>{LETTERS[i]}. {citeLine(b) || "(삭제된 규정)"}</span>
                    <span className="ops">
                      <button type="button" aria-label="위로" onClick={() => { if (i > 0) { const n = [...basket]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setBasket(n); } }}>↑</button>
                      <button type="button" aria-label="아래로" onClick={() => { if (i < basket.length - 1) { const n = [...basket]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setBasket(n); } }}>↓</button>
                      <button type="button" aria-label="빼기" onClick={() => setBasket(basket.filter((_, j) => j !== i))}>✕</button>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="row"><label><input type="checkbox" checked={withNo} onChange={(e) => setWithNo(e.target.checked)} /> 발령번호·발령일 포함</label></div>
              <pre>{citeText()}</pre>
              <div className="row">
                <button className="btn primary" type="button" onClick={() => copy(citeText())}>관련 근거로 복사</button>
                <button className="btn" type="button" onClick={() => setBasket([])}>비우기</button>
              </div>
              <p className="note">등록된 규정 기준입니다. 공문에 쓰기 전 시행일이 최신인지 원문에서 확인하세요.</p>
            </>
          )}
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

/* ---------- 규정 상세 (법령정보센터 형태) ---------- */
const ruleCache = new Map();
function useRule(id) {
  const [state, setState] = useState(() => (ruleCache.has(id) ? { rule: ruleCache.get(id) } : { loading: true }));
  useEffect(() => {
    let alive = true;
    if (ruleCache.has(id)) { setState({ rule: ruleCache.get(id) }); return; }
    setState({ loading: true });
    fetch("/api/rule?id=" + encodeURIComponent(id)).then((r) => r.json()).then((d) => {
      if (!alive) return;
      if (d.error) setState({ error: d.error }); else { ruleCache.set(id, d); setState({ rule: d }); }
    }).catch(() => alive && setState({ error: "규정을 불러오지 못했습니다. 잠시 후 다시 시도하세요." }));
    return () => { alive = false; };
  }, [id]);
  return state;
}

function Detail({ meta, q, hlRe, aiRel, focusArt, tab, setTab, onlyHits, setOnlyHits, addCite, copy, basket, setBasket, say, searchBox }) {
  const { rule, loading, error } = useRule(meta.id);
  const r = rule || { ...meta, items: [] };
  const arts = r.items.filter((i) => i.type === "art");
  const hitSet = useMemo(() => {
    const s = new Set();
    arts.forEach((a) => { if (aiRel.has(artKey(r.id, a.num)) || (hlRe && scoreArt(a, hlRe) > 0)) s.add(a.num); });
    return s;
  }, [rule, hlRe, aiRel]); // eslint-disable-line react-hooks/exhaustive-deps
  const hits = arts.filter((a) => hitSet.has(a.num));
  const cursor = useRef(-1);

  useEffect(() => {
    if (!rule) return;
    const target = focusArt || hits[0]?.num;
    if (!target) return;
    const t = setTimeout(() => document.getElementById("a-" + target)?.scrollIntoView({ block: "start", behavior: "smooth" }), 80);
    return () => clearTimeout(t);
  }, [rule, focusArt]); // eslint-disable-line react-hooks/exhaustive-deps

  const jump = (dir) => {
    if (!hits.length) return;
    cursor.current = (cursor.current + dir + hits.length) % hits.length;
    document.getElementById("a-" + hits[cursor.current].num)?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const goto = (num) => document.getElementById("a-" + num)?.scrollIntoView({ block: "start", behavior: "smooth" });

  return (
    <section>
      <div className="results-head">{searchBox}</div>
      <div className="rule-head">
        <div className="kind">{r.kind} · {r.field}{r.arts ? ` · 조문 ${r.arts}개` : ""}</div>
        <h2>{r.name}</h2>
        <div className="stamp">[시행 {r.eff || "-"}] [{r.no}{r.date ? ", " + r.date : ""}{r.rev ? ", " + r.rev : ""}]</div>
      </div>
      {q && tab === "body" && rule && (
        <div className="relbar">
          {hits.length ? (
            <>
              <span className="pill">관련 조항 {hits.length}개 · {hits.slice(0, 3).map((a) => a.num).join(", ")}{hits.length > 3 ? " 외" : ""}</span>
              <button className="btn" type="button" aria-pressed={onlyHits} onClick={() => setOnlyHits(!onlyHits)}>관련 조항만 보기</button>
              <button className="btn" type="button" onClick={() => jump(-1)}>◀ 이전</button>
              <button className="btn" type="button" onClick={() => jump(1)}>다음 ▶</button>
              <button className="btn" type="button" onClick={() => {
                const add = hits.filter((a) => !basket.some((b) => b.ruleId === r.id && b.num === a.num)).map((a) => ({ ruleId: r.id, num: a.num, title: a.title }));
                setBasket([...basket, ...add]); say("관련 조항을 모두 담았습니다");
              }}>관련 조항 모두 담기</button>
            </>
          ) : <span className="meta">이 규정에는 &apos;{q}&apos;와 일치하는 조항이 없습니다.</span>}
        </div>
      )}
      <div className="tabs" role="tablist">
        {[["body", "본문"], ["addenda", "부칙"], ["annex", "별표/서식"], ["history", "연혁"]].map(([k, l]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {loading && <div className="loading">조문을 불러오는 중</div>}
      {error && <div className="notice" role="alert">{error}</div>}
      {rule && arts.length === 0 && tab === "body" && (
        <div className="empty">이 규정은 본문이 첨부파일(한글·PDF) 형태라 여기서 조문을 보여줄 수 없습니다.<br />{r.url && <a className="btn" href={r.url} target="_blank" rel="noopener noreferrer">국가법령정보센터에서 원문 보기</a>}</div>
      )}
      {rule && (arts.length > 0 || tab !== "body") && (
        <div className="layout">
          <nav className="toc" aria-label="조문 목록">
            <h4>조문 목록</h4>
            {r.items.map((i, k) => i.type === "chap" ? <div className="ch" key={k}>{i.text}</div>
              : i.type === "art" ? <button key={k} type="button" className={hitSet.has(i.num) ? "hit" : ""} title={`${i.num}(${i.title})`} onClick={() => goto(i.num)}>{i.num}({i.title})</button> : null)}
          </nav>
          <div style={{ minWidth: 0 }}>
            <select className="toc-select" aria-label="조문 바로가기" value="" onChange={(e) => e.target.value && goto(e.target.value)}>
              <option value="">조문 바로가기</option>
              {arts.map((a) => <option key={a.num} value={a.num}>{hitSet.has(a.num) ? "● " : ""}{a.num}({a.title})</option>)}
            </select>
            {tab !== "body" ? (
              <div className="empty">{tab === "addenda" ? "부칙" : tab === "annex" ? "별표/서식" : "연혁"}은 국가법령정보센터 원문에서 확인하세요.<br />{r.url && <a className="btn" href={r.url} target="_blank" rel="noopener noreferrer">원문 열기</a>}</div>
            ) : (
              <div className={"lawbody" + (onlyHits && hits.length ? " only" : "") + (hits.length && !onlyHits ? " dimrest" : "")}>
                {r.items.map((i, k) => {
                  if (i.type === "chap") return <div className="chap" key={k}>{i.text}</div>;
                  if (i.type === "sec") return <div className="sec" key={k}>{i.text}</div>;
                  const hit = hitSet.has(i.num);
                  const first = i.lines[0] && !lineClass(i.lines[0]) ? i.lines[0] : null;
                  const rest = first ? i.lines.slice(1) : i.lines;
                  const ai = aiRel.get(artKey(r.id, i.num));
                  return (
                    <div className={"art" + (hit ? " hit" : "")} id={"a-" + i.num} key={k}>
                      <div className="ahead">
                        <span className="atitle">{i.num}(<Hl text={i.title} re={hlRe} />)</span>
                        {first && <span><Hl text={first} re={hlRe} /></span>}
                        <span className="tools">
                          <button className="btn primary" type="button" onClick={() => addCite(r.id, i.num, i.title)}>관련 근거로 담기</button>
                          <button className="btn" type="button" onClick={() => copy(`${i.num}(${i.title}) ${i.lines.join("\n")}`)}>복사</button>
                        </span>
                      </div>
                      {ai && <div className="reason">AI 추천 이유: {ai.reason}</div>}
                      {rest.map((l, j) => <p key={j} className={lineClass(l)}><Hl text={l} re={hlRe} /></p>)}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="src">출처: {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">국가법령정보센터 원문</a> : "등록자 입력"}{r.note ? " · " + r.note : ""}</div>
          </div>
        </div>
      )}
    </section>
  );
}
