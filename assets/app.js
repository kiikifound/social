/* V2 Pro UI Fix: page-separated app.js (test/result/encyclopedia/about) */

const LS_KEY = "social_genealogy_v2pro_answers";

let QUESTIONS = [];
let EXTRA = [];
let SCHOOLS = [];
let IDEALS = null;
let ENCYC = null;

let idx = 0;
let inExtra = false;
let answers = {}; // id -> 1..7

const PAGE = document.body?.dataset?.page || "unknown";

// --- glossary: terms -> explanation ---
const GLOSSARY = {
  "失范": "失范（anomie）：规范与社会整合变弱时，人们对“该怎么做”缺少稳定预期，偏差/焦虑更容易出现。",
  "规训": "规训：通过制度、规则、评价体系与日常训练，让人把外部要求内化成自我约束。",
  "话语": "话语：不仅是“说法”，还包括哪些说法被当成合理/可说、谁有资格定义问题、哪些概念被用来分类现实。",
  "权力-知识": "权力-知识：知识体系（分类、指标、专业判断）与权力运作相互支撑；“被定义为真”会影响治理与主体。",
  "再生产": "再生产：不平等/优势通过制度与文化机制不断延续（代际传递、规则偏好、资源积累）。",
  "结构性": "结构性：问题并非少数个体失误，而是由稳定的制度安排、资源分配与关系网络所生成。",
  "意识形态": "意识形态：让某种权力/分配看起来“自然合理”的观念体系；它会影响人们如何理解自身处境。",
  "标签": "标签：互动中对人的分类与命名（如“差生”“问题青年”），会影响他人对其期待，也会影响自我认同与行为。",
  "定义情境": "定义情境：人们如何理解“现在发生了什么、该如何行动”。不同定义会导向不同互动策略与结果。"
};

function clamp01(x){ return Math.max(0, Math.min(1, x)); }
function $(id){ return document.getElementById(id); }

function loadLocal(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return {};
    const obj = JSON.parse(raw);
    if(typeof obj !== "object" || obj === null) return {};
    return obj;
  }catch(e){ return {}; }
}
function saveLocal(){ localStorage.setItem(LS_KEY, JSON.stringify(answers)); }
function clearLocal(){ localStorage.removeItem(LS_KEY); }

async function loadAll(){
  const [q, x, s, i, e] = await Promise.all([
    fetch("data/questions.json").then(r=>r.json()),
    fetch("data/questions_extra.json").then(r=>r.json()),
    fetch("data/schools.json").then(r=>r.json()),
    fetch("data/ideals.json").then(r=>r.json()),
    fetch("data/encyclopedia.json").then(r=>r.json())
  ]);
  QUESTIONS = q;
  EXTRA = x;
  SCHOOLS = s;
  IDEALS = i;
  ENCYC = e;
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// --- modal ---
function modalOpen(title, bodyHtml){
  const bd = $("modalBackdrop");
  const t = $("modalTitle");
  const b = $("modalBody");
  if(!bd || !t || !b) return;
  t.textContent = title || "提示";
  b.innerHTML = bodyHtml || "";
  bd.style.display = "flex";
}
function modalClose(){
  const bd = $("modalBackdrop");
  if(!bd) return;
  bd.style.display = "none";
}
function bindModal(){
  $("modalClose")?.addEventListener("click", modalClose);
  $("modalBackdrop")?.addEventListener("click", (e)=>{
    if(e.target && e.target.id === "modalBackdrop") modalClose();
  });
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape") modalClose();
  });
}

// --- shared scoring ---
function allBaseAnswered(){
  return QUESTIONS.every(q=>answers[q.id]);
}
function axisScores(){
  const axisMap = {};
  IDEALS.axes.forEach((a, i)=>{ axisMap[a.id] = {sum:0, n:0, idx:i}; });

  const allQs = [...QUESTIONS, ...EXTRA];
  for(const q of allQs){
    if(!q.axis) continue;
    if(q.calibration) continue;
    const v = answers[q.id];
    if(!v) continue;
    const rightness = (v - 1) / 6;
    axisMap[q.axis].sum += rightness;
    axisMap[q.axis].n += 1;
  }

  const scores = new Array(IDEALS.axes.length).fill(0.5);
  for(const k of Object.keys(axisMap)){
    const it = axisMap[k];
    scores[it.idx] = (it.n > 0) ? (it.sum / it.n) : 0.5;
  }
  return scores;
}

function calibrationBonus(){
  const bonus = {};
  for(const s of SCHOOLS){ bonus[s.id] = 0; }

  const allQs = [...QUESTIONS, ...EXTRA];
  for(const q of allQs){
    if(!q.calibration) continue;
    const v = answers[q.id];
    if(!v) continue;
    const rightness = (v - 4) / 3; // -1..+1
    const w = (typeof q.weight === "number") ? q.weight : IDEALS.calibration_default_weight;
    for(const m of q.maps){
      bonus[m.school] += (rightness * m.dir) * w;
    }
  }
  return bonus;
}

function similarityScores(axisVec){
  const cal = calibrationBonus();
  const sims = [];
  for(const s of SCHOOLS){
    const ideal = IDEALS.vectors[s.id];
    let dist2 = 0;
    for(let i=0;i<ideal.length;i++){
      const d = axisVec[i] - ideal[i];
      dist2 += d*d;
    }
    let sim = -dist2 * 100;
    sim += (cal[s.id] || 0) * 25;
    sims.push({id:s.id, name:s.name, sim});
  }
  sims.sort((a,b)=>b.sim - a.sim);
  return sims;
}

function mixRule(sims){
  const s1 = sims[0], s2 = sims[1];
  const ratioOk = (s2.sim >= s1.sim * IDEALS.mix_rule.ratio_threshold);
  const diffOk = ((s1.sim - s2.sim) <= IDEALS.mix_rule.diff_threshold);
  return {primary:s1, secondary:(ratioOk || diffOk) ? s2 : null};
}

function extraTrigger(sims){
  const s1 = sims[0], s2 = sims[1];
  const r = IDEALS.extra_trigger.ratio_threshold;
  const d = IDEALS.extra_trigger.diff_threshold;
  return (s2.sim >= s1.sim * r) || ((s1.sim - s2.sim) <= d);
}

// --- TEST PAGE ---
function answeredCount(){
  if(!inExtra) return QUESTIONS.filter(q=>answers[q.id]).length;
  return QUESTIONS.length + EXTRA.filter(q=>answers[q.id]).length;
}
function totalCount(){
  return inExtra ? (QUESTIONS.length + EXTRA.length) : QUESTIONS.length;
}
function estimateEta(){
  const done = answeredCount();
  const total = totalCount();
  const remain = Math.max(0, total - done);
  const min = Math.max(1, Math.round(remain * 15 / 60));
  return `约 ${min} 分钟`;
}
function setProgress(){
  const done = answeredCount();
  const total = totalCount();
  const pct = Math.round((done / total) * 100);
  $("progressFill").style.width = `${pct}%`;
  $("progressText").textContent = `${done} / ${total}`;
  $("etaText").textContent = estimateEta();
}
function getQuestion(i){
  const pool = inExtra ? EXTRA : QUESTIONS;
  return pool[i];
}
function detectTerms(text){
  const found = [];
  for(const term of Object.keys(GLOSSARY)){
    if(text.includes(term)) found.push(term);
  }
  // also detect common phrases
  if(text.includes("标签") && !found.includes("标签")) found.push("标签");
  if(text.includes("定义情境") && !found.includes("定义情境")) found.push("定义情境");
  return found.slice(0, 6);
}

function renderQuestion(){
  setProgress();
  const pool = inExtra ? EXTRA : QUESTIONS;
  const q = getQuestion(idx);

  if(!q){
    // finished current pool; go result
    window.location.href = "result.html";
    return;
  }

  const selected = answers[q.id] ?? null;
  const badge = q.calibration ? `<span class="pill">校准题</span>` : `<span class="pill">${inExtra ? "加测题" : "轴题"}</span>`;
  const axisLabel = q.axis ? IDEALS.axes.find(a=>a.id===q.axis) : null;
  const axisName = axisLabel ? `${axisLabel.name_left} ←→ ${axisLabel.name_right}` : "用于拉开相邻派别";

  const scaleButtons = [1,2,3,4,5,6,7].map(n=>{
    const cls = (selected === n) ? "selected" : "";
    return `<button class="${cls}" type="button" data-score="${n}">${n}</button>`;
  }).join("");

  const termText = `${q.text} ${q.left} ${q.right}`;
  const terms = detectTerms(termText);
  const chips = terms.length ? `
    <div class="chiprow" aria-label="术语解释">
      ${terms.map(t=>`<button class="chip" type="button" data-term="${escapeHtml(t)}">术语：${escapeHtml(t)}</button>`).join("")}
      <button class="chip" type="button" data-term="怎么看题">怎么看题？</button>
    </div>
  ` : `<div class="chiprow"><button class="chip" type="button" data-term="怎么看题">怎么看题？</button></div>`;

  const qNo = idx + 1;
  const qTotal = pool.length;

  $("questionCard").innerHTML = `
    <div class="qtitle">${qNo}. ${escapeHtml(q.text)}</div>
    <div class="tagrow">
      ${badge}
      <span class="pill">${escapeHtml(axisName)}</span>
    </div>

    <div class="choice">
      <div class="choice-row">
        <div class="option">
          <div class="option-k">更靠近左侧</div>
          <div class="option-v">${escapeHtml(q.left)}</div>
        </div>
        <div class="option">
          <div class="option-k">更靠近右侧</div>
          <div class="option-v">${escapeHtml(q.right)}</div>
        </div>
      </div>

      <div class="scale" aria-label="7点量表">
        ${scaleButtons}
      </div>

      <div class="muted small">1 更靠近左侧，7 更靠近右侧（4 为中间）。</div>
      ${chips}
    </div>
  `;

  // scale click
  document.querySelectorAll(".scale button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const n = parseInt(btn.dataset.score, 10);
      answers[q.id] = n;
      saveLocal();
      renderQuestion();
      autoAdvance(pool);
    });
  });

  // chips click
  document.querySelectorAll(".chip").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const term = btn.dataset.term;
      if(term === "怎么看题"){
        modalOpen("怎么看题？", `
          <div>这套题测的是你“更常用的解释方式”。</div>
          <div style="margin-top:8px;">如果两边你都觉得对，请选<strong>你更先想到、或更常用</strong>的一边；中间值 4 代表“差不多”。</div>
          <div style="margin-top:8px;">遇到不熟的词，点上面的“术语”即可查看解释。</div>
        `);
        return;
      }
      const exp = GLOSSARY[term] || "暂无该术语解释。";
      modalOpen(`术语：${term}`, `<div>${escapeHtml(exp)}</div>`);
    });
  });

  // prev/next labels
  $("btnPrev").disabled = (idx === 0);
  $("btnNext").textContent = (idx >= pool.length - 1) ? "完成并生成结果" : "下一题";
}

function autoAdvance(pool){
  // if last question answered, decide extra gate or go result
  if(idx < pool.length - 1){
    setTimeout(()=>{ idx += 1; renderQuestion(); }, 120);
    return;
  }

  // finished current pool
  if(!inExtra){
    // base finished
    const axisVec = axisScores();
    const sims = similarityScores(axisVec);

    if(EXTRA.length > 0 && extraTrigger(sims) && !EXTRA.every(q=>answers[q.id])){
      $("extraGate").style.display = "block";
      return;
    }
  }

  // go result page
  window.location.href = "result.html";
}

function goToFirstUnanswered(){
  const pool = inExtra ? EXTRA : QUESTIONS;
  for(let i=0;i<pool.length;i++){
    if(!answers[pool[i].id]){ idx = i; return; }
  }
  idx = Math.max(0, pool.length - 1);
}

function initTestEvents(){
  $("btnPrev")?.addEventListener("click", ()=>{
    idx = Math.max(0, idx - 1);
    renderQuestion();
  });

  $("btnNext")?.addEventListener("click", ()=>{
    const pool = inExtra ? EXTRA : QUESTIONS;
    const q = getQuestion(idx);

    if(!q){ window.location.href = "result.html"; return; }

    if(q && !answers[q.id]){
      document.querySelectorAll(".scale button").forEach(b=>b.style.boxShadow="0 0 0 3px rgba(226,59,59,.10)");
      setTimeout(()=>document.querySelectorAll(".scale button").forEach(b=>b.style.boxShadow=""), 350);
      return;
    }

    if(idx < pool.length - 1){
      idx += 1;
      renderQuestion();
      return;
    }

    // last question: same logic as autoAdvance
    autoAdvance(pool);
  });

  $("btnReset")?.addEventListener("click", ()=>{
    if(!confirm("确认清空本地作答并重新开始？")) return;
    answers = {};
    clearLocal();
    inExtra = false;
    idx = 0;
    $("extraGate").style.display = "none";
    renderQuestion();
  });

  $("btnResume")?.addEventListener("click", ()=>{
    answers = loadLocal();
    inExtra = EXTRA.some(q=>answers[q.id]);
    $("extraGate").style.display = "none";
    goToFirstUnanswered();
    renderQuestion();
    window.scrollTo({top: 0, behavior:"smooth"});
  });

  $("btnDoExtra")?.addEventListener("click", ()=>{
    inExtra = true;
    idx = 0;
    $("extraGate").style.display = "none";
    renderQuestion();
    window.scrollTo({top: 0, behavior:"smooth"});
  });

  $("btnSkipExtra")?.addEventListener("click", ()=>{
    $("extraGate").style.display = "none";
    window.location.href = "result.html";
  });
}

// --- RESULT PAGE ---
function renderRadar(axisVec){
  const canvas = $("radar");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  const cx = W * 0.5, cy = H * 0.52;
  const r = Math.min(W, H) * 0.36;

  const labels = IDEALS.axes.map(a=>`${a.name_left} — ${a.name_right}`);
  const N = labels.length;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = "rgba(16,24,40,.10)";
  ctx.lineWidth = 1;

  for(let ring=1; ring<=4; ring++){
    const rr = r * (ring/4);
    ctx.beginPath();
    for(let i=0;i<N;i++){
      const ang = (Math.PI*2) * (i/N) - Math.PI/2;
      const x = Math.cos(ang)*rr;
      const y = Math.sin(ang)*rr;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(16,24,40,.70)";
  ctx.font = "12px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial";
  for(let i=0;i<N;i++){
    const ang = (Math.PI*2) * (i/N) - Math.PI/2;
    const x = Math.cos(ang)*r;
    const y = Math.sin(ang)*r;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(x,y); ctx.stroke();

    const lx = Math.cos(ang)*(r+18);
    const ly = Math.sin(ang)*(r+18);
    ctx.textAlign = (Math.cos(ang) > 0.2) ? "left" : (Math.cos(ang) < -0.2 ? "right" : "center");
    ctx.textBaseline = "middle";
    ctx.fillText(shorten(labels[i], 20), lx, ly);
  }

  ctx.strokeStyle = "rgba(74,108,247,.85)";
  ctx.fillStyle = "rgba(74,108,247,.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for(let i=0;i<N;i++){
    const ang = (Math.PI*2) * (i/N) - Math.PI/2;
    const vv = clamp01(axisVec[i]);
    const rr = r * vv;
    const x = Math.cos(ang)*rr;
    const y = Math.sin(ang)*rr;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(74,108,247,.95)";
  for(let i=0;i<N;i++){
    const ang = (Math.PI*2) * (i/N) - Math.PI/2;
    const vv = clamp01(axisVec[i]);
    const rr = r * vv;
    const x = Math.cos(ang)*rr;
    const y = Math.sin(ang)*rr;
    ctx.beginPath(); ctx.arc(x,y,3.5,0,Math.PI*2); ctx.fill();
  }

  ctx.restore();
}

function shorten(s, n){
  if(String(s).length <= n) return s;
  return String(s).slice(0, n-1) + "…";
}

function radarNarration(axisVec){
  const parts = IDEALS.axes.map((a, i)=>{
    const v = axisVec[i];
    const dir = (v > 0.58) ? "更靠近右侧" : (v < 0.42 ? "更靠近左侧" : "更接近中间");
    const side = (v > 0.58) ? a.name_right : (v < 0.42 ? a.name_left : "两边都能用");
    return `• ${a.name_left} ←→ ${a.name_right}：${dir}（倾向：${side}）`;
  });
  return parts.join("<br/>");
}

function renderSimList(sims){
  $("simList").innerHTML = sims.map(s=>{
    return `<div class="simrow"><span>${escapeHtml(s.name)}</span><span>${Math.round(s.sim)}</span></div>`;
  }).join("");
}

function renderModules(schoolId){
  const pack = ENCYC[schoolId];
  if(!pack){ $("resultModules").innerHTML = ""; return; }
  const mods = pack.modules || [];
  $("resultModules").innerHTML = mods.map(m=>{
    if(!m || !m.title || !m.body) return "";
    return `
      <div class="module">
        <h3>${escapeHtml(m.title)}</h3>
        <div class="muted">${escapeHtml(m.body).replaceAll("\n","<br/>")}</div>
      </div>
    `;
  }).join("");
}

function calculateAndRenderResult(){
  if(!allBaseAnswered()){
    $("resultEmpty").style.display = "block";
    $("resultBody").style.display = "none";
    return;
  }
  $("resultEmpty").style.display = "none";
  $("resultBody").style.display = "block";

  const axisVec = axisScores();
  const sims = similarityScores(axisVec);
  const mix = mixRule(sims);

  $("primarySchool").textContent = mix.primary.name;
  const sMeta = SCHOOLS.find(s=>s.id===mix.primary.id);
  $("primarySummary").textContent = sMeta ? (sMeta.oneLiner || "") : "";

  if(mix.secondary){
    $("secondaryWrap").style.display = "block";
    $("secondarySchool").textContent = mix.secondary.name;
    $("secondaryNote").textContent = `次流派成立：相似度接近（规则：sim2 ≥ sim1 × ${IDEALS.mix_rule.ratio_threshold} 或差值 ≤ ${IDEALS.mix_rule.diff_threshold}）`;
  }else{
    $("secondaryWrap").style.display = "none";
  }

  renderSimList(sims.slice(0, 6));
  renderRadar(axisVec);
  $("radarText").innerHTML = radarNarration(axisVec);
  renderModules(mix.primary.id);
}

function initResultEvents(){
  $("btnRecalc")?.addEventListener("click", ()=>{
    answers = loadLocal();
    inExtra = EXTRA.some(q=>answers[q.id]);
    calculateAndRenderResult();
    alert("已重新计算。");
  });

  $("btnShare")?.addEventListener("click", ()=>{
    if(!allBaseAnswered()){
      alert("请先完成 24 题再复制结果摘要。");
      return;
    }
    const axisVec = axisScores();
    const sims = similarityScores(axisVec);
    const mix = mixRule(sims);
    const text = [
      `社会问题解释谱系测试结果`,
      `主流派：${mix.primary.name}`,
      mix.secondary ? `次流派：${mix.secondary.name}` : `次流派：无（主结果更明确）`,
      `解释路径：`,
      ...IDEALS.axes.map((a,i)=>{
        const v = axisVec[i];
        const dir = (v > 0.58) ? `更靠近右侧（${a.name_right}）` : (v < 0.42 ? `更靠近左侧（${a.name_left}）` : `中间（两边都能用）`);
        return `- ${a.name_left} ←→ ${a.name_right}：${dir}`;
      })
    ].join("\n");

    navigator.clipboard.writeText(text).then(()=>alert("已复制到剪贴板。")).catch(()=>prompt("复制下面文本：", text));
  });
}

// --- ENCYCLOPEDIA PAGE ---
function renderEncyclopediaList(){
  const list = $("encyList");
  if(!list) return;

  const cards = SCHOOLS.map(s=>{
    const pack = ENCYC[s.id];
    const one = (pack && pack.one) ? pack.one : (s.oneLiner || "");
    const tags = (s.tag || []).slice(0,3).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("");
    return `
      <div class="ency-card" data-id="${s.id}">
        <div class="ency-name">${escapeHtml(s.name)}</div>
        <div class="ency-summary">${escapeHtml(one)}</div>
        <div class="tagrow">${tags}</div>
        <div class="muted small" style="margin-top:8px;">点击展开</div>
      </div>
    `;
  }).join("");

  list.innerHTML = cards;
  list.querySelectorAll(".ency-card").forEach(card=>{
    card.addEventListener("click", ()=>openEncy(card.dataset.id));
  });
}

function openEncy(id){
  const pack = ENCYC[id];
  const meta = SCHOOLS.find(s=>s.id===id);
  if(!pack || !meta) return;

  $("encyDetail").style.display = "block";
  $("encyList").style.display = "none";

  const tags = (meta.tag || []).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("");
  const mods = (pack.modules || []).map(m=>{
    if(!m || !m.title || !m.body) return "";
    return `
      <div class="module">
        <h3>${escapeHtml(m.title)}</h3>
        <div class="muted">${escapeHtml(m.body).replaceAll("\n","<br/>")}</div>
      </div>
    `;
  }).join("");

  $("encyDetail").innerHTML = `
    <div class="ency-detail-top">
      <div>
        <div class="ency-name">${escapeHtml(meta.name)}</div>
        <div class="muted" style="margin-top:6px;">${escapeHtml(pack.one || meta.oneLiner || "")}</div>
        <div class="tagrow">${tags}</div>
      </div>
      <div class="backlink" id="backToList">← 返回列表</div>
    </div>
    <div class="divider"></div>
    ${mods}
  `;

  $("backToList")?.addEventListener("click", ()=>{
    $("encyDetail").style.display = "none";
    $("encyList").style.display = "grid";
  });

  setTimeout(()=>{ $("encyDetail").scrollIntoView({behavior:"smooth", block:"start"}); }, 80);
}

// --- main ---
async function main(){
  bindModal();
  await loadAll();
  answers = loadLocal();
  inExtra = EXTRA.some(q=>answers[q.id]);

  if(PAGE === "test"){
    // only questions on this page
    $("extraGate").style.display = "none";
    // if base fully answered and extra not triggered, still allow redo; go to first unanswered
    const pool = inExtra ? EXTRA : QUESTIONS;
    // determine idx
    const currentPool = inExtra ? EXTRA : QUESTIONS;
    for(let i=0;i<currentPool.length;i++){
      if(!answers[currentPool[i].id]){ idx = i; break; }
    }
    renderQuestion();
    initTestEvents();
  }

  if(PAGE === "result"){
    calculateAndRenderResult();
    initResultEvents();
  }

  if(PAGE === "encyclopedia"){
    renderEncyclopediaList();
  }
}

main();
