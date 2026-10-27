"use client";
import { useMemo, useState } from "react";
import { FIELDS, parseBody } from "../../lib/rulecore.mjs";

// 규정 본문을 붙여넣으면 data/rules/에 넣을 .txt 파일 내용을 만들어 줍니다.
export default function Admin() {
  const [f, setF] = useState({ name: "", kind: "훈령", field: "인사", no: "", date: "", eff: "", rev: "", url: "", kw: "", note: "", body: "" });
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const items = useMemo(() => parseBody(f.body), [f.body]);
  const arts = items.filter((i) => i.type === "art");
  const file = `규정명: ${f.name}
종류: ${f.kind}
분야: ${f.field}
발령번호: ${f.no}
발령일: ${f.date}
시행일: ${f.eff}
구분: ${f.rev}
원문: ${f.url}
키워드: ${f.kw}
비고: ${f.note}
---
${f.body.trim()}
`;
  const fileName = (f.name || "새규정").replace(/[\\/:*?"<>|\s]/g, "") + ".txt";
  const copy = async () => {
    try { await navigator.clipboard.writeText(file); setMsg("파일 내용을 복사했습니다. GitHub에 붙여넣으세요."); }
    catch { setMsg("복사가 막혀 있습니다. 아래 미리보기를 직접 선택해 복사하세요."); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([file], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url);
  };
  const ready = f.name.trim() && arts.length > 0;

  return (
    <div className="wrap">
      <header className="top">
        <a className="brand" href="/">규정나침반</a>
        <nav className="nav"><a className="navlink" href="/">검색으로</a></nav>
      </header>
      <div className="admin">
        <div>
          <h2>규정 등록</h2>
          <p className="meta" style={{ margin: "0 0 14px" }}>
            국가법령정보센터에서 규정 본문을 복사해 붙여넣으면 조문을 자동으로 나누고, 저장소에 넣을 파일을 만들어 줍니다.
          </p>
          <form className="form" onSubmit={(e) => e.preventDefault()}>
            <label className="full">규정명<input id="fName" value={f.name} onChange={set("name")} placeholder="예: 부대관리훈령" /></label>
            <label>종류<select id="fKind" value={f.kind} onChange={set("kind")}>{["법률", "시행령", "시행규칙", "훈령", "예규", "지시"].map((k) => <option key={k}>{k}</option>)}</select></label>
            <label>분야<select id="fField" value={f.field} onChange={set("field")}>{FIELDS.map((k) => <option key={k}>{k}</option>)}</select></label>
            <label>발령번호<input id="fNo" value={f.no} onChange={set("no")} placeholder="예: 국방부훈령 제0000호" /></label>
            <label>발령일<input id="fDate" value={f.date} onChange={set("date")} placeholder="예: 2026. 5. 28." /></label>
            <label>시행일<input id="fEff" value={f.eff} onChange={set("eff")} placeholder="예: 2026. 5. 28." /></label>
            <label>제·개정 구분<input id="fRev" value={f.rev} onChange={set("rev")} placeholder="예: 일부개정" /></label>
            <label className="full">원문 링크<input id="fUrl" value={f.url} onChange={set("url")} placeholder="https://www.law.go.kr/행정규칙/..." /></label>
            <label className="full">핵심 키워드 (쉼표로 구분, 앞에 쓸수록 추천 순위가 높음)<input id="fKw" value={f.kw} onChange={set("kw")} placeholder="예: 휴가, 외출, 외박" /></label>
            <label className="full">본문 붙여넣기<textarea id="fBody" value={f.body} onChange={set("body")} placeholder={"제1장 총칙\n제1조(목적) 이 훈령은 ..."} /></label>
            <div className="full parsed">
              {arts.length ? `조문 ${arts.length}개, 장 ${items.filter((i) => i.type === "chap").length}개로 나눴습니다. 첫 조문: ${arts[0].num}(${arts[0].title}) · 마지막: ${arts.at(-1).num}(${arts.at(-1).title})` : "본문을 붙여넣으면 나뉜 조문 수가 여기에 표시됩니다."}
            </div>
            <div className="full" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn primary" type="button" disabled={!ready} onClick={download}>{fileName} 내려받기</button>
              <button className="btn" type="button" disabled={!ready} onClick={copy}>파일 내용 복사</button>
              {msg && <span className="meta">{msg}</span>}
            </div>
          </form>
        </div>
        <div>
          <h2>등록 방법</h2>
          <ol className="steps">
            <li>왼쪽에서 규정 정보와 본문을 넣고 파일을 내려받거나 복사합니다.</li>
            <li>GitHub 저장소의 <code>data/rules</code> 폴더에서 <b>Add file → Upload files</b>(또는 Create new file)로 추가합니다.</li>
            <li>Commit하면 Vercel이 자동으로 다시 배포하고, 1~2분 뒤 검색에 나타납니다.</li>
            <li>개정되면 같은 파일을 새 본문으로 바꿔 Commit합니다.</li>
          </ol>
          <p className="meta">공개된 규정만 등록하세요. 비공개·대외비 문서는 넣지 않습니다.</p>
          <h2 style={{ marginTop: 18 }}>미리보기</h2>
          <pre className="preview">{file}</pre>
        </div>
      </div>
    </div>
  );
}
