/* V2 Pro: Social Problem Explanation Genealogy Test (JSON-driven) */
const LS_KEY = "social_genealogy_v2pro_answers";
let QUESTIONS = [];
let EXTRA = [];
let SCHOOLS = [];
let IDEALS = null;
let ENCYC = null;
let idx = 0;
let inExtra = false;
let answers = {};
const els = {
  questionCard: document.getElementById("questionCard"),
  btnPrev: document.getElementById("btnPrev"),
  btnNext: document.getElementById("btnNext"),
  btnReset: document.getElementById("btnReset"),
  btnResume: document.getElementById("btnResume"),
  btnRecalc: document.getElementById("btnRecalc"),
  btnShare: document.getElementById("btnShare"),
  progressFill: document.getElementById("progressFill"),
  progressText: document.getElementById("progressText"),
  etaText: document.getElementById("etaText"),
  extraGate: document.getElementById("extraGate"),
  btnDoExtra: document.getElementById("btnDoExtra"),
  btnSkipExtra: document.getElementById("btnSkipExtra"),
  resultEmpty: document.getElementById("resultEmpty"),
  resultBody: document.getElementById("resultBody"),
  primarySchool: document.getElementById("primarySchool"),
  primarySummary: document.getElementById("primarySummary"),
  secondaryWrap: document.getElementById("secondaryWrap"),
  secondarySchool: document.getElementById("secondarySchool"),
  secondaryNote: document.getElementById("secondaryNote"),
  simList: document.getElementById("simList"),
  radar: document.getElementById("radar"),
  radarText: document.getElementById("radarText"),
  resultModules: document.getElementById("resultModules"),
  encyList: document.getElementById("encyList"),
  encyDetail: document.getElementById("encyDetail")
};
function clamp01(x){ return Math.max(0, Math.min(1, x)); }
function loadLocal(){ try{ const raw=localStorage.getItem(LS_KEY); if(!raw) return {}; const obj=JSON.parse(raw); if(typeof obj!=="object"||obj===null) return {}; return obj; }catch(e){ return {}; } }
function saveLocal(){ localStorage.setItem(LS_KEY, JSON.stringify(answers)); }
function clearLocal(){ localStorage.removeItem(LS_KEY); }
async function loadAll(){
  const [q,x,s,i,e] = await Promise.all([
    fetch("data/questions.json").then(r=>r.json()),
    fetch("data/questions_extra.json").then(r=>r.json()),
    fetch("data/schools.json").then(r=>r.json()),
    fetch("data/ideals.json").then(r=>r.json()),
    fetch("data/encyclopedia.json").then(r=>r.json())
  ]);
  QUESTIONS=q; EXTRA=x; SCHOOLS=s; IDEALS=i; ENCYC=e;
}
function allBaseAnswered(){ return QUESTIONS.every(q=>answers[q.id]); }
function allExtraAnswered(){ return EXTRA.every(q=>answers[q.id]); }
function answeredCount(){ if(!inExtra) return QUESTIONS.filter(q=>answers[q.id]).length; return QUESTIONS.length + EXTRA.filter(q=>answers[q.id]).length; }
function totalCount(){ return inExtra ? (QUESTIONS.length + EXTRA.length) : QUESTIONS.length; }
function estimateEta(){ const done=answeredCount(), total=totalCount(); const remain=Math.max(0,total-done); const min=Math.max(1, Math.round(remain*15/60)); return `约 ${min} 分钟`; }
function setProgress(){ const done=answeredCount(), total=totalCount(); const pct=Math.round((done/total)*100); els.progressFill.style.width=`${pct}%`; els.progressText.textContent=`${done} / ${total}`; els.etaText.textContent=estimateEta(); }
function getQuestion(i){ const pool=inExtra?EXTRA:QUESTIONS; return pool[i]; }
function escapeHtml(str){ return String(str).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function renderQuestion(){
  setProgress();
  const pool=inExtra?EXTRA:QUESTIONS;
  const q=getQuestion(idx);
  if(!q){
    els.questionCard.innerHTML=`<div class="qtitle">已完成</div><div class="qtext muted">你已完成当前题组。可以去「结果」查看。</div>`;
    els.btnNext.textContent="去看结果";
    return;
  }
  const selected=answers[q.id] ?? null;
  const badge=q.calibration?`<span class="pill">校准题</span>`:`<span class="pill">${inExtra?"加测题":"轴题"}</span>`;
  const axisLabel=q.axis?IDEALS.axes.find(a=>a.id===q.axis):null;
  const axisName=axisLabel?`${axisLabel.name_left} ←→ ${axisLabel.name_right}`:"用于拉开相邻派别";
  const scaleButtons=[1,2,3,4,5,6,7].map(n=>{
    const cls=(selected===n)?"selected":"";
    return `<button class="${cls}" type="button" data-score="${n}">${n}</button>`;
  }).join("");
  els.questionCard.innerHTML=`
    <div class="qtitle">${inExtra?"加测 ":""}${idx+1}. ${escapeHtml(q.text)}</div>
    <div class="tagrow">${badge}<span class="pill">${escapeHtml(axisName)}</span></div>
    <div class="choice">
      <div class="choice-row">
        <div class="option"><div class="option-k">更靠近左侧</div><div class="option-v">${escapeHtml(q.left)}</div></div>
        <div class="option"><div class="option-k">更靠近右侧</div><div class="option-v">${escapeHtml(q.right)}</div></div>
      </div>
      <div class="scale" aria-label="7点量表">${scaleButtons}</div>
      <div class="muted small">1 更靠近左侧，7 更靠近右侧（4 为中间）。</div>
    </div>`;
  els.questionCard.querySelectorAll(".scale button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const n=parseInt(btn.dataset.score,10);
      answers[q.id]=n;
      saveLocal();
      renderQuestion();
      autoAdvance(pool);
    });
  });

  const helpBtn = document.getElementById("btnAxisHelp");
  if(helpBtn){
    helpBtn.addEventListener("click", ()=>{
      openAxisModal(axisLabel, q);
    });
  }

  els.btnPrev.disabled=(idx===0);
  els.btnNext.textContent=(idx>=pool.length-1)?"完成并生成结果":"下一题";
}
function autoAdvance(pool){
  if(idx < pool.length-1){ setTimeout(()=>{ idx+=1; renderQuestion(); },120); }
  else{
    setTimeout(()=>{ calculateAndRender(true); location.hash="#result";
      window.scrollTo({top: document.getElementById("result").offsetTop-10, behavior:"smooth"});
    },180);
  }
}
function axisScores(){
  const axisMap={}; IDEALS.axes.forEach((a,i)=>axisMap[a.id]={sum:0,n:0,idx:i});
  const allQs=[...QUESTIONS,...EXTRA];
  for(const q of allQs){
    if(!q.axis) continue;
    if(q.calibration) continue;
    const v=answers[q.id]; if(!v) continue;
    const rightness=(v-1)/6;
    axisMap[q.axis].sum += rightness;
    axisMap[q.axis].n += 1;
  }
  const scores=new Array(IDEALS.axes.length).fill(0.5);
  for(const k of Object.keys(axisMap)){
    const it=axisMap[k];
    scores[it.idx]=(it.n>0)?(it.sum/it.n):0.5;
  }
  return scores;
}
function calibrationBonus(){
  const bonus={}; for(const s of SCHOOLS) bonus[s.id]=0;
  const allQs=[...QUESTIONS,...EXTRA];
  for(const q of allQs){
    if(!q.calibration) continue;
    const v=answers[q.id]; if(!v) continue;
    const rightness=(v-4)/3; // -1..+1
    const w=(typeof q.weight==="number")?q.weight:IDEALS.calibration_default_weight;
    for(const m of q.maps){ bonus[m.school] += (rightness*m.dir)*w; }
  }
  return bonus;
}
function similarityScores(axisVec){
  const cal=calibrationBonus();
  const sims=[];
  for(const s of SCHOOLS){
    const ideal=IDEALS.vectors[s.id];
    let dist2=0;
    for(let i=0;i<ideal.length;i++){
      const d=axisVec[i]-ideal[i];
      dist2 += d*d;
    }
    let sim=-dist2*100;
    sim += (cal[s.id]||0)*25;
    sims.push({id:s.id,name:s.name,sim});
  }
  sims.sort((a,b)=>b.sim-a.sim);
  return sims;
}
function mixRule(sims){
  const s1=sims[0], s2=sims[1];
  const ratioOk=(s2.sim >= s1.sim*IDEALS.mix_rule.ratio_threshold);
  const diffOk=((s1.sim-s2.sim) <= IDEALS.mix_rule.diff_threshold);
  return {primary:s1, secondary:(ratioOk||diffOk)?s2:null, s1, s2, ratioOk, diffOk};
}
function extraTrigger(sims){
  const s1=sims[0], s2=sims[1];
  const r=IDEALS.extra_trigger.ratio_threshold;
  const d=IDEALS.extra_trigger.diff_threshold;
  return (s2.sim >= s1.sim*r) || ((s1.sim-s2.sim) <= d);
}
function renderRadar(axisVec){
  const canvas=els.radar; if(!canvas) return;
  const ctx=canvas.getContext("2d"); const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);
  const cx=W*0.5, cy=H*0.52;
  const r=Math.min(W,H)*0.36;
  const labels=IDEALS.axes.map(a=>`${a.name_left} — ${a.name_right}`);
  const N=labels.length;
  ctx.save(); ctx.translate(cx,cy);
  ctx.strokeStyle="rgba(16,24,40,.10)"; ctx.lineWidth=1;
  for(let ring=1; ring<=4; ring++){
    const rr=r*(ring/4);
    ctx.beginPath();
    for(let i=0;i<N;i++){
      const ang=(Math.PI*2)*(i/N)-Math.PI/2;
      const x=Math.cos(ang)*rr, y=Math.sin(ang)*rr;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath(); ctx.stroke();
  }
  ctx.fillStyle="rgba(16,24,40,.70)";
  ctx.font="12px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial";
  for(let i=0;i<N;i++){
    const ang=(Math.PI*2)*(i/N)-Math.PI/2;
    const x=Math.cos(ang)*r, y=Math.sin(ang)*r;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(x,y); ctx.stroke();
    const lx=Math.cos(ang)*(r+18), ly=Math.sin(ang)*(r+18);
    ctx.textAlign=(Math.cos(ang)>0.2)?"left":(Math.cos(ang)<-0.2?"right":"center");
    ctx.textBaseline="middle";
    ctx.fillText(shorten(labels[i],20), lx, ly);
  }
  ctx.strokeStyle="rgba(74,108,247,.85)";
  ctx.fillStyle="rgba(74,108,247,.18)"; ctx.lineWidth=2;
  ctx.beginPath();
  for(let i=0;i<N;i++){
    const ang=(Math.PI*2)*(i/N)-Math.PI/2;
    const vv=clamp01(axisVec[i]);
    const rr=r*vv;
    const x=Math.cos(ang)*rr, y=Math.sin(ang)*rr;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle="rgba(74,108,247,.95)";
  for(let i=0;i<N;i++){
    const ang=(Math.PI*2)*(i/N)-Math.PI/2;
    const vv=clamp01(axisVec[i]);
    const rr=r*vv;
    const x=Math.cos(ang)*rr, y=Math.sin(ang)*rr;
    ctx.beginPath(); ctx.arc(x,y,3.5,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}
function shorten(s,n){ if(String(s).length<=n) return s; return String(s).slice(0,n-1)+"…"; }
function radarNarration(axisVec){
  const parts=IDEALS.axes.map((a,i)=>{
    const v=axisVec[i];
    const dir=(v>0.58)?"更靠近右侧":(v<0.42?"更靠近左侧":"更接近中间");
    const side=(v>0.58)?a.name_right:(v<0.42?a.name_left:"两边都能用");
    return `• ${a.name_left} ←→ ${a.name_right}：${dir}（倾向：${side}）`;
  });
  return parts.join("<br/>");
}
function renderModules(schoolId){
  const pack=ENCYC[schoolId]; if(!pack){ els.resultModules.innerHTML=""; return; }
  const mods=pack.modules||[];
  els.resultModules.innerHTML = mods.map(m=>{
    if(!m||!m.title||!m.body) return "";
    return `<div class="module"><h3>${escapeHtml(m.title)}</h3><div class="muted">${escapeHtml(m.body).replaceAll("\n","<br/>")}</div></div>`;
  }).join("");
}
function renderSimList(sims){
  els.simList.innerHTML = sims.map(s=>`<div class="simrow"><span>${escapeHtml(s.name)}</span><span>${Math.round(s.sim)}</span></div>`).join("");
}
function calculateAndRender(allowGate=false){
  if(!allBaseAnswered()){
    els.resultEmpty.style.display="block";
    els.resultBody.style.display="none";
    return null;
  }
  const axisVec=axisScores();
  const sims=similarityScores(axisVec);
  const mix=mixRule(sims);
  if(allowGate && !inExtra && EXTRA.length>0 && extraTrigger(sims) && !allExtraAnswered()){
    els.extraGate.style.display="block";
  }else{
    els.extraGate.style.display="none";
  }
  els.resultEmpty.style.display="none";
  els.resultBody.style.display="block";
  els.primarySchool.textContent=mix.primary.name;
  const sMeta=SCHOOLS.find(s=>s.id===mix.primary.id);
  els.primarySummary.textContent=sMeta ? (sMeta.oneLiner||"") : "";
  if(mix.secondary){
    els.secondaryWrap.style.display="block";
    els.secondarySchool.textContent=mix.secondary.name;
    els.secondaryNote.textContent=`次流派成立：相似度接近（规则：sim2 ≥ sim1 × ${IDEALS.mix_rule.ratio_threshold} 或差值 ≤ ${IDEALS.mix_rule.diff_threshold}）`;
  }else{
    els.secondaryWrap.style.display="none";
  }
  renderSimList(sims.slice(0,6));
  renderRadar(axisVec);
  els.radarText.innerHTML=radarNarration(axisVec);
  renderModules(mix.primary.id);
  renderEncyclopedia();
  return {axisVec, sims, mix};
}
function renderEncyclopedia(){
  if(!els.encyList || !ENCYC) return;
  const cards = SCHOOLS.map(s=>{
    const pack=ENCYC[s.id];
    const one=(pack&&pack.one)?pack.one:(s.oneLiner||"");
    const tags=(s.tag||[]).slice(0,3).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("");
    return `<div class="ency-card" data-id="${s.id}">
      <div class="ency-name">${escapeHtml(s.name)}</div>
      <div class="ency-summary">${escapeHtml(one)}</div>
      <div class="tagrow">${tags}</div>
      <div class="muted small" style="margin-top:8px;">点击展开</div>
    </div>`;
  }).join("");
  els.encyList.innerHTML=cards;
  els.encyList.querySelectorAll(".ency-card").forEach(card=>card.addEventListener("click",()=>openEncy(card.dataset.id)));
}
function openEncy(id){
  const pack=ENCYC[id];
  const meta=SCHOOLS.find(s=>s.id===id);
  if(!pack||!meta) return;
  els.encyDetail.style.display="block";
  els.encyList.style.display="none";
  const tags=(meta.tag||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("");
  const mods=(pack.modules||[]).map(m=>{
    if(!m||!m.title||!m.body) return "";
    return `<div class="module"><h3>${escapeHtml(m.title)}</h3><div class="muted">${escapeHtml(m.body).replaceAll("\n","<br/>")}</div></div>`;
  }).join("");
  els.encyDetail.innerHTML = `<div class="ency-detail-top">
      <div>
        <div class="ency-name">${escapeHtml(meta.name)}</div>
        <div class="muted" style="margin-top:6px;">${escapeHtml(pack.one||meta.oneLiner||"")}</div>
        <div class="tagrow">${tags}</div>
      </div>
      <div class="backlink" id="backToList">← 返回列表</div>
    </div>
    <div class="divider"></div>${mods}`;
  document.getElementById("backToList").addEventListener("click",()=>{
    els.encyDetail.style.display="none";
    els.encyList.style.display="grid";
  });
  setTimeout(()=>{ els.encyDetail.scrollIntoView({behavior:"smooth", block:"start"}); },80);
}
function goToFirstUnanswered(){
  const pool=inExtra?EXTRA:QUESTIONS;
  for(let i=0;i<pool.length;i++){ if(!answers[pool[i].id]){ idx=i; return; } }
  idx=Math.max(0,pool.length-1);
}
function initEvents(){
  els.btnPrev?.addEventListener("click",()=>{ idx=Math.max(0,idx-1); renderQuestion(); });
  els.btnNext?.addEventListener("click",()=>{
    const pool=inExtra?EXTRA:QUESTIONS;
    const q=getQuestion(idx);
    if(!q){ calculateAndRender(true); location.hash="#result"; return; }
    if(q && !answers[q.id]){
      els.questionCard.querySelectorAll(".scale button").forEach(b=>b.style.boxShadow="0 0 0 3px rgba(226,59,59,.10)");
      setTimeout(()=>els.questionCard.querySelectorAll(".scale button").forEach(b=>b.style.boxShadow=""),350);
      return;
    }
    if(idx<pool.length-1){ idx+=1; renderQuestion(); }
    else{
      calculateAndRender(true);
      location.hash="#result";
      window.scrollTo({top: document.getElementById("result").offsetTop-10, behavior:"smooth"});
    }
  });
  els.btnReset?.addEventListener("click",()=>{
    if(!confirm("确认清空本地作答并重新开始？")) return;
    answers={}; clearLocal(); inExtra=false; idx=0;
    renderQuestion(); calculateAndRender(false);
  });
  els.btnResume?.addEventListener("click",()=>{
    answers=loadLocal();
    inExtra = EXTRA.some(q=>answers[q.id]);
    goToFirstUnanswered();
    renderQuestion();
    calculateAndRender(true);
    window.scrollTo({top: document.getElementById("start").offsetTop-10, behavior:"smooth"});
  });
  els.btnRecalc?.addEventListener("click",()=>{ calculateAndRender(true); alert("已重新计算。"); });
  els.btnShare?.addEventListener("click",()=>{
    if(!allBaseAnswered()){ alert("请先完成 24 题再复制结果摘要。"); return; }
    const axisVec=axisScores();
    const sims=similarityScores(axisVec);
    const mix=mixRule(sims);
    const text=[`社会问题解释谱系测试结果`,`主流派：${mix.primary.name}`,mix.secondary?`次流派：${mix.secondary.name}`:`次流派：无（主结果更明确）`,`解释路径：`,
      ...IDEALS.axes.map((a,i)=>{
        const v=axisVec[i];
        const dir=(v>0.58)?`更靠近右侧（${a.name_right}）`:(v<0.42?`更靠近左侧（${a.name_left}）`:`中间（两边都能用）`);
        return `- ${a.name_left} ←→ ${a.name_right}：${dir}`;
      })
    ].join("\n");
    navigator.clipboard.writeText(text).then(()=>alert("已复制到剪贴板。")).catch(()=>prompt("复制下面文本：",text));
  });
  els.btnDoExtra?.addEventListener("click",()=>{ inExtra=true; idx=0; renderQuestion(); els.extraGate.style.display="none";
    window.scrollTo({top: document.getElementById("start").offsetTop-10, behavior:"smooth"}); });
  els.btnSkipExtra?.addEventListener("click",()=>{ els.extraGate.style.display="none"; location.hash="#result";
    window.scrollTo({top: document.getElementById("result").offsetTop-10, behavior:"smooth"}); });
}

function ensureModal(){
  if(document.getElementById("axisModal")) return;
  const div = document.createElement("div");
  div.id = "axisModal";
  div.style.position="fixed";
  div.style.inset="0";
  div.style.background="rgba(16,24,40,.45)";
  div.style.display="none";
  div.style.zIndex="50";
  div.innerHTML = `
    <div class="card" style="max-width:920px; margin: 6vh auto; padding: 16px; position:relative;">
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start; flex-wrap:wrap;">
        <div>
          <div style="font-weight:950; font-size:18px;">解释倾向（5 轴）</div>
          <div id="axisModalSub" class="muted small" style="margin-top:6px;"></div>
        </div>
        <button id="axisModalClose" class="btn" type="button">关闭</button>
      </div>
      <div class="divider"></div>
      <div id="axisModalBody"></div>
    </div>
  `;
  document.body.appendChild(div);
  div.addEventListener("click", (e)=>{ if(e.target === div) closeAxisModal(); });
  document.getElementById("axisModalClose").addEventListener("click", closeAxisModal);
}

function closeAxisModal(){
  const m = document.getElementById("axisModal");
  if(m) m.style.display="none";
}

function openAxisModal(axisLabel, q){
  ensureModal();
  const m = document.getElementById("axisModal");
  const body = document.getElementById("axisModalBody");
  const sub = document.getElementById("axisModalSub");

  const focus = axisLabel ? `${axisLabel.name_left} ←→ ${axisLabel.name_right}` : "（本题为校准题，用于区分相邻派别）";
  sub.textContent = `当前题关注：${focus}`;

  const rows = IDEALS.axes.map(a=>{
    return `
      <div class="module" style="margin:0 0 10px;">
        <h3 style="margin:0 0 6px;">${escapeHtml(a.name_left)} ←→ ${escapeHtml(a.name_right)}</h3>
        <div class="muted">${escapeHtml(a.human || "")}</div>
        ${a.example ? `<div class="muted small" style="margin-top:6px;">例：${escapeHtml(a.example)}</div>` : ``}
      </div>
    `;
  }).join("");

  body.innerHTML = rows + `
    <div class="callout" style="margin-top:10px;">
      <div class="callout-title">怎么选更“准”？</div>
      <div class="callout-body">按“你更常用的解释方式”作答，而不是按“你认为应该怎样”。如果两边都能用，选 4 或靠近你更常用的一侧。</div>
    </div>
  `;

  m.style.display="block";
}


async function main(){
  await loadAll();
  answers=loadLocal();
  inExtra = EXTRA.some(q=>answers[q.id]);
  goToFirstUnanswered();
  renderQuestion();
  renderEncyclopedia();
  calculateAndRender(true);
  initEvents();
}
main();
