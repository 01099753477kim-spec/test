"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { FIELDS, SYN, ROLES, normQ, termsOf, termRegex, scoreArt, lineClass, sensitiveCheck, artKey } from "../lib/rulecore.mjs";

const LETTERS = "가나다라마바사아자차카타파하".split("");
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

function Hl({ text, re }) {
  if (!re || !text) return text || null;
  return String(text).split(re).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}

/* ---------- 아이콘 (선 아이콘, 파스텔 타일) ---------- */
const ICONS = {
  인사: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.4 0 4 1.6 4.5 4.5"/>',
  군수: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  작전: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  보안: '<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
  교육훈련: '<path d="M2 9.5 12 5l10 4.5L12 14z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5"/><path d="M22 9.5V15"/>',
  정보통신: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  법무: '<path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7l-2.5 6h5z"/><path d="M19 7l-2.5 6h5z"/>',
  기타: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  전체: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  ai: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z"/>',
  fire: '<path d="M12 21c-3.9 0-7-2.8-7-6.5 0-3.2 2.2-5.3 3.5-7 .3 2 1.3 3 2.5 3.5C11 7.5 12.5 5 15 3c0 3.5 4 5.5 4 11.5 0 3.7-3.1 6.5-7 6.5z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  basket: '<path d="M3 9h18l-1.8 9.2a2 2 0 0 1-2 1.8H6.8a2 2 0 0 1-2-1.8z"/><path d="M8 9l3-5M16 9l-3-5"/><path d="M9.5 13v3M14.5 13v3"/>',
  book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  home: '<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/>',
  up: '<path d="M7 10v10H4V10z"/><path d="M7 10l4-7c1.5 0 2.5 1 2.2 2.6L12.6 9H19a2 2 0 0 1 2 2.3l-1.2 6.6A2.5 2.5 0 0 1 17.3 20H7"/>',
  down: '<path d="M7 14V4H4v10z"/><path d="M7 14l4 7c1.5 0 2.5-1 2.2-2.6L12.6 15H19a2 2 0 0 0 2-2.3l-1.2-6.6A2.5 2.5 0 0 0 17.3 4H7"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c1-4 4-6 7.5-6s6.5 2 7.5 6"/>',
  cu: '<path d="m6 15 6-6 6 6"/>',
  cd: '<path d="m6 9 6 6 6-6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
};
function Icon({ name, size = 20 }) {
  return <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] || ICONS.기타 }} />;
}
const FIELD_DESC = { 인사: "휴가·진급·징계", 군수: "물자·시설·보급", 작전: "부대운영·동원", 보안: "비밀·보호구역", 교육훈련: "훈련·예비군", 정보통신: "정보화·데이터", 법무: "처벌·법제업무", 기타: "그 밖의 규정" };

function Logo() {
  return (
    <span className="logo" aria-hidden="true">
      <svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="none" stroke="#fff" strokeWidth="2.4" /><path d="M16 8.5 19 16h-6z" fill="#FF8A7A" /><path d="M16 23.5 13 16h6z" fill="#fff" /></svg>
    </span>
  );
}

/* 나침반 마스코트 */
function Mascot() {
  return (
    <svg className="mascot" viewBox="0 0 120 120" aria-hidden="true">
      <ellipse cx="60" cy="112" rx="30" ry="5" fill="#000" opacity=".06" />
      <circle cx="60" cy="58" r="46" fill="#fff" stroke="var(--accent)" strokeWidth="6" />
      <circle cx="60" cy="58" r="37" fill="#F2FAF5" />
      <g stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity=".55">
        <path d="M60 24v6M60 86v6M26 58h6M88 58h6" />
      </g>
      <text x="60" y="21" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--accent)">N</text>
      <ellipse cx="47" cy="56" rx="4.5" ry="5.5" fill="#3B3A36" />
      <ellipse cx="73" cy="56" rx="4.5" ry="5.5" fill="#3B3A36" />
      <circle cx="48.5" cy="54" r="1.6" fill="#fff" />
      <circle cx="74.5" cy="54" r="1.6" fill="#fff" />
      <ellipse cx="39" cy="67" rx="6" ry="3.6" fill="#FFB4A8" opacity=".75" />
      <ellipse cx="81" cy="67" rx="6" ry="3.6" fill="#FFB4A8" opacity=".75" />
      <path d="M53 68q7 6 14 0" fill="none" stroke="#3B3A36" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 2 66 12H54z" fill="#FF8A7A" />
    </svg>
  );
}

/* ---------- 추천 키워드 순위 ---------- */
function useRanking(rules, tick, serverTop) {
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
    if (serverTop && serverTop.length >= 3) {
      // 전체 장병 검색 순위(Supabase) 우선, 모자라면 추천 키워드로 채움
      const srv = serverTop.map((x) => ({ k: x.k, n: x.n, score: x.n }));
      rows.splice(0, rows.length, ...srv, ...rows.filter((r) => !srv.some((x) => x.k === r.k))); rows.length = Math.min(rows.length, 10);
    }
    const prev = typeof window === "undefined" ? null : store.get("rc_prevrank", null);
    return rows.map((x, i) => {
      let d = "";
      if (prev) { const p = prev.indexOf(x.k); d = p < 0 ? "NEW" : p > i ? "▲" + (p - i) : p < i ? "▼" + (i - p) : "–"; }
      return { ...x, rank: i + 1, d };
    });
  }, [rules, tick, serverTop]);
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
          placeholder={big ? "궁금한 걸 그대로 물어보세요 (예: 용사 휴대전화 몇 시까지 쓸 수 있어?)" : "키워드나 질문"}
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

/* ---------- 신분 선택 ---------- */
function RolePicker({ role, onPick, compact }) {
  return (
    <div className={"roles" + (compact ? " compact" : "")} role="group" aria-label="내 신분">
      <span className="rl"><Icon name="user" size={16} />{compact ? "내 신분" : "나는"}</span>
      {ROLES.map((r) => <button key={r} type="button" className="rchip" aria-pressed={role === r} onClick={() => onPick(r)}>{r}</button>)}
      {!compact && <span className="rh">{role ? `${role}에게 맞는 조항을 먼저 보여드려요` : "신분을 고르면 맞춤 답변을 드려요"}</span>}
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
  const [stats, setStats] = useState(null);
  const [role, setRoleState] = useState("");
  const roleRef = useRef("");
  const setRole = (r) => { const v = role === r ? "" : r; setRoleState(v); roleRef.current = v; store.set("rc_role", v); };
  const [votes, setVotes] = useState({});
  const [fbCount, setFbCount] = useState({}); // 질문별 도움 됐어요/아쉬워요 수
  const forRole = useCallback((r) => !role || (r.roles || []).includes(role), [role]);
  const roleRules = useMemo(() => rules.filter(forRole), [rules, forRole]);
  const ranking = useRanking(rules, tick, stats?.on ? stats.top : null);
  const recent = useMemo(() => {
    const d = (x) => { const m = String(x || "").match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/); return m ? +m[1] * 10000 + +m[2] * 100 + +m[3] : 0; };
    return [...roleRules].sort((a, b) => d(b.eff) - d(a.eff)).slice(0, 8);
  }, [roleRules]);
  const [browseFilter, setBrowseFilter] = useState("");
  const fieldCount = useMemo(() => roleRules.reduce((m, r) => ((m[r.field] = (m[r.field] || 0) + 1), m), {}), [roleRules]);
  const reqId = useRef(0);

  useEffect(() => {
    setBasket(store.get("rc_basket", []));
    { let r0 = store.get("rc_role", ""); if (r0 === "병사") { r0 = "용사"; store.set("rc_role", r0); } if (ROLES.includes(r0)) { setRoleState(r0); roleRef.current = r0; } }
    fetch("/api/stats").then((r) => r.json()).then((d) => d?.on && setStats(d)).catch(() => {});
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
      const r = await fetch("/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q: qq, field: fld, role: roleRef.current || null }) });
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
    if (!res || res.browse) return roleRules.filter((r) => !field || r.field === field).map((r) => ({ r, arts: [] }));
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
  }, [res, rules, roleRules, ruleById, field]);

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

  // 따봉은 답변의 대표 근거 조항 기준으로 모음 (표현이 달라도 같은 조항이면 같은 숫자)
  const topArt = res?.ai?.related?.[0] ? `${res.ai.related[0].ruleId}#${res.ai.related[0].num}` : "";
  const fbKey = topArt || normQ(q);
  useEffect(() => {
    // 답변이 나올 때마다 서버의 누적 수를 다시 받아옴 (다른 장병의 평가 포함)
    if (!q || !res?.ai) return;
    const k = fbKey;
    fetch("/api/feedback?q=" + encodeURIComponent(q) + "&art=" + encodeURIComponent(topArt), { cache: "no-store" }).then((r) => r.json())
      .then((d) => setFbCount((m) => ({ ...m, [k]: { up: Math.max(d.up || 0, m[k]?.up || 0), down: Math.max(d.down || 0, m[k]?.down || 0) } }))).catch(() => {});
  }, [q, res?.ai, fbKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setVotes(store.get("rc_votes", {})); }, []);
  const vote = (v) => {
    const k = fbKey;
    const nv = { ...votes, [k]: v }; setVotes(nv); store.set("rc_votes", nv);
    setFbCount((m) => { const c = m[k] || { up: 0, down: 0 }; return { ...m, [k]: v === 1 ? { ...c, up: c.up + 1 } : { ...c, down: c.down + 1 } }; });
    fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q, vote: v, art: topArt || null, role: roleRef.current || null, model: res?.ai?.model }) }).catch(() => {});
  };

  /* 공문 초안 */
  const [purpose, setPurpose] = useState("");
  const [to, setTo] = useState("");
  const [draft, setDraft] = useState(null);
  const [sheetTab, setSheetTab] = useState("list");
  const [clearArm, setClearArm] = useState(false);
  const moveCite = (i, d) => { const j = i + d; if (j < 0 || j >= basket.length) return; const n = [...basket]; [n[i], n[j]] = [n[j], n[i]]; setBasket(n); };
  const makeDraft = async () => {
    setDraft({ loading: true });
    try {
      const r = await fetch("/api/draft", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ purpose, to, cite: citeText(), items: basket.map(({ ruleId, num }) => ({ ruleId, num })), role: roleRef.current || null }) });
      const d = await r.json();
      setDraft(r.ok ? d : { error: d.error || "초안을 만들지 못했습니다." });
    } catch { setDraft({ error: "서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요." }); }
  };

  return (
    <div className="wrap">
      <header className="top">
        <button className="brand" type="button" onClick={goHome} aria-label="규정나침반 홈"><Logo />규정나침반</button>
        <nav className="nav" aria-label="메뉴">
          <button type="button" aria-current={view === "home"} onClick={goHome}><Icon name="home" size={16} />홈</button>
          <button type="button" aria-current={view === "results" && !!res?.browse && !field} onClick={() => browseField(null)}><Icon name="book" size={16} />전체 규정</button>
          <a className="navlink" href="/admin"><Icon name="pencil" size={16} />규정 등록</a>
        </nav>
      </header>

      {view === "home" && (
        <section>
          <div className="hero">
            <Mascot />
            <h1>궁금한 군 규정, 물어보면 바로 찾아드려요</h1>
            <p>AI가 질문을 이해해 관련 조항을 찾고, 조항 원문을 근거로 답해요.</p>
            <SearchBox id="sb-home" big rules={rules} ranking={ranking} onSearch={onSearch} />
            <RolePicker role={role} onPick={setRole} />
          </div>
          <div className="fields" role="group" aria-label="분야별 규정">
            {FIELDS.map((f) => (
              <button key={f} type="button" className="ftile" data-f={f} onClick={() => browseField(f)}>
                <span className="ficon"><Icon name={f} size={22} /></span>
                <span className="ft"><span className="fth"><b>{f}</b><span className="fcnt">{role ? `${role} ` : ""}{fieldCount[f] || 0}건</span></span><small>{FIELD_DESC[f] || ""}</small></span>
              </button>
            ))}
          </div>
          {stats?.on && (
            <div className="statbar">
              <span className="hicon" data-c="mint"><Icon name="chart" size={18} /></span>
              <span>이번 주 장병 검색 <b>{stats.total.toLocaleString()}</b>회</span>
              <span>AI 답변 만족도 <b>{stats.up + stats.down ? Math.round((stats.up / (stats.up + stats.down)) * 100) + "%" : "-"}</b></span>
              <span>공문 초안 <b>{stats.drafts.toLocaleString()}</b>건</span>
            </div>
          )}
          <div className="home-grid">
            <div className="panel">
              <h2><span className="hicon" data-c="coral"><Icon name="fire" size={18} /></span>{stats?.on && stats.top.length >= 3 ? "장병 인기 검색어" : "추천 키워드 순위"} <small>{stats?.on && stats.top.length >= 3 ? "전체 장병 최근 7일" : "관리자 추천 + 내 최근 7일 검색"}</small></h2>
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
              <h2><span className="hicon" data-c="sky"><Icon name="clock" size={18} /></span>{role ? `${role} 관련 최근 개정` : "최근 개정된 규정"} <small>{role ? `${role} 관련 ${roleRules.length}건 · 전체 ${rules.length}건` : `전체 ${rules.length}건 · 조문 ${rules.reduce((s, r) => s + (r.arts || 0), 0).toLocaleString()}개`}</small></h2>
              <div className="recent">
                {recent.map((r) => (
                  <button key={r.id} type="button" onClick={() => { setQ(""); setRes(null); openRule(r.id); }}>
                    <div className="t">{r.name} <span className="badge">{r.kind}</span></div>
                    <div className="m">[시행 {r.eff || "-"}] {r.no} · {r.field}</div>
                  </button>
                ))}
              </div>
              <button className="btn soft" type="button" style={{ marginTop: 12 }} onClick={() => browseField(null)}><Icon name="book" size={16} />전체 규정 목록 보기</button>
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
            <button className="chip" type="button" aria-pressed={!field} onClick={() => (q ? runSearch(q, null) : browseField(null))}><Icon name="전체" size={15} />전체</button>
            {FIELDS.map((f) => (
              <button key={f} className="chip" type="button" aria-pressed={field === f} data-f={f} onClick={() => (q ? runSearch(q, f) : browseField(f))}><Icon name={f} size={15} />{f}</button>
            ))}
          </div>
          <RolePicker compact role={role} onPick={(r) => { setRole(r); if (q) runSearch(q, field); }} />

          {res?.error && <div className="notice" role="alert">{res.error}</div>}
          {res?.notice && <div className="notice">{res.notice}</div>}

          {q && res?.loading && <div className="loading"><Mascot />AI가 전체 규정에서 관련 조항을 찾는 중</div>}
          {q && res?.ai && (
            <div className="aibox">
              <div className="aihead"><span className="hicon" data-c="mint"><Icon name="ai" size={18} /></span><b>AI 답변</b><span className={"conf " + res.ai.confidence}>신뢰도 {res.ai.confidence}</span><span>근거 조항만 보고 작성 · 최종 판단은 원문과 담당자 확인</span></div>
              <p className="ans">{res.ai.answer}</p>
              {res.ai.related.length > 0 && (
                <div className="cites">
                  {res.ai.related.map((x) => (
                    <button key={x.ruleId + x.num} type="button" onClick={() => openRule(x.ruleId, x.num)}>{ruleById[x.ruleId]?.name} {x.num}</button>
                  ))}
                </div>
              )}
              {res.ai.keywords?.length > 0 && <p className="why">AI가 함께 찾은 말: {res.ai.keywords.join(", ")}{res.role ? ` · ${res.role} 기준` : ""}</p>}
              {(
                <div className="fb">
                  <span>{votes[fbKey] ? "의견 고마워요!" : "답변이 도움이 됐나요?"}</span>
                  <button type="button" aria-pressed={votes[fbKey] === 1} disabled={!!votes[fbKey]} onClick={() => vote(1)}><Icon name="up" size={16} />도움 됐어요 <b className="cnt">{fbCount[fbKey]?.up ?? 0}</b></button>
                  <button type="button" aria-pressed={votes[fbKey] === -1} disabled={!!votes[fbKey]} onClick={() => vote(-1)}><Icon name="down" size={16} />아쉬워요 <b className="cnt">{fbCount[fbKey]?.down ?? 0}</b></button>
                  {topArt && <span className="fbnote">{ruleById[res.ai.related[0].ruleId]?.name} {res.ai.related[0].num} 근거 답변 누적</span>}
                </div>
              )}
            </div>
          )}

          {!res?.error && !res?.loading && (
            <p className="summary">
              {q ? <><b>{q}</b> 검색 결과 · 규정 {grouped.length}건, 관련 조항 {grouped.reduce((s, g) => s + g.arts.length, 0)}개</> : <><b>{field || "전체"}</b> 규정 {grouped.length}건{role ? <> · <b>{role}</b> 관련만 보는 중 <button type="button" className="linkbtn" onClick={() => setRole(role)}>모든 신분 보기</button></> : null}</>}
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
                  <li key={r.id}><button type="button" data-f={r.field} onClick={() => openRule(r.id)}><span className="ficon sm"><Icon name={r.field} size={18} /></span><span className="bt"><span className="t">{r.name}</span><span className="m">{r.kind} · {r.field} · 조문 {r.arts || 0}개 · 시행 {r.eff || "-"}</span></span></button></li>
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

      <button className="fab" type="button" onClick={() => setSheet(!sheet)}><Icon name="basket" size={18} />근거 바구니<span className="c">{basket.length}</span></button>
      {sheet && (
        <>
          <div className="scrim" onClick={() => setSheet(false)} />
          <aside className="drawer" role="dialog" aria-label="근거 바구니">
            <header className="dh">
              <div className="dt"><span className="hicon" data-c="mint"><Icon name="basket" size={18} /></span><b>근거 바구니</b><span className="dc">{basket.length}</span></div>
              <button type="button" className="xbtn" aria-label="닫기" onClick={() => setSheet(false)}><Icon name="x" size={18} /></button>
            </header>
            {basket.length > 0 && (
              <div className="seg" role="tablist">
                <button type="button" role="tab" aria-selected={sheetTab === "list"} onClick={() => setSheetTab("list")}><Icon name="book" size={15} />근거 목록 <em>{basket.length}</em></button>
                <button type="button" role="tab" aria-selected={sheetTab === "draft"} onClick={() => setSheetTab("draft")}><Icon name="doc" size={15} />공문 초안</button>
              </div>
            )}
            <div className="db">
              {!basket.length ? (
                <div className="dempty">
                  <Mascot />
                  <b>아직 담긴 근거가 없어요</b>
                  <p>규정을 열고 조항 옆 <span className="kbd">관련 근거로 담기</span>를 누르면 여기에 모여요. 모은 조항은 공문 &quot;1. 관련 근거&quot;로 한 번에 복사되고, AI가 공문 초안까지 써 드려요.</p>
                </div>
              ) : sheetTab === "list" ? (
                <>
                  <p className="dhint">카드를 누르면 조항 원문이 열려요 · 화살표로 순서를 바꿔요</p>
                  <ol className="blist">
                    {basket.map((b, i) => {
                      const r = ruleById[b.ruleId];
                      return (
                        <li key={b.ruleId + b.num} className="bitem">
                          <span className="bno">{LETTERS[i]}</span>
                          <button type="button" className="bmain" title="조항 원문 열기" onClick={() => { setSheet(false); openRule(b.ruleId, b.num); }}>
                            <span className="bname">{r?.name || "(삭제된 규정)"}</span>
                            <span className="bart"><b>{b.num}</b>{b.title ? ` ${b.title}` : ""}</span>
                            {r?.no && <span className="bmeta">{r.no}{r.date ? ` · ${r.date}` : ""}</span>}
                          </button>
                          <span className="bops">
                            <button type="button" aria-label="위로" disabled={i === 0} onClick={() => moveCite(i, -1)}><Icon name="cu" size={16} /></button>
                            <button type="button" aria-label="아래로" disabled={i === basket.length - 1} onClick={() => moveCite(i, 1)}><Icon name="cd" size={16} /></button>
                            <button type="button" aria-label="빼기" className="del" onClick={() => setBasket(basket.filter((_, j) => j !== i))}><Icon name="x" size={15} /></button>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  <section className="bprev">
                    <div className="bph"><b>공문에 들어갈 문구</b><label className="chk"><input type="checkbox" checked={withNo} onChange={(e) => setWithNo(e.target.checked)} />발령번호·발령일</label></div>
                    <pre>{citeText()}</pre>
                    <p className="note">등록된 규정 기준이에요. 공문에 쓰기 전 시행일이 최신인지 원문에서 확인하세요.</p>
                  </section>
                </>
              ) : (
                <div className="draftbox">
                  <p className="dhint">담긴 근거 {basket.length}개로 &quot;1. 관련 근거&quot; 다음 본문을 AI가 써 드려요</p>
                  <input value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={200} placeholder="어떤 공문인가요? (예: 성희롱 예방교육 실시 계획 보고)" aria-label="공문 목적" />
                  <input value={to} onChange={(e) => setTo(e.target.value)} maxLength={40} placeholder="수신 (예: 국방부, 수신자 참조)" aria-label="수신" />
                  {draft?.error && <p className="note err">{draft.error}</p>}
                  {draft?.loading && <div className="loading"><Mascot />AI가 공문 초안을 쓰는 중</div>}
                  {draft?.draft && (
                    <>
                      <pre className="draft">{draft.draft}</pre>
                      {draft.tips?.length > 0 && <ul className="tips">{draft.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>}
                      <p className="note">AI가 쓴 초안이에요. ○○ 빈칸을 채우고 부대 공문 양식에 맞게 다듬어 쓰세요.</p>
                    </>
                  )}
                </div>
              )}
            </div>
            {basket.length > 0 && (
              <footer className="df">
                {sheetTab === "list" ? (
                  <>
                    <button className="btn primary grow" type="button" onClick={() => copy(citeText())}>관련 근거로 복사</button>
                    <button className="btn soft" type="button" onClick={() => setSheetTab("draft")}><Icon name="doc" size={15} />공문 초안</button>
                    <button className={"btn ghost" + (clearArm ? " danger" : "")} type="button" onClick={() => { if (clearArm) { setBasket([]); setClearArm(false); } else { setClearArm(true); setTimeout(() => setClearArm(false), 3000); } }}>{clearArm ? "정말 비울까요?" : "비우기"}</button>
                  </>
                ) : (
                  <>
                    <button className="btn primary grow" type="button" disabled={!purpose.trim() || draft?.loading} onClick={makeDraft}><Icon name="ai" size={16} />{draft?.loading ? "쓰는 중..." : draft?.draft ? "다시 쓰기" : "AI로 공문 초안 쓰기"}</button>
                    {draft?.draft && <button className="btn soft" type="button" onClick={() => copy(draft.draft)}>초안 복사</button>}
                  </>
                )}
              </footer>
            )}
          </aside>
        </>
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
