// @ts-nocheck
import { useState, useEffect, useCallback } from "react";

// ── CONFIG ────────────────────────────────────────
const SB_URL = "https://sxboyjsdsqjgvmsqxuax.supabase.co/rest/v1";
const SB_KEY = "sb_publishable_vmPyu_Hgar6tyQ0r3Fi33w_ypdzc4qZ";
const HEADERS = {
  "apikey": SB_KEY,
  "Authorization": `Bearer ${SB_KEY}`,
  "Content-Type": "application/json",
};

const PLAYERS     = ["Jerom", "Josh", "Christian", "Feby", "Isaiah", "Ethan"];
const ADMIN_PW    = "showtime";
const TOTAL_WEEKS = 20;
const AWARDS = [
  { id: "mvp",        label: "MVP",        full: "Most Valuable Player",    emoji: "🏆", color: "#FFB800", glow: "rgba(255,184,0,.5)"   },
  { id: "dpoy",       label: "DPOY",       full: "Best Defender",           emoji: "🛡️", color: "#4FC3F7", glow: "rgba(79,195,247,.5)"  },
  { id: "bricklayer", label: "Bricklayer", full: "Worst Shooter",           emoji: "🧱", color: "#FF6B6B", glow: "rgba(255,107,107,.5)" },
];
const PTS = [3, 2, 1];
const SAT_OUT = "__sat_out__";

const G = { bg:"#08080C", surface:"#0F0F16", border:"#1C1C28", muted:"#2A2A3C", sub:"#52527A", text:"#E0E0F0" };

// ── Supabase helpers ──────────────────────────────
const db = {
  getWeek: async () => {
    const r = await fetch(`${SB_URL}/week_state?select=current_week`, { headers: HEADERS });
    const d = await r.json();
    return d[0]?.current_week ?? 1;
  },
  setWeek: async (w) => {
    await fetch(`${SB_URL}/week_state?id=eq.1`, {
      method:"PATCH", headers:{...HEADERS,"Prefer":"return=minimal"},
      body: JSON.stringify({ current_week: w }),
    });
  },
  getVotes: async (week=null) => {
    const q = week ? `?week_number=eq.${week}&select=*` : `?select=*`;
    const r = await fetch(`${SB_URL}/votes${q}`, { headers: HEADERS });
    return r.ok ? r.json() : [];
  },
  upsertVote: async (week, voter, award, nominee, points) => {
    await fetch(`${SB_URL}/votes`, {
      method:"POST",
      headers:{...HEADERS,"Prefer":"resolution=merge-duplicates,return=minimal"},
      body: JSON.stringify({ week_number:week, voter, award, nominee, points }),
    });
  },
  setSatOut: async (week, voter) => {
    await fetch(`${SB_URL}/votes`, {
      method:"POST",
      headers:{...HEADERS,"Prefer":"resolution=merge-duplicates,return=minimal"},
      body: JSON.stringify({ week_number:week, voter, award:SAT_OUT, nominee:SAT_OUT, points:0 }),
    });
  },
  removeSatOut: async (week, voter) => {
    await fetch(`${SB_URL}/votes?week_number=eq.${week}&voter=eq.${encodeURIComponent(voter)}&award=eq.${SAT_OUT}`, {
      method:"DELETE", headers: HEADERS,
    });
  },
  resetWeek: async (week) => {
    await fetch(`${SB_URL}/votes?week_number=eq.${week}`, {
      method:"DELETE", headers: HEADERS,
    });
  },
};

// ── Parse raw rows into { name: { awardId: {3,2,1}, __sat_out__: bool } }
const parseVotes = (rows) => {
  const out = {};
  for (const row of rows) {
    if (!out[row.voter]) out[row.voter] = {};
    if (row.award === SAT_OUT) { out[row.voter][SAT_OUT] = true; }
    else {
      if (!out[row.voter][row.award]) out[row.voter][row.award] = {};
      out[row.voter][row.award][row.points] = row.nominee;
    }
  }
  return out;
};

const playerDone   = (parsed, name) => {
  const pv = parsed[name];
  if (!pv) return false;
  if (pv[SAT_OUT]) return true;
  return AWARDS.every(a => pv[a.id] && PTS.every(p => pv[a.id][p]));
};
const playerSatOut = (parsed, name) => !!parsed[name]?.[SAT_OUT];

// ── CSS ───────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#08080C}
  ::-webkit-scrollbar{width:2px}::-webkit-scrollbar-thumb{background:#1c1c28;border-radius:2px}
  input:focus,button:focus{outline:none}input::placeholder{color:#252535}
  @keyframes up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes drift{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-16px) rotate(1.5deg)}}
  @keyframes glow{0%,100%{opacity:.55}50%{opacity:1}}
  @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
  @keyframes pop{0%{transform:scale(.8);opacity:0}65%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}
  .u0{animation:up .4s ease both}.u1{animation:up .4s .07s ease both}.u2{animation:up .4s .14s ease both}
  .u3{animation:up .4s .21s ease both}.u4{animation:up .4s .28s ease both}.u5{animation:up .4s .35s ease both}
  .pop{animation:pop .28s cubic-bezier(.34,1.56,.64,1) both}
`;

// ── Tiny shared components ────────────────────────
function Ambient() {
  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
      <div style={{position:"absolute",top:"-25%",left:"-15%",width:"70vw",height:"70vw",borderRadius:"50%",background:"radial-gradient(circle,rgba(255,184,0,.045) 0%,transparent 65%)"}}/>
      <div style={{position:"absolute",bottom:"-15%",right:"-10%",width:"55vw",height:"55vw",borderRadius:"50%",background:"radial-gradient(circle,rgba(79,195,247,.04) 0%,transparent 65%)"}}/>
      <svg style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",opacity:.014}} xmlns="http://www.w3.org/2000/svg">
        <defs><pattern id="dot" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1" fill="#fff"/></pattern></defs>
        <rect width="100%" height="100%" fill="url(#dot)"/>
      </svg>
    </div>
  );
}
function Pill({children,color="#FFB800"}) {
  return <span style={{display:"inline-flex",alignItems:"center",background:`${color}14`,border:`1px solid ${color}30`,borderRadius:999,padding:"3px 12px",color,fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",fontFamily:"DM Sans,sans-serif"}}>{children}</span>;
}
function Spinner() {
  return <div style={{width:26,height:26,border:`2px solid ${G.border}`,borderTop:"2px solid #FFB800",borderRadius:"50%",animation:"spin .7s linear infinite",margin:"0 auto"}}/>;
}

// ════════════════════════════════════════════════
// HOME
// ════════════════════════════════════════════════
function Home({week,parsed,loading,onVote,onSitOut,onAdmin}) {
  const done   = n => playerDone(parsed,n);
  const sitOut = n => playerSatOut(parsed,n);
  const count  = PLAYERS.filter(done).length;
  const pct    = Math.round((week/TOTAL_WEEKS)*100);
  return (
    <div style={{maxWidth:420,margin:"0 auto",padding:"28px 20px 80px",fontFamily:"DM Sans,sans-serif"}}>
      <div className="u0" style={{marginBottom:28}}>
        <Pill>Season {new Date().getFullYear()}</Pill>
        <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:12,marginBottom:8}}>
          <span style={{fontFamily:"Syne",fontWeight:800,fontSize:52,background:"linear-gradient(150deg,#fff 20%,#3a3a55 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:-2,lineHeight:1}}>
            Week {String(week).padStart(2,"0")}
          </span>
          <span style={{fontFamily:"Syne",fontWeight:700,fontSize:20,color:G.muted}}>/ {TOTAL_WEEKS}</span>
        </div>
        <div style={{height:2,background:G.border,borderRadius:2,overflow:"hidden",marginBottom:7}}>
          <div style={{height:"100%",borderRadius:2,width:`${pct}%`,background:"linear-gradient(90deg,#FFB800,#FF6B6B)",transition:"width 1s ease"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <span style={{color:G.sub,fontSize:12}}>{pct}% of season complete</span>
          <span style={{color:count===PLAYERS.length?"#4ade80":"#FFB800",fontSize:12,fontWeight:600}}>{count}/{PLAYERS.length} done this week</span>
        </div>
      </div>

      <div className="u1" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:28}}>
        {AWARDS.map(a=>(
          <div key={a.id} style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:16,padding:"14px 8px",textAlign:"center",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:"80%",height:1,background:`linear-gradient(90deg,transparent,${a.color}40,transparent)`}}/>
            <div style={{fontSize:22,marginBottom:5,filter:`drop-shadow(0 0 8px ${a.glow})`}}>{a.emoji}</div>
            <div style={{fontFamily:"Syne",fontWeight:800,fontSize:13,color:a.color,letterSpacing:.5}}>{a.label}</div>
            <div style={{color:G.sub,fontSize:9,marginTop:2,letterSpacing:1.5}}>3·2·1 PTS</div>
          </div>
        ))}
      </div>

      <p className="u2" style={{color:G.sub,fontSize:10,fontWeight:700,letterSpacing:2.5,marginBottom:14}}>TAP YOUR NAME TO VOTE</p>
      {loading ? <div style={{padding:40}}><Spinner/></div> : (
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {PLAYERS.map((name,i)=>{
            const voted=done(name), isOut=sitOut(name);
            return (
              <div key={name} className={`u${Math.min(i+2,5)}`} style={{display:"flex",alignItems:"center",gap:6}}>
                <button onClick={()=>!voted&&onVote(name)}
                  style={{flex:1,background:voted?"#090910":G.surface,border:`1px solid ${isOut?"#1a1a1a":voted?"#111":G.border}`,borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:voted?"default":"pointer",opacity:isOut?0.25:voted?0.4:1,transition:"border-color .2s,transform .15s",textAlign:"left"}}
                  onMouseEnter={e=>{if(!voted){e.currentTarget.style.borderColor="#FFB80045";e.currentTarget.style.transform="translateX(3px)";}}}
                  onMouseLeave={e=>{if(!voted){e.currentTarget.style.borderColor=G.border;e.currentTarget.style.transform="translateX(0)";}}}
                >
                  <div style={{display:"flex",alignItems:"center",gap:13}}>
                    <div style={{width:36,height:36,borderRadius:12,background:voted||isOut?"#0d0d12":"linear-gradient(135deg,#1a1a25,#0f0f18)",border:`1px solid ${voted||isOut?"#111":"#252535"}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Syne",fontWeight:800,fontSize:14,color:voted||isOut?"#1e1e2a":"#FFB800"}}>
                      {name[0]}
                    </div>
                    <span style={{fontWeight:500,fontSize:15,color:isOut?"#1e1e2a":voted?"#1e1e2a":G.text}}>{name}</span>
                  </div>
                  {isOut?<span style={{fontSize:10,color:"#2a2a3a",fontWeight:700,letterSpacing:1.5}}>SAT OUT</span>
                   :voted?<span style={{fontSize:11,color:"#1a4428",fontWeight:700,letterSpacing:1.5}}>DONE ✓</span>
                   :<span style={{color:"#FFB800",fontSize:18}}>→</span>}
                </button>
                {!voted&&(
                  <button onClick={()=>onSitOut(name)}
                    style={{width:38,height:38,borderRadius:12,flexShrink:0,background:isOut?"#1a0a0a":"#0a0a10",border:`1px solid ${isOut?"#4a1a1a":G.border}`,color:isOut?"#ff6b6b":G.muted,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=isOut?"#ff6b6b80":"#FFB80040";e.currentTarget.style.color=isOut?"#ff6b6b":"#FFB800";}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=isOut?"#4a1a1a":G.border;e.currentTarget.style.color=isOut?"#ff6b6b":G.muted;}}>
                    {isOut?"↩":"⊘"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p style={{color:"#1a1a28",fontSize:11,marginTop:10}}>⊘ = sat out this week</p>
      <div style={{marginTop:36,paddingTop:22,borderTop:`1px solid ${G.border}`}}>
        <button onClick={onAdmin} style={{background:"none",border:"none",color:G.muted,fontSize:13,cursor:"pointer",fontFamily:"DM Sans",display:"flex",alignItems:"center",gap:8,transition:"color .2s"}}
          onMouseEnter={e=>e.currentTarget.style.color=G.sub} onMouseLeave={e=>e.currentTarget.style.color=G.muted}>
          ⚙ Admin · weeks &amp; results
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// VOTING
// ════════════════════════════════════════════════
function Voting({voter,week,existing,onSubmit,onBack}) {
  const init = {};
  AWARDS.forEach(a=>{init[a.id]=existing?.[a.id]?{...existing[a.id]}:{3:null,2:null,1:null};});
  const [picks,setPicks]=useState(init);
  const [saving,setSaving]=useState(false);
  const teammates=PLAYERS.filter(p=>p!==voter);
  const assign=(awardId,pts,name)=>setPicks(prev=>{
    const aw={...prev[awardId]};
    PTS.forEach(p=>{if(aw[p]===name)aw[p]=null;});
    aw[pts]=aw[pts]===name?null:name;
    return{...prev,[awardId]:aw};
  });
  const awardDone=id=>PTS.every(p=>picks[id][p]);
  const totalDone=AWARDS.filter(a=>awardDone(a.id)).length;
  const allDone=totalDone===AWARDS.length;
  const submit=()=>{if(!allDone||saving)return;setSaving(true);onSubmit(picks);};
  const ptMeta={
    3:{on:"#FFB800",bg:"rgba(255,184,0,.14)",bc:"rgba(255,184,0,.45)",label:"3 pts"},
    2:{on:"#9ca3af",bg:"rgba(156,163,175,.12)",bc:"rgba(156,163,175,.35)",label:"2 pts"},
    1:{on:"#52527A",bg:"rgba(82,82,122,.12)",bc:"rgba(82,82,122,.35)",label:"1 pt"},
  };
  return (
    <div style={{maxWidth:440,margin:"0 auto",padding:"24px 20px 80px",fontFamily:"DM Sans,sans-serif"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:G.sub,cursor:"pointer",fontSize:14,fontFamily:"DM Sans",marginBottom:26,display:"flex",alignItems:"center",gap:6}}
        onMouseEnter={e=>e.currentTarget.style.color=G.text} onMouseLeave={e=>e.currentTarget.style.color=G.sub}>← back</button>
      <div className="u0" style={{marginBottom:6}}>
        <Pill color="#FFB800">Week {week} · 3-2-1 Voting</Pill>
        <h2 style={{fontFamily:"Syne",fontWeight:800,fontSize:50,color:G.text,letterSpacing:-2,lineHeight:1,marginTop:12}}>{voter}</h2>
        <p style={{color:G.sub,fontSize:14,marginTop:6,lineHeight:1.5}}>Give 3, 2 and 1 point to different teammates — one set per award.</p>
      </div>
      <div className="u1" style={{display:"flex",gap:5,margin:"22px 0 28px"}}>
        {AWARDS.map(a=><div key={a.id} style={{flex:1,height:3,borderRadius:3,background:awardDone(a.id)?a.color:G.border,boxShadow:awardDone(a.id)?`0 0 12px ${a.glow}`:"none",transition:"background .3s,box-shadow .3s"}}/>)}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {AWARDS.map((award,idx)=>{
          const complete=awardDone(award.id);
          return (
            <div key={award.id} className={`u${idx+1}`} style={{background:G.surface,border:`1px solid ${complete?award.color+"38":G.border}`,borderRadius:20,padding:18,transition:"border-color .3s,box-shadow .3s",boxShadow:complete?`0 2px 40px ${award.color}14`:"none",position:"relative",overflow:"hidden"}}>
              {complete&&<div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:`radial-gradient(ellipse at 50% -20%,${award.color}0a,transparent 60%)`,pointerEvents:"none"}}/>}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,position:"relative"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:44,height:44,borderRadius:14,background:`${award.color}0e`,border:`1px solid ${award.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:complete?`0 0 24px ${award.glow}`:"none",transition:"box-shadow .3s"}}>{award.emoji}</div>
                  <div>
                    <div style={{fontFamily:"Syne",fontWeight:800,fontSize:23,color:award.color,letterSpacing:.3,lineHeight:1}}>{award.label}</div>
                    <div style={{color:G.sub,fontSize:11,marginTop:2}}>{award.full}</div>
                  </div>
                </div>
                {complete&&<div className="pop" style={{background:`${award.color}14`,border:`1px solid ${award.color}40`,borderRadius:10,padding:"4px 12px",color:award.color,fontSize:11,fontWeight:700,letterSpacing:1}}>SET ✓</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,position:"relative"}}>
                {teammates.map(name=>{
                  const myPt=PTS.find(p=>picks[award.id]?.[p]===name);
                  return (
                    <div key={name} style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{flex:1,fontSize:14,fontWeight:myPt?600:400,color:myPt?G.text:"#2e2e48",transition:"color .2s"}}>{name}</span>
                      <div style={{display:"flex",gap:5}}>
                        {PTS.map(pts=>{
                          const isMine=picks[award.id]?.[pts]===name;
                          const taken=picks[award.id]?.[pts]&&!isMine;
                          const c=ptMeta[pts];
                          return (
                            <button key={pts} onClick={()=>!taken&&assign(award.id,pts,name)}
                              style={{background:isMine?c.bg:"transparent",border:`1px solid ${isMine?c.bc:taken?"#0f0f18":G.border}`,borderRadius:8,padding:"5px 10px",color:isMine?c.on:taken?"#111":"#363654",fontSize:11,fontWeight:700,letterSpacing:.5,cursor:taken?"default":"pointer",fontFamily:"DM Sans",transition:"all .15s",boxShadow:isMine?`0 0 10px ${c.bc}`:"none"}}>
                              {c.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={submit} disabled={!allDone||saving} className="u4"
        style={{marginTop:18,width:"100%",background:allDone?"linear-gradient(135deg,#FFB800 0%,#FF8C00 100%)":"#0a0a10",border:`1px solid ${allDone?"transparent":G.border}`,borderRadius:18,padding:"18px",color:allDone?"#000":"#252540",fontFamily:"Syne",fontWeight:800,fontSize:18,letterSpacing:2,cursor:allDone&&!saving?"pointer":"default",transition:"all .3s",boxShadow:allDone?"0 0 60px rgba(255,184,0,.22),inset 0 1px 0 rgba(255,255,255,.12)":"none"}}>
        {saving?"SAVING…":allDone?"LOCK IN VOTES →":`FILL ALL AWARDS (${totalDone}/${AWARDS.length})`}
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════
// THANKS
// ════════════════════════════════════════════════
function Thanks({voter,onBack}) {
  return (
    <div style={{maxWidth:340,margin:"80px auto 0",padding:"0 24px",textAlign:"center",fontFamily:"DM Sans,sans-serif"}}>
      <div className="u0">
        <div style={{fontSize:80,display:"inline-block",marginBottom:32,animation:"drift 2.4s ease-in-out infinite",filter:"drop-shadow(0 0 40px rgba(255,184,0,.65))"}}>🏀</div>
        <h2 style={{fontFamily:"Syne",fontWeight:800,fontSize:52,background:"linear-gradient(135deg,#FFB800 0%,#fff 60%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:-2,lineHeight:1,marginBottom:14}}>Locked in.</h2>
        <p style={{color:G.sub,fontSize:16,marginBottom:6}}><span style={{color:"#FFB800",fontWeight:600}}>{voter}</span>'s votes are saved.</p>
        <p style={{color:"#1a1a28",fontSize:13,marginBottom:52,lineHeight:1.6}}>Results sealed until end of season.</p>
        <button onClick={onBack} style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:14,padding:"14px 32px",color:G.sub,fontSize:15,cursor:"pointer",fontFamily:"DM Sans",fontWeight:500,transition:"all .2s"}}
          onMouseEnter={e=>{e.currentTarget.style.color=G.text;e.currentTarget.style.borderColor="#333";}}
          onMouseLeave={e=>{e.currentTarget.style.color=G.sub;e.currentTarget.style.borderColor=G.border;}}>
          ← Back to home
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// ADMIN LOCK
// ════════════════════════════════════════════════
function AdminLock({onUnlock,onBack}) {
  const [pw,setPw]=useState(""); const [err,setErr]=useState(false); const [shake,setShake]=useState(false);
  const attempt=()=>{if(pw===ADMIN_PW){onUnlock();}else{setErr(true);setPw("");setShake(true);setTimeout(()=>setShake(false),500);}};
  return (
    <div style={{maxWidth:320,margin:"80px auto 0",padding:"0 24px",fontFamily:"DM Sans,sans-serif"}}>
      <div className="u0" style={{textAlign:"center",marginBottom:40}}>
        <div style={{fontSize:50,marginBottom:20,animation:"glow 2.5s ease infinite",filter:"drop-shadow(0 0 18px rgba(255,184,0,.4))"}}>🔒</div>
        <h2 style={{fontFamily:"Syne",fontWeight:800,fontSize:42,color:G.text,letterSpacing:-1,marginBottom:8}}>Admin</h2>
        <p style={{color:G.sub,fontSize:14,lineHeight:1.5}}>Password to manage weeks and view results.</p>
      </div>
      <div className="u1" style={{animation:shake?"shake .45s ease":"none"}}>
        <input type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr(false);}} onKeyDown={e=>e.key==="Enter"&&attempt()} placeholder="Password…"
          style={{width:"100%",background:G.surface,border:`1px solid ${err?"#ff6b6b60":G.border}`,borderRadius:14,padding:"15px 18px",color:G.text,fontSize:16,fontFamily:"DM Sans",marginBottom:10,transition:"border-color .2s",letterSpacing:3}}/>
        {err&&<p style={{color:"#ff6b6b",fontSize:13,marginBottom:14,textAlign:"center"}}>Wrong. Still locked. 🔒</p>}
        <button onClick={attempt} style={{width:"100%",background:"linear-gradient(135deg,#FFB800,#FF8C00)",border:"none",borderRadius:14,padding:"16px",color:"#000",fontFamily:"Syne",fontWeight:800,fontSize:18,letterSpacing:2,cursor:"pointer",boxShadow:"0 0 40px rgba(255,184,0,.25)",marginBottom:16,transition:"transform .15s"}}
          onMouseEnter={e=>e.currentTarget.style.transform="scale(1.02)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>UNLOCK</button>
        <div style={{textAlign:"center"}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:G.muted,cursor:"pointer",fontSize:14,fontFamily:"DM Sans"}}
            onMouseEnter={e=>e.currentTarget.style.color=G.sub} onMouseLeave={e=>e.currentTarget.style.color=G.muted}>← Back</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════
function Admin({allRows,week,loading,onSetWeek,onResetWeek,onBack}) {
  const [tab,setTab]=useState("week");
  const [confirmWk,setConfirmWk]=useState(null);
  const [confirmReset,setConfirmReset]=useState(false);

  const seasonTally=()=>{
    const t={};
    PLAYERS.forEach(p=>{t[p]={mvp:0,dpoy:0,bricklayer:0,total:0};});
    for(const row of allRows){
      if(row.award===SAT_OUT)continue;
      const n=row.nominee;
      if(t[n]){t[n][row.award]+=row.points;t[n].total+=row.points;}
    }
    return t;
  };
  const weekLeader=(wk,awardId)=>{
    const pts={};
    for(const row of allRows){
      if(row.week_number!==wk||row.award!==awardId)continue;
      pts[row.nominee]=(pts[row.nominee]||0)+row.points;
    }
    return Object.entries(pts).sort((a,b)=>b[1]-a[1]);
  };

  const tally=seasonTally();
  const sorted=Object.entries(tally).sort((a,b)=>b[1].total-a[1].total);
  const maxPts=Math.max(1,...sorted.map(([,v])=>v.total));
  const medals=["🥇","🥈","🥉"];
  const podCol=["#FFB800","#9ca3af","#cd7c3f"];
  const votersNow=[...new Set(allRows.filter(r=>r.week_number===week).map(r=>r.voter))].length;
  const wksPlayed=[...new Set(allRows.map(r=>r.week_number))].sort((a,b)=>a-b);

  return (
    <div style={{maxWidth:480,margin:"0 auto",padding:"24px 20px 80px",fontFamily:"DM Sans,sans-serif"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:G.muted,cursor:"pointer",fontSize:14,fontFamily:"DM Sans",marginBottom:28,display:"flex",alignItems:"center",gap:6}}
        onMouseEnter={e=>e.currentTarget.style.color=G.sub} onMouseLeave={e=>e.currentTarget.style.color=G.muted}>← back</button>
      <div className="u0" style={{marginBottom:28}}>
        <h2 style={{fontFamily:"Syne",fontWeight:800,fontSize:46,color:G.text,letterSpacing:-2,lineHeight:1,marginBottom:4}}>Admin Panel</h2>
        <p style={{color:G.sub,fontSize:13}}>{wksPlayed.length} of {TOTAL_WEEKS} weeks played</p>
      </div>

      {/* Week control */}
      <div className="u1" style={{background:G.surface,border:"1px solid rgba(255,184,0,.18)",borderRadius:20,padding:20,marginBottom:20,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"radial-gradient(ellipse at 50% 0%,rgba(255,184,0,.06),transparent 60%)",pointerEvents:"none"}}/>
        <div style={{position:"relative"}}>
          <Pill color="#FFB800">Week Control</Pill>
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",margin:"14px 0 16px"}}>
            <div>
              <span style={{fontFamily:"Syne",fontWeight:800,fontSize:62,color:G.text,letterSpacing:-3,lineHeight:1}}>{String(week).padStart(2,"00")}</span>
              <span style={{fontFamily:"Syne",fontWeight:700,fontSize:26,color:G.muted,letterSpacing:-1}}> / {TOTAL_WEEKS}</span>
            </div>
            <div style={{textAlign:"right",paddingBottom:6}}>
              <p style={{color:votersNow===PLAYERS.length?"#4ade80":"#FFB800",fontWeight:600,fontSize:14}}>{votersNow}/{PLAYERS.length} voted</p>
              <p style={{color:G.sub,fontSize:11}}>this week</p>
            </div>
          </div>
          <p style={{color:G.sub,fontSize:10,fontWeight:700,letterSpacing:2,marginBottom:10}}>JUMP TO WEEK</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:5,marginBottom:14}}>
            {Array.from({length:TOTAL_WEEKS},(_,i)=>i+1).map(wk=>{
              const active=wk===week, hasVotes=wksPlayed.includes(wk);
              return (
                <button key={wk} onClick={()=>!active&&setConfirmWk(wk)}
                  style={{background:active?"linear-gradient(135deg,#FFB800,#FF8C00)":hasVotes?"#111120":G.surface,border:`1px solid ${active?"transparent":hasVotes?"#252540":G.border}`,borderRadius:10,padding:"8px 0",color:active?"#000":hasVotes?"#4FC3F7":G.sub,fontFamily:"Syne",fontWeight:700,fontSize:15,cursor:active?"default":"pointer",transition:"all .15s",boxShadow:active?"0 0 20px rgba(255,184,0,.35)":"none",position:"relative"}}
                  onMouseEnter={e=>{if(!active){e.currentTarget.style.borderColor="#2e2e45";e.currentTarget.style.color=G.text;}}}
                  onMouseLeave={e=>{if(!active){e.currentTarget.style.borderColor=hasVotes?"#252540":G.border;e.currentTarget.style.color=hasVotes?"#4FC3F7":G.sub;}}}>
                  {wk}{hasVotes&&!active&&<span style={{position:"absolute",top:3,right:3,width:4,height:4,borderRadius:"50%",background:"#4FC3F7",display:"block"}}/>}
                </button>
              );
            })}
          </div>
          {confirmWk&&(
            <div className="pop" style={{background:"#0d0d16",border:"1px solid rgba(255,184,0,.2)",borderRadius:14,padding:"14px 16px",marginBottom:12}}>
              <p style={{color:G.text,fontSize:14,marginBottom:12}}>Move to <span style={{color:"#FFB800",fontWeight:700}}>Week {confirmWk}</span>?</p>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{onSetWeek(confirmWk);setConfirmWk(null);}} style={{flex:1,background:"linear-gradient(135deg,#FFB800,#FF8C00)",border:"none",borderRadius:10,padding:"10px",color:"#000",fontFamily:"Syne",fontWeight:800,fontSize:15,cursor:"pointer"}}>CONFIRM</button>
                <button onClick={()=>setConfirmWk(null)} style={{flex:1,background:G.surface,border:`1px solid ${G.border}`,borderRadius:10,padding:"10px",color:G.sub,fontSize:14,cursor:"pointer",fontFamily:"DM Sans",fontWeight:500}}>Cancel</button>
              </div>
            </div>
          )}
          <p style={{color:"#1a1a28",fontSize:11,marginTop:4,lineHeight:1.7}}>Blue dot = votes recorded · Auto-advances when all {PLAYERS.length} vote.</p>
          <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${G.border}`}}>
            {!confirmReset?(
              <button onClick={()=>setConfirmReset(true)} style={{background:"none",border:"1px solid #3a1515",borderRadius:10,padding:"9px 16px",color:"#5a2020",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"DM Sans",letterSpacing:.5,display:"flex",alignItems:"center",gap:7,transition:"all .2s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="#ff6b6b60";e.currentTarget.style.color="#ff6b6b";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="#3a1515";e.currentTarget.style.color="#5a2020";}}>
                🔄 Reset Week {week} votes
              </button>
            ):(
              <div className="pop" style={{background:"#0f0808",border:"1px solid #ff6b6b30",borderRadius:14,padding:"14px 16px"}}>
                <p style={{color:G.text,fontSize:14,marginBottom:4,fontWeight:600}}>Reset Week {week}?</p>
                <p style={{color:G.sub,fontSize:12,marginBottom:14,lineHeight:1.5}}>Clears all votes and sat-out marks. Everyone can vote again.</p>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{onResetWeek(week);setConfirmReset(false);}} style={{flex:1,background:"#ff6b6b18",border:"1px solid #ff6b6b50",borderRadius:10,padding:"10px",color:"#ff6b6b",fontFamily:"Syne",fontWeight:800,fontSize:14,letterSpacing:1,cursor:"pointer"}}>YES, RESET</button>
                  <button onClick={()=>setConfirmReset(false)} style={{flex:1,background:G.surface,border:`1px solid ${G.border}`,borderRadius:10,padding:"10px",color:G.sub,fontSize:14,cursor:"pointer",fontFamily:"DM Sans",fontWeight:500}}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="u2" style={{display:"flex",background:"#06060a",border:`1px solid ${G.border}`,borderRadius:14,padding:4,gap:4,marginBottom:20}}>
        {["week","season","history"].map(k=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,background:tab===k?G.surface:"none",border:`1px solid ${tab===k?G.border:"transparent"}`,borderRadius:10,padding:"9px 0",color:tab===k?G.text:G.sub,fontFamily:"DM Sans",fontWeight:600,fontSize:13,cursor:"pointer",transition:"all .2s",textTransform:"capitalize"}}>
            {k==="week"?"This Week":k==="season"?"Season":"History"}
          </button>
        ))}
      </div>

      {loading&&<div style={{padding:40}}><Spinner/></div>}

      {!loading&&tab==="week"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {AWARDS.map((award,i)=>{
            const entries=weekLeader(week,award.id);
            return (
              <div key={award.id} className={`u${i}`} style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:18,padding:"16px 18px"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:entries.length?14:0}}>
                  <span style={{fontSize:20}}>{award.emoji}</span>
                  <span style={{fontFamily:"Syne",fontWeight:800,fontSize:20,color:award.color}}>{award.label}</span>
                </div>
                {entries.length===0?<p style={{color:"#1a1a28",fontSize:13,fontStyle:"italic"}}>No votes yet.</p>
                  :entries.map(([name,pts],idx)=>(
                    <div key={name} style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{color:idx===0?award.color:G.sub,fontWeight:idx===0?600:400,fontSize:idx===0?15:13}}>{idx===0&&"★  "}{name}</span>
                        <span style={{fontFamily:"Syne",fontWeight:800,fontSize:idx===0?20:15,color:idx===0?award.color:G.muted}}>{pts}<span style={{fontSize:11,fontWeight:400,color:G.sub}}> pts</span></span>
                      </div>
                      <div style={{background:"#0d0d16",borderRadius:3,height:2,overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:3,width:`${Math.round((pts/entries[0][1])*100)}%`,background:idx===0?award.color:G.border,transition:"width .8s ease"}}/>
                      </div>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {!loading&&tab==="season"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {sorted.map(([name,data],i)=>{
            const isTop=i===0&&data.total>0;
            return (
              <div key={name} className={`u${Math.min(i,4)}`} style={{background:isTop?"#0d0b00":G.surface,border:`1px solid ${isTop?"rgba(255,184,0,.2)":G.border}`,borderRadius:18,padding:"16px 18px",boxShadow:isTop?"0 4px 60px rgba(255,184,0,.06)":"none"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:20,minWidth:28}}>{medals[i]||""}</span>
                    <span style={{color:isTop?G.text:G.sub,fontWeight:isTop?600:400,fontSize:17}}>{name}</span>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <span style={{fontFamily:"Syne",fontWeight:800,fontSize:34,color:podCol[i]||G.border,letterSpacing:-1,lineHeight:1}}>{data.total}</span>
                    <div style={{color:"#1a1a28",fontSize:9,fontWeight:700,letterSpacing:1}}>PTS</div>
                  </div>
                </div>
                <div style={{background:"#0d0d16",borderRadius:3,height:3,marginBottom:12,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:3,width:`${(data.total/maxPts)*100}%`,background:isTop?"linear-gradient(90deg,#FFB800,#FF6B6B)":G.border,transition:"width 1s ease"}}/>
                </div>
                <div style={{display:"flex",gap:16}}>
                  {AWARDS.map(a=>(
                    <div key={a.id} style={{display:"flex",alignItems:"center",gap:5}}>
                      <span style={{fontSize:13}}>{a.emoji}</span>
                      <span style={{color:data[a.id]>0?a.color:"#1a1a28",fontFamily:"Syne",fontWeight:800,fontSize:17}}>{data[a.id]}</span>
                      <span style={{color:"#1a1a28",fontSize:10}}>{a.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading&&tab==="history"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {wksPlayed.length===0&&<p style={{color:"#1a1a28",textAlign:"center",padding:48,fontStyle:"italic"}}>No votes yet.</p>}
          {[...wksPlayed].reverse().map(wk=>{
            const vc=[...new Set(allRows.filter(r=>r.week_number===wk).map(r=>r.voter))].length;
            return (
              <div key={wk} style={{background:G.surface,border:`1px solid ${G.border}`,borderRadius:18,padding:"16px 18px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <span style={{fontFamily:"Syne",fontWeight:800,fontSize:22,color:"#FFB800",letterSpacing:-1}}>Week {wk}</span>
                  <span style={{color:vc===PLAYERS.length?"#4ade80":G.muted,fontSize:11,fontWeight:600,letterSpacing:1}}>{vc}/{PLAYERS.length} VOTED</span>
                </div>
                {AWARDS.map(award=>{
                  const entries=weekLeader(wk,award.id);
                  const winner=entries[0];
                  return (
                    <div key={award.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <div style={{width:32,height:32,borderRadius:10,background:`${award.color}0e`,border:`1px solid ${award.color}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{award.emoji}</div>
                      <div style={{flex:1}}>
                        <div style={{color:"#1e1e2a",fontSize:9,fontWeight:700,letterSpacing:1.5,marginBottom:2}}>{award.label}</div>
                        {winner?<div style={{display:"flex",alignItems:"baseline",gap:7}}><span style={{color:award.color,fontWeight:600,fontSize:15}}>{winner[0]}</span><span style={{color:G.sub,fontSize:11}}>{winner[1]} pts</span></div>:<span style={{color:"#111",fontSize:13}}>—</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// ROOT
// ════════════════════════════════════════════════
export default function App() {
  const [screen,  setScreen]  = useState("loading");
  const [week,    setWeekNum] = useState(1);
  const [voter,   setVoter]   = useState(null);
  const [parsed,  setParsed]  = useState({});
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshWeek = useCallback(async (wk) => {
    setLoading(true);
    const rows = await db.getVotes(wk);
    setParsed(parseVotes(rows));
    setLoading(false);
  }, []);

  useEffect(()=>{
    (async()=>{
      const w = await db.getWeek();
      setWeekNum(w);
      await refreshWeek(w);
      setScreen("home");
    })();
  },[]);

  const checkAdvance = async (wk, newParsed) => {
    if (PLAYERS.every(p => playerDone(newParsed, p)) && wk < TOTAL_WEEKS) {
      const next = wk + 1;
      await db.setWeek(next);
      setWeekNum(next);
      await refreshWeek(next);
    }
  };

  const handleSitOut = async (name) => {
    if (playerSatOut(parsed, name)) await db.removeSatOut(week, name);
    else await db.setSatOut(week, name);
    await refreshWeek(week);
    const rows = await db.getVotes(week);
    await checkAdvance(week, parseVotes(rows));
  };

  const handleSubmit = async (picks) => {
    await Promise.all(
      AWARDS.flatMap(a => PTS.map(p => db.upsertVote(week, voter, a.id, picks[a.id][p], p)))
    );
    const rows = await db.getVotes(week);
    const fresh = parseVotes(rows);
    setParsed(fresh);
    setScreen("thanks");
    await checkAdvance(week, fresh);
  };

  const handleSetWeek = async (w) => {
    await db.setWeek(w);
    setWeekNum(w);
    await refreshWeek(w);
    setScreen("admin");
  };

  const handleResetWeek = async (wk) => {
    await db.resetWeek(wk);
    await refreshWeek(wk);
    const all = await db.getVotes();
    setAllRows(all);
  };

  const handleAdminUnlock = async () => {
    setLoading(true);
    const all = await db.getVotes();
    setAllRows(all);
    setLoading(false);
    setScreen("admin");
  };

  if (screen==="loading") return (
    <div style={{minHeight:"100vh",background:G.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <style>{CSS}</style><Spinner/>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:G.bg,color:G.text,position:"relative",overflow:"hidden"}}>
      <style>{CSS}</style>
      <Ambient/>
      <div style={{position:"sticky",top:0,zIndex:10,background:"rgba(8,8,12,.88)",backdropFilter:"blur(28px) saturate(180%)",borderBottom:`1px solid ${G.border}`,padding:"14px 20px",display:"flex",alignItems:"center",gap:14}}>
        <span style={{fontSize:20,filter:"drop-shadow(0 0 14px rgba(255,184,0,.7))"}}>🏀</span>
        <span style={{fontFamily:"Syne",fontWeight:800,fontSize:17,color:G.text,letterSpacing:1}}>SQUAD AWARDS</span>
        <div style={{flex:1}}/>
        <Pill color="#FFB800">WK {week}/{TOTAL_WEEKS}</Pill>
      </div>
      <div style={{position:"relative",zIndex:2}}>
        {screen==="home"      && <Home week={week} parsed={parsed} loading={loading} onVote={n=>{setVoter(n);setScreen("voting");}} onSitOut={handleSitOut} onAdmin={()=>setScreen("adminlock")}/>}
        {screen==="voting"    && <Voting voter={voter} week={week} existing={parsed[voter]} onSubmit={handleSubmit} onBack={()=>setScreen("home")}/>}
        {screen==="thanks"    && <Thanks voter={voter} onBack={()=>{refreshWeek(week);setScreen("home");}}/>}
        {screen==="adminlock" && <AdminLock onUnlock={handleAdminUnlock} onBack={()=>setScreen("home")}/>}
        {screen==="admin"     && <Admin allRows={allRows} week={week} loading={loading} onSetWeek={handleSetWeek} onResetWeek={handleResetWeek} onBack={()=>setScreen("home")}/>}
      </div>
    </div>
  );
}
