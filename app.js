const AX_GOLF={doubleEagle:6,eagle:5,birdie:3,par:2,bogey:0,doubleBogey:-1,tripleOrWorse:-2,fir:2,gir:2,sand:2,onePutt:2,holeOut:2,ob:-1,threePutt:-1,lowRound:5};
const SOPTS=[{l:'Dbl Eagle',p:'+6',k:'doubleEagle',c:'s-deagle',d:-3},{l:'Eagle',p:'+5',k:'eagle',c:'s-eagle',d:-2},{l:'Birdie',p:'+3',k:'birdie',c:'s-birdie',d:-1},{l:'Par',p:'+2',k:'par',c:'s-par',d:0},{l:'Bogey',p:'0',k:'bogey',c:'s-bogey',d:1},{l:'Dbl Bogey',p:'-1',k:'doubleBogey',c:'s-dbl',d:2},{l:'Triple+',p:'-2',k:'tripleOrWorse',c:'s-tri',d:3}];
const PCOLOR=['#4a90d9','#e05a5a','#4caf7d','#e0c040'];

let pCount=2;
let matchStarted=false;
let G={course:'',date:'',matchNum:'',players:[],holes:9,currentHole:1,pars:{},scores:{},finalized:false};

function setCount(n){
  pCount=n;
  [1,2,3,4].forEach(i=>document.getElementById('cnt'+i).className='count-btn'+(i===n?' sel':''));
  renderSetup();
}

function renderSetup(){
  const area=document.getElementById('playerSetup');
  if(pCount===4){
    area.innerHTML=[1,2].map(t=>{
      const i0=(t-1)*2,i1=i0+1;
      return `<div class="card"><h2> Team ${t}</h2>
        <div class="field"><label>Team Name</label><input type="text" id="tname${t}" placeholder="Team ${t===1?'A':'B'}"></div>
        <div class="player-box pb${i0}"><div class="pblbl pblbl${i0}">Player ${i0+1}</div>
          <div class="field" style="margin:0"><label>Name</label><input type="text" id="pn${i0}" placeholder="Player name"></div></div>
        <div class="player-box pb${i1}"><div class="pblbl pblbl${i1}">Player ${i1+1}</div>
          <div class="field" style="margin:0"><label>Name</label><input type="text" id="pn${i1}" placeholder="Player name"></div></div>
      </div>`;
    }).join('');
  } else {
    let h=`<div class="card"><h2> Players</h2>`;
    for(let i=0;i<pCount;i++) h+=`<div class="player-box pb${i}"><div class="pblbl pblbl${i}">Player ${i+1}</div><div class="field" style="margin:0"><label>Name</label><input type="text" id="pn${i}" placeholder="Player ${i+1} name"></div></div>`;
    area.innerHTML=h+`</div>`;
  }
}

function collectSetupData(){
  const course=document.getElementById('courseName').value.trim()||'Unknown Course';
  const date=document.getElementById('matchDate').value||new Date().toISOString().split('T')[0];
  const matchNum=document.getElementById('matchNum').value.trim();
  const players=[];
  if(pCount===4){
    const t1=document.getElementById('tname1')?.value.trim()||'Team 1';
    const t2=document.getElementById('tname2')?.value.trim()||'Team 2';
    // Store 4-player matches as head-to-head groups:
    // Team 1 Player 1 vs Team 2 Player 1, then Team 1 Player 2 vs Team 2 Player 2.
    const raw=[];
    [[0,1,t1,1],[2,3,t2,2]].forEach(([ia,ib,team,tid])=>{
      [ia,ib].forEach((i,slot)=>{const n=document.getElementById('pn'+i)?.value.trim();if(n) raw.push({id:i,name:n,team,teamId:tid,ci:i,lineupSlot:slot+1});});
    });
    if(!raw.some(p=>p.teamId===1)||!raw.some(p=>p.teamId===2)){alert('Please enter at least one player per team.');return null;}
    [1,2].forEach(slot=>{
      const t1p=raw.find(p=>p.teamId===1&&p.lineupSlot===slot);
      const t2p=raw.find(p=>p.teamId===2&&p.lineupSlot===slot);
      if(t1p) players.push(t1p);
      if(t2p) players.push(t2p);
    });
  } else {
    for(let i=0;i<pCount;i++){const n=document.getElementById('pn'+i)?.value.trim()||`Player ${i+1}`;players.push({id:i,name:n,team:n,teamId:i+1,ci:i});}
  }
  return {course,date,matchNum,players};
}

function startMatch(){
  const data=collectSetupData();
  if(!data) return;
  const oldScores=G.scores||{};
  const oldPars=G.pars&&Object.keys(G.pars).length?G.pars:{};
  const oldHole=G.currentHole||1;
  G={course:data.course,date:data.date,matchNum:data.matchNum,players:data.players,holes:9,currentHole:matchStarted?oldHole:1,pars:{},scores:{},finalized:false};
  G.players.forEach(p=>{G.scores[p.id]=oldScores[p.id]||{};});
  for(let h=1;h<=9;h++) G.pars[h]=oldPars[h]||4;
  matchStarted=true;
  document.getElementById('startMatchBtn').textContent=' SAVE CHANGES / RETURN TO MATCH';
  document.getElementById('hdrInfo').innerHTML=`${G.course}${G.matchNum?' · Match #'+G.matchNum:''}<br>${fmtDate(G.date)}`;
  switchScreen('scoringScreen');
  renderHole();
}

function stDiff(score,par){
  if(!score||!par) return null;
  const d=score-par;
  if(d<=-3) return 'doubleEagle';if(d===-2) return 'eagle';if(d===-1) return 'birdie';
  if(d===0) return 'par';if(d===1) return 'bogey';if(d===2) return 'doubleBogey';return 'tripleOrWorse';
}

function holePts(pid,h){
  const d=G.scores[pid]?.[h];if(!d) return{score:0,stat:0,total:0};
  const par=G.pars[h],st=stDiff(d.score,par);
  let score=st?AX_GOLF[st]:0,stat=0;
  const opp=getOpponent(pid), od=opp?getData(opp.id,h):{};
  const oppMovedMeOffGreen=!!(d.ctpLost && od.ctpState==='won' && od.ctpAction==='pushOff');
  if(d.fir && !d.ldLost) stat+=AX_GOLF.fir;
  if(d.ldBoth) stat+=AX_GOLF.fir; // stolen opponent FIR pts when both players hit FW and I win Long Drive
  if(d.gir && !oppMovedMeOffGreen) stat+=AX_GOLF.gir;
  if(d.ctpWon && d.ctpState==='won' && d.ctpAction==='pushOff') stat+=AX_GOLF.gir; // stolen GIR pts only when opponent is moved off green
  if(d.sand) stat+=AX_GOLF.sand;
  if(d.onePutt) stat+=AX_GOLF.onePutt;if(d.holeOut) stat+=AX_GOLF.holeOut;
  if(d.ob) stat+=AX_GOLF.ob * d.ob;if(d.threePutt) stat+=AX_GOLF.threePutt;
  return{score,stat,total:score+stat};
}


function holePtsDetailed(pid,h){
  const d=G.scores[pid]?.[h];if(!d) return{score:0,stat:0,penalty:0,total:0};
  const par=G.pars[h],st=stDiff(d.score,par);
  let score=st?AX_GOLF[st]:0,stat=0,penalty=0;
  const opp=getOpponent(pid), od=opp?getData(opp.id,h):{};
  const oppMovedMeOffGreen=!!(d.ctpLost && od.ctpState==='won' && od.ctpAction==='pushOff');

  if(d.fir && !d.ldLost) stat+=AX_GOLF.fir;
  if(d.ldBoth) stat+=AX_GOLF.fir; // stolen opponent FIR pts when both players hit FW and I win Long Drive
  if(d.gir && !oppMovedMeOffGreen) stat+=AX_GOLF.gir;
  if(d.ctpWon && d.ctpState==='won' && d.ctpAction==='pushOff') stat+=AX_GOLF.gir; // stolen GIR pts only when opponent is moved off green
  if(d.sand) stat+=AX_GOLF.sand;
  if(d.onePutt) stat+=AX_GOLF.onePutt;
  if(d.holeOut) stat+=AX_GOLF.holeOut;
  if(d.ob) penalty+=AX_GOLF.ob * d.ob;
  if(d.threePutt) penalty+=AX_GOLF.threePutt;

  return{score,stat,penalty,total:score+stat+penalty};
}


function playerTot(pid){let score=0,stat=0;for(let h=1;h<=G.holes;h++){const p=holePts(pid,h);score+=p.score;stat+=p.stat;}return{score,stat,total:score+stat};}
function pc(n){return n>0?'c-pos':n<0?'c-neg':'c-zero';}
function ps(n){return n>0?'+'+n:''+n;}
function fmtDate(d){if(!d)return'';return new Date(d+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});}

function renderHole(){
  const h=G.currentHole,par=G.pars[h];
  const pb=document.getElementById('progressBar');pb.innerHTML='';
  for(let i=1;i<=G.holes;i++){const el=document.createElement('div');el.className='prog-hole'+(i<h?' done':i===h?' current':'');pb.appendChild(el);}
  document.getElementById('holeNum').textContent=h;
  document.getElementById('holePar').textContent=par?'PAR '+par:'PAR —';
  document.getElementById('prevBtn').disabled=h===1;
  document.getElementById('nextBtn').disabled=h===G.holes;
  [3,4,5].forEach(p=>{document.getElementById('p'+p+'btn').className='par-chip par'+p+(par===p?' sel':'');});
  renderCards();renderLive();
}

function setPar(p){G.pars[G.currentHole]=p;renderHole();}

function renderCards(){
  const h=G.currentHole,par=G.pars[h],isP3=par===3;
  const con=document.getElementById('playerCards');con.innerHTML='';
  G.players.forEach(p=>{
    const d=G.scores[p.id][h]||{},st=stDiff(d.score,par),hp=holePts(p.id,h);
    // Score buttons
    let sH=`<div class="sec-lbl">Hole Score</div><div class="score-grid">`;
    SOPTS.forEach(o=>{const a=par?par+o.d:null;if(!a||a<1)return;sH+=`<button class="score-btn ${o.c}${st===o.k?' sel':''}" onclick="setScore(${p.id},${a},'${o.k}')">${o.l}<br><span class="spts">${o.p} pts</span></button>`;});
    sH+=`</div>`;
    // Stat toggles
    let tH=`<div class="divlbl">Stat Bonuses & Penalties</div><div class="tog-grid">`;
    if(!isP3) tH+=tog(p.id,'fir',' Fairway Hit'+(d.ldLost?' — FIR Stolen':' +2 pts'),'+2 pts',d.ldLost?'neg-locked':'pos',d.fir);
    tH+=tog(p.id,'gir',' Green in Reg','+2 pts','pos',d.gir);
    tH+=tog(p.id,'sand','Sand Save','+2 pts','pos',d.sand);
    tH+=tog(p.id,'onePutt','1 Putt','+2 pts','pos',d.onePutt);
    tH+=tog(p.id,'holeOut','Hole Out','+2 pts','pos',d.holeOut);
    tH+=tog(p.id,'threePutt','3-Putt+','-1 pt','neg',d.threePutt);
    tH+=`</div>`;
    // OB counter (separate from toggle grid)
    const obCount=d.ob||0;
    tH+=`<div class="ob-counter" style="margin-top:7px;">
      <div class="ob-lbl"> OB / Lost Ball<small>-1 pt each</small></div>
      <button class="ob-btn" onclick="adjOB(${p.id},-1)" ${obCount===0?'style="opacity:.3;cursor:default"':''}>−</button>
      <div class="ob-count" style="${obCount>0?'color:#e74c3c':'color:var(--text-muted)'}">${obCount}</div>
      <button class="ob-btn" onclick="adjOB(${p.id},1)">+</button>
    </div>`;
    // Long Drive (par 4 & 5)
    let ldH='';
    if(!isP3){
      const opp=getOpponent(p.id), od=opp?getData(opp.id,h):{};
      const ownFir=!!d.fir, oppFir=!!od.fir, oppWon=hasLDWin(od);
      const ldActive=hasLDWin(d), lda=d.ldAction||null;
      const canBoth=ownFir && oppFir && !oppWon;
      const canFWOnly=ownFir && !oppFir && !oppWon;
      const canLost=ownFir && oppWon;
      const canMoveOwn=ldActive;
      const canMoveOpp=ldActive && oppFir;
      const lockMsg=!ownFir?'Select Fairway Hit above to unlock Long Drive.':oppWon?'Opponent already won Long Drive. Select Hit Fairway but Lost Long Drive if you hit the fairway.':!opp?'Long Drive requires an opponent.':oppFir?'Both players hit the fairway. Winner may choose Option A or Option B.':'Opponent missed the fairway. You may choose Option A only; Option B is locked.';
      ldH=`<div class="adv-box"><h4>Long Drive</h4>
        <div class="info-tip" style="margin-bottom:9px;"><strong>${lockMsg}</strong></div>
        <div class="tog-grid" style="margin-bottom:${ldActive||!ownFir?'10px':'0'}">
          ${ldToggle(p.id,'ldBoth','Both in FW — I Was Longer','I outdrove opponent','gold',d.ldBoth,canBoth)}
          ${ldToggle(p.id,'ldFWOnly','Only I Hit the Fairway','Auto Long Drive win','blue',d.ldFWOnly,canFWOnly)}
        </div>
        ${ldActive||!ownFir?`<div class="divlbl" style="margin-top:0">Choose LD Action</div>
          <div class="adv-act-grid">
            <button class="adv-btn ${lda==='moveOwn'?'sel-g':''}" ${canMoveOwn?'': 'disabled style="opacity:.45;cursor:not-allowed"'} onclick="setF(${p.id},'ldAction','moveOwn')">Option A<br>Move My Ball<br><small>+10 paces forward</small></button>
            <button class="adv-btn ${lda==='moveOpp'?'sel-g':''}" ${canMoveOpp?'': 'disabled style="opacity:.45;cursor:not-allowed"'} onclick="setF(${p.id},'ldAction','moveOpp')">Option B<br>Move Opp Ball<br><small>-10 paces back</small></button>
            <button class="adv-btn ${lda==='skip'?'sel-n':''}" style="grid-column:1/-1" onclick="setF(${p.id},'ldAction','skip')">No Action</button>
          </div>`:''}
        <div class="divlbl" style="margin-top:${ldActive||!ownFir?'10px':'0'}">Lost Long Drive</div>
        ${ldToggle(p.id,'ldLost','Hit FW but Lost LD — FIR Stolen','Opponent steals my FIR pts','neg',d.ldLost,canLost)}
      </div>`;
    }
    // Closest to Pin (ALL holes)
    const oppCTP=getOpponent(p.id), odCTP=oppCTP?getData(oppCTP.id,h):{};
    const ctpState=d.ctpState||null;
    const ctpa=d.ctpAction||null;
    const ownGIR=!!d.gir, oppGIR=!!odCTP.gir;
    const bothGIR=ownGIR && oppGIR;
    const oppWonCTP=odCTP.ctpState==='won';
    const canWinCTP=bothGIR && !oppWonCTP && ctpState!=='lost' && ctpState!=='missed';
    const canLoseCTP=bothGIR && oppWonCTP;
    const canNoCTP=!bothGIR && !oppWonCTP;
    const ctpNeedsGIR=!ownGIR;
    const ctpMsg=ctpNeedsGIR
      ? '<strong style="color:#e74c3c">Select Green in Reg above first</strong> to unlock CTP options.'
      : oppWonCTP
        ? '<strong>Your opponent won CTP.</strong> Select Lost CTP.'
        : bothGIR
          ? 'Both players hit GIR. Select Won CTP if you were closer.'
          : 'CTP only applies when both players hit the green in regulation.';
    const ctpH=`<div class="adv-box ctp"><h4>Closest to the Pin</h4>
      <div class="info-tip" style="margin-bottom:9px;">${ctpMsg}</div>
      <div class="tog-grid" style="margin-bottom:${ctpState?'10px':'0'}">
        ${ctpToggle(p.id,'ctpWon','Won CTP','I was closer','gold',ctpState==='won',canWinCTP)}
        ${ctpToggle(p.id,'ctpLost','Lost CTP','Opponent won CTP','neg',ctpState==='lost',canLoseCTP)}
      </div>
      <div style="margin-top:7px;${canNoCTP?'':'opacity:.45;pointer-events:none;'}">
        ${ctpToggle(p.id,'ctpMissed','No CTP','One or both missed GIR','neg',ctpState==='missed',canNoCTP)}
      </div>
      ${ctpState==='won'?`<div class="divlbl" style="margin-top:10px">Choose CTP Action</div>
        <div class="adv-act-grid">
          <button class="adv-btn ${ctpa==='pushOff'?'sel-g':''}" onclick="setF(${p.id},'ctpAction','pushOff')">Move Opp Off Green<br><small>Opp loses GIR pts</small></button>
          <button class="adv-btn ${ctpa==='keep'?'sel-n':''}" onclick="setF(${p.id},'ctpAction','keep')">Keep Opp on Green<br><small>Opp keeps GIR pts</small></button>
        </div>`:''}
      ${ctpState==='lost'?`<div style="background:${odCTP.ctpAction==='pushOff'?'rgba(192,57,43,.1)':'rgba(45,158,72,.1)'};border:1px solid ${odCTP.ctpAction==='pushOff'?'rgba(192,57,43,.3)':'rgba(45,158,72,.3)'};border-radius:8px;padding:8px 12px;font-family:'Barlow Condensed',sans-serif;font-size:.78rem;color:${odCTP.ctpAction==='pushOff'?'#e74c3c':'var(--green)'};text-align:center;margin-top:10px;">${odCTP.ctpAction==='pushOff'?'Your GIR points were stolen':'Opponent kept you on green · You keep GIR points'}</div>`:''}
      ${ctpState==='missed'?`<div style="background:rgba(192,57,43,.1);border:1px solid rgba(192,57,43,.3);border-radius:8px;padding:8px 12px;font-family:'Barlow Condensed',sans-serif;font-size:.78rem;color:#e74c3c;text-align:center;margin-top:10px;">No CTP points awarded this hole</div>`:''}
    </div>`;
    const card=document.createElement('div');
    card.className=`player-card pc${p.ci}`;
    card.innerHTML=`<div class="pcard-hdr"><div>
      <div class="pname" style="color:${PCOLOR[p.ci]}">${p.name}</div>
      ${pCount===4?`<div class="pteam-lbl">${p.team}</div>`:''}
    </div><div class="pts-chip"><div class="pclbl">Hole Pts</div><div class="pcval ${pc(hp.total)}">${ps(hp.total)}</div></div></div>
    ${sH}${tH}${ldH}${ctpH}`;
    con.appendChild(card);
  });
  renderLiveTable();
}

function tog(pid,key,label,sub,type,active){
  const cls=active?(type==='pos'?'on-pos':type==='neg'?'on-neg':type==='neg-locked'?'on-neg-locked':type==='blue'?'on-blue':'on-gold'):'';
  return `<button class="tog-btn ${cls}" onclick="togStat(${pid},'${key}')">${label}<small>${sub}</small></button>`;
}
function ldToggle(pid,key,label,sub,type,active,enabled){
  const cls=active?(type==='neg'?'on-neg':type==='blue'?'on-blue':'on-gold'):'';
  const dis=enabled?'':'disabled style="opacity:.45;cursor:not-allowed"';
  return `<button class="tog-btn ${cls}" ${dis} onclick="togStat(${pid},'${key}')">${label}<small>${sub}</small></button>`;
}

function ctpToggle(pid,key,label,sub,type,active,enabled){
  const cls=active?(type==='neg'?'on-neg':type==='blue'?'on-blue':'on-gold'):'';
  const dis=enabled?'':'disabled style="opacity:.45;cursor:not-allowed"';
  return `<button class="tog-btn ${cls}" ${dis} onclick="togStat(${pid},'${key}')">${label}<small>${sub}</small></button>`;
}

function setScore(pid,actual,key){ensH(pid);G.scores[pid][G.currentHole].score=actual;G.scores[pid][G.currentHole].scoreKey=key;renderCards();}
function togStat(pid,key){
  ensH(pid);const d=G.scores[pid][G.currentHole];
  const opp=getOpponent(pid), od=opp?getData(opp.id):{};
  const oppWon=hasLDWin(od);

  // Long Drive is controlled by Fairway Hit and opponent state.
  if(key==='fir'){
    d.fir=!d.fir;
    if(!d.fir){
      clearLD(d);
      if(opp){
        ensH(opp.id);const od2=getData(opp.id);
        od2.ldLost=false;
        if(od2.ldBoth){od2.ldBoth=false;od2.ldFWOnly=!!od2.fir;od2.ldAction=null;}
      }
    } else {
      syncLongDrive(pid);
    }
    renderCards();return;
  }
  if(key==='ldBoth'){
    if(!d.fir){alert('Select Fairway Hit before selecting Long Drive.');return;}
    if(!opp||!od.fir){alert('Option for both players in the fairway is only available when your opponent also hit the fairway.');return;}
    if(oppWon){alert('Your opponent already won Long Drive. Your only Long Drive selection is Hit FW but Lost LD.');return;}
    d.ldBoth=!d.ldBoth;d.ldFWOnly=false;d.ldLost=false;if(!d.ldBoth)d.ldAction=null;syncLongDrive(pid);renderCards();return;
  }
  if(key==='ldFWOnly'){
    if(!d.fir){alert('Select Fairway Hit before selecting Long Drive.');return;}
    if(opp&&od.fir){alert('Your opponent hit the fairway. Use Both in FW — I Was Longer instead.');return;}
    if(oppWon){alert('Your opponent already won Long Drive. Your only Long Drive selection is Hit FW but Lost LD.');return;}
    d.ldFWOnly=!d.ldFWOnly;d.ldBoth=false;d.ldLost=false;if(!d.ldFWOnly)d.ldAction=null;syncLongDrive(pid);renderCards();return;
  }
  if(key==='ldLost'){
    if(!d.fir){alert('Select Fairway Hit first.');return;}
    if(!oppWon){alert('Hit FW but Lost LD is only available after your opponent wins Long Drive.');return;}
    d.ldLost=!d.ldLost;d.ldBoth=false;d.ldFWOnly=false;d.ldAction=null;renderCards();return;
  }

  // CTP: mutually exclusive and locked against opponent selection
  if(key==='ctpWon'){
    if(!d.gir){alert('Green in Regulation must be selected first.');return;}
    if(!opp || !od.gir){alert('CTP only applies when both players hit the green in regulation.');return;}
    if(od.ctpState==='won'){alert('Your opponent already won CTP. Your only CTP selection is Lost CTP.');return;}
    d.ctpWon=!d.ctpWon;
    d.ctpLost=false;d.ctpMissed=false;
    d.ctpState=d.ctpWon?'won':null;
    d.ctpAction=d.ctpWon?'keep':null;
    syncCTP(pid);
  } else if(key==='ctpLost'){
    if(!d.gir){alert('Green in Regulation must be selected first.');return;}
    if(!opp || !od.gir){alert('CTP only applies when both players hit the green in regulation.');return;}
    if(od.ctpState!=='won'){alert('Lost CTP is only available after your opponent selects Won CTP.');return;}
    d.ctpLost=!d.ctpLost;
    d.ctpWon=false;d.ctpMissed=false;d.ctpAction=null;
    d.ctpState=d.ctpLost?'lost':null;
  } else if(key==='ctpMissed'){
    if(opp && od.ctpState==='won'){alert('Your opponent already won CTP. Your only CTP selection is Lost CTP.');return;}
    if(d.gir && opp && od.gir){alert('Both players hit GIR. Select Won CTP or Lost CTP.');return;}
    d.ctpWon=false;d.ctpLost=false;d.ctpAction=null;
    d.ctpMissed=!d.ctpMissed;
    d.ctpState=d.ctpMissed?'missed':null;
  } else {
    d[key]=!d[key];
    // If GIR is turned off, clear CTP selections for both players in the pairing.
    if(key==='gir' && !d.gir){
      clearCTP(d);
      if(opp){ensH(opp.id); clearCTP(getData(opp.id));}
    }
  }
  renderCards();
}
function adjOB(pid,delta){ensH(pid);const d=G.scores[pid][G.currentHole];d.ob=Math.max(0,(d.ob||0)+delta);renderCards();}
function setF(pid,key,val){
  ensH(pid);const d=G.scores[pid][G.currentHole];
  if(key==='ldAction'){
    const opp=getOpponent(pid), od=opp?getData(opp.id):{};
    if(val!=='skip'){
      if(!d.fir){alert('Select Fairway Hit before choosing a Long Drive action.');return;}
      if(!hasLDWin(d)){alert('Select a valid Long Drive win before choosing Option A or Option B.');return;}
      if(val==='moveOpp' && !od.fir){alert('Option B is only available when your opponent hit the fairway.');return;}
    }
  }
  if(key==='ctpAction'){
    if(d.ctpState!=='won'){alert('Select Won CTP before choosing a CTP action.');return;}
    if(val!=='pushOff' && val!=='keep'){return;}
  }
  d[key]=val;renderCards();
}
function ensH(pid){if(!G.scores[pid][G.currentHole]) G.scores[pid][G.currentHole]={};}
function getPlayer(pid){return G.players.find(p=>p.id===pid);}
function getData(pid,h=G.currentHole){return G.scores[pid]?.[h]||{};}
function hasLDWin(d){return !!(d&& (d.ldBoth||d.ldFWOnly));}
function getOpponent(pid){
  const p=getPlayer(pid);if(!p)return null;
  if(pCount===2) return G.players.find(x=>x.id!==pid)||null;
  if(pCount===4){
    const slot=p.lineupSlot || (p.id===0||p.id===2?1:2);
    return G.players.find(x=>x.teamId!==p.teamId && ((x.lineupSlot || (x.id===0||x.id===2?1:2))===slot))||null;
  }
  return null;
}
function clearLD(d){d.ldBoth=false;d.ldFWOnly=false;d.ldAction=null;d.ldLost=false;}
function syncLongDrive(pid){
  const opp=getOpponent(pid);if(!opp)return;
  ensH(pid);ensH(opp.id);
  const d=getData(pid),od=getData(opp.id);
  if(hasLDWin(d)){
    od.ldBoth=false;od.ldFWOnly=false;od.ldAction=null;
    od.ldLost=!!od.fir;
  } else if(hasLDWin(od)){
    d.ldBoth=false;d.ldFWOnly=false;d.ldAction=null;
    d.ldLost=!!d.fir;
  }
}

function clearCTP(d){d.ctpWon=false;d.ctpLost=false;d.ctpMissed=false;d.ctpAction=null;d.ctpState=null;}
function syncCTP(pid){
  const opp=getOpponent(pid);if(!opp)return;
  ensH(pid);ensH(opp.id);
  const d=getData(pid),od=getData(opp.id);
  if(d.ctpState==='won'){
    od.ctpWon=false;od.ctpMissed=false;od.ctpAction=null;
    od.ctpLost=!!od.gir;
    od.ctpState=od.gir?'lost':null;
  } else if(od.ctpState==='lost'){
    clearCTP(od);
  }
}
function goHole(dir){G.currentHole=Math.max(1,Math.min(G.holes,G.currentHole+dir));renderHole();window.scrollTo(0,0);}

function renderLive(){
  const bar=document.getElementById('liveBar');if(!G.players.length)return;
  bar.style.display='flex';
  let h='';
  G.players.forEach((p,i)=>{
    const t=playerTot(p.id).total;
    if(i>0) h+=`<div class="lb-sep">·</div>`;
    h+=`<div class="lb-item"><div class="lb-name" style="color:${PCOLOR[p.ci]}">${p.name.split(' ')[0]}</div><div class="lb-score ${pc(t)}">${ps(t)}</div></div>`;
  });
  h+=`<div style="position:absolute;top:3px;left:50%;transform:translateX(-50%);font-family:'Barlow Condensed',sans-serif;font-size:.55rem;letter-spacing:2px;color:var(--text-muted);text-transform:uppercase">Hole ${G.currentHole}/${G.holes}</div>`;
  bar.style.position='relative';
  bar.innerHTML=h;
}

function renderLiveTable(){
  const tbody=document.getElementById('liveBody');if(!tbody)return;
  tbody.innerHTML='';
  G.players.forEach(p=>{
    const t=playerTot(p.id);
    const row=document.createElement('tr');
    row.innerHTML=`<td><strong style="color:${PCOLOR[p.ci]}">${p.name}</strong></td>
      <td style="color:var(--text-muted);font-size:.8rem">${pCount===4?p.team:''}</td>
      <td style="text-align:right" class="${pc(t.score)}">${ps(t.score)}</td>
      <td style="text-align:right" class="${pc(t.stat)}">${ps(t.stat)}</td>
      <td style="text-align:right"><span class="big-num ${pc(t.total)}">${ps(t.total)}</span></td>`;
    tbody.appendChild(row);
  });
}

function strokeTotal(pid){
  let total=0;
  for(let h=1;h<=G.holes;h++){
    const d=G.scores[pid]?.[h];
    if(d && Number.isFinite(Number(d.score))) total+=Number(d.score);
  }
  return total;
}
function lowRoundBonuses(){
  const lrB={};
  if(!G.players.length) return lrB;
  const totals=G.players.map(p=>({id:p.id,strokes:strokeTotal(p.id)}));
  const completed=totals.filter(x=>x.strokes>0);
  if(!completed.length) return lrB;
  const low=Math.min(...completed.map(x=>x.strokes));
  const tied=completed.filter(x=>x.strokes===low);
  const split=Math.ceil(AX_GOLF.lowRound / tied.length);
  tied.forEach(x=>lrB[x.id]=split);
  return lrB;
}

function finalPlayerReport(lrB={}){
  return G.players.map(p=>{
    let scorePts=0,statPts=0,penaltyPts=0;
    let ldsWon=0,ctpsWon=0,fir=0,gir=0,sand=0,onePutt=0,holeOut=0,threePutt=0,obLost=0;
    for(let h=1;h<=G.holes;h++){
      const d=G.scores[p.id]?.[h]||{};
      const hp=holePtsDetailed(p.id,h);
      scorePts+=hp.score;
      statPts+=hp.stat;
      penaltyPts+=hp.penalty;
      if(hasLDWin(d)) ldsWon++;
      if(d.ctpState==='won'||d.ctpWon) ctpsWon++;
      if(d.fir) fir++;
      if(d.gir) gir++;
      if(d.sand) sand++;
      if(d.onePutt) onePutt++;
      if(d.holeOut) holeOut++;
      if(d.threePutt) threePutt++;
      if(d.ob) obLost+=Number(d.ob)||0;
    }
    const bonus=lrB[p.id]||0;
    const totalPoints=scorePts+statPts+penaltyPts+bonus;
    return {
      player:p.name,
      team:pCount===4?p.team:'',
      strokePlayScore:strokeTotal(p.id)||0,
      totalPoints,
      ldsWon,
      ctpsWon,
      fir,
      gir,
      sand,
      onePutt,
      holeOut,
      threePutt,
      obLost
    };
  });
}

function renderSummaryReport(lrB={}){
  const tbl=document.getElementById('summaryReportTbl');
  if(!tbl) return;
  const rows=finalPlayerReport(lrB);
  let h=`<thead><tr>
    <th>Player</th>${pCount===4?'<th>Team</th>':''}<th>Stroke Play<br>Score</th><th>Total Individual<br>Points</th><th>LDs<br>Won</th><th>CTPs<br>Won</th><th>Fairways Hit<br>in Reg</th><th>Greens Hit<br>in Reg</th><th>Sand<br>Saves</th><th>One<br>Putts</th><th>Hole<br>Outs</th><th>3 Putts<br>or Worse</th><th>OB/Lost<br>Balls</th>
  </tr></thead><tbody>`;
  rows.forEach(r=>{
    const p=G.players.find(x=>x.name===r.player) || {};
    h+=`<tr><td><strong style="color:${PCOLOR[p.ci||0]}">${r.player}</strong></td>${pCount===4?`<td>${r.team}</td>`:''}<td>${r.strokePlayScore||'—'}</td><td class="${pc(r.totalPoints)}"><strong>${ps(r.totalPoints)}</strong></td><td>${r.ldsWon}</td><td>${r.ctpsWon}</td><td>${r.fir}</td><td>${r.gir}</td><td>${r.sand}</td><td>${r.onePutt}</td><td>${r.holeOut}</td><td>${r.threePutt}</td><td>${r.obLost}</td></tr>`;
  });
  tbl.innerHTML=h+'</tbody>';
}

function safeFileName(value){return String(value||'AX-Golf').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,60)||'AX-Golf';}

function downloadSummaryReport(){
  const lrB=G.finalized?lowRoundBonuses():{};
  const reportRows=finalPlayerReport(lrB);
  const title='AX Golf Final Match Report';
  const meta=`${G.course}${G.matchNum?' · Match #'+G.matchNum:''} · ${fmtDate(G.date)} · ${G.holes} Holes`;
  const fileName=`${safeFileName(G.course)}-${safeFileName(G.date)}-Final-Match-Report.pdf`;

  const breakdownBody=[];
  G.players.forEach(p=>{
    let score=0,stat=0,pen=0;
    for(let h=1;h<=G.holes;h++){
      const hp=holePtsDetailed(p.id,h);
      score+=hp.score;
      stat+=hp.stat;
      pen+=hp.penalty;
    }
    const bonus=lrB[p.id]||0;
    breakdownBody.push([p.name].concat(pCount===4?[p.team]:[],[score,stat,pen,bonus||'',score+stat+pen+bonus]));
  });

  const summaryHead=[['Player'].concat(pCount===4?['Team']:[],['Stroke Play Score','Total Individual Points','LDs Won','CTPs Won','Fairways Hit in Reg','Greens Hit in Reg','Sand Saves','One Putts','Hole Outs','3 Putts or Worse','OB/Lost Balls'])];
  const summaryBody=reportRows.map(r=>[r.player].concat(pCount===4?[r.team]:[],[r.strokePlayScore||'',r.totalPoints,r.ldsWon,r.ctpsWon,r.fir,r.gir,r.sand,r.onePutt,r.holeOut,r.threePutt,r.obLost]));

  const hbdHead=[['Hole','Par'].concat(G.players.map(p=>`${p.name} Pts / Strokes`))];
  const run={}, strokeRun={};
  G.players.forEach(p=>{run[p.id]=0;strokeRun[p.id]=0;});
  const hbdBody=[];
  for(let i=1;i<=G.holes;i++){
    const row=[i,G.pars[i]||''];
    G.players.forEach(p=>{
      const hp=holePts(p.id,i);
      const sc=G.scores[p.id]?.[i]?.score;
      run[p.id]+=hp.total;
      if(sc) strokeRun[p.id]+=sc;
      row.push(`${ps(hp.total)} / ${sc||'-'}`);
    });
    hbdBody.push(row);
  }
  hbdBody.push(['POINT TOTAL',''].concat(G.players.map(p=>ps(run[p.id]))));
  hbdBody.push(['STROKE TOTAL',''].concat(G.players.map(p=>strokeRun[p.id]||'-')));

  function getWinnerText(){
    const tots={};G.players.forEach(p=>{tots[p.id]=playerTot(p.id).total;});
    if(pCount===4){
      const t1s=G.players.filter(p=>p.teamId===1).reduce((s,p)=>s+tots[p.id]+(lrB[p.id]||0),0);
      const t2s=G.players.filter(p=>p.teamId===2).reduce((s,p)=>s+tots[p.id]+(lrB[p.id]||0),0);
      const t1n=G.players.find(p=>p.teamId===1)?.team||'Team 1';
      const t2n=G.players.find(p=>p.teamId===2)?.team||'Team 2';
      if(t1s>t2s) return `${t1n} Wins (${t1s} - ${t2s})`;
      if(t2s>t1s) return `${t2n} Wins (${t2s} - ${t1s})`;
      return `Tie (${t1s} - ${t2s})`;
    }
    const finals=G.players.map(p=>({p,s:tots[p.id]+(lrB[p.id]||0)}));
    const maxF=Math.max(...finals.map(x=>x.s));
    const topF=finals.filter(x=>x.s===maxF);
    return topF.length===1?`${topF[0].p.name} Wins (${maxF} pts)`: `Tie (${maxF} pts)`;
  }

  if(window.jspdf && window.jspdf.jsPDF){
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape',unit:'pt',format:'letter'});
    let y=42;
    doc.setFont('helvetica','bold');
    doc.setFontSize(16);
    doc.text(title,40,y);
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    y+=18;
    doc.text(meta,40,y);

    y+=22;
    doc.setFont('helvetica','bold');
    doc.setFontSize(12);
    doc.text('Match Summary',40,y);
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    y+=16;
    doc.text(getWinnerText(),40,y);

    doc.autoTable({
      head:[['Player'].concat(pCount===4?['Team']:[],['Final Points','Stroke Play Score'])],
      body:reportRows.map(r=>[r.player].concat(pCount===4?[r.team]:[],[r.totalPoints,r.strokePlayScore||''])),
      startY:y+14,theme:'grid',styles:{fontSize:8,cellPadding:4,halign:'center'},headStyles:{fillColor:[21,101,192],textColor:255},columnStyles:{0:{halign:'left'}}
    });

    doc.autoTable({
      head:[['Player'].concat(pCount===4?['Team']:[],['Score','Stats','Penalty','Bonus','Total'])],
      body:breakdownBody,
      startY:doc.lastAutoTable.finalY+18,theme:'grid',styles:{fontSize:8,cellPadding:4,halign:'center'},headStyles:{fillColor:[21,101,192],textColor:255},columnStyles:{0:{halign:'left'}}
    });

    doc.addPage('letter','landscape');
    doc.setFont('helvetica','bold');
    doc.setFontSize(13);
    doc.text('Match Summary Report',40,42);
    doc.autoTable({head:summaryHead,body:summaryBody,startY:58,theme:'grid',styles:{fontSize:7,cellPadding:3,halign:'center'},headStyles:{fillColor:[21,101,192],textColor:255},columnStyles:{0:{halign:'left'}}});

    doc.addPage('letter','landscape');
    doc.setFont('helvetica','bold');
    doc.setFontSize(13);
    doc.text('Hole by Hole',40,42);
    doc.autoTable({head:hbdHead,body:hbdBody,startY:58,theme:'grid',styles:{fontSize:8,cellPadding:4,halign:'center'},headStyles:{fillColor:[21,101,192],textColor:255},columnStyles:{0:{halign:'left'}}});
    doc.save(fileName);
    return;
  }

  // Fallback for browsers that cannot load the PDF library.
  const printable=window.open('','_blank');
  if(!printable){alert('Please allow pop-ups to print or save the report as a PDF.');return;}
  const tableHtml=(head,body)=>`<table><thead><tr>${head[0].map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${body.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  printable.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%;font-size:11px;margin-bottom:22px}th,td{border:1px solid #999;padding:6px;text-align:center}th{background:#e8f4fd}td:first-child,th:first-child{text-align:left}h3{margin-top:24px}</style></head><body><h2>${title}</h2><p>${meta}</p><h3>Match Summary</h3><p>${getWinnerText()}</p>${tableHtml([['Player'].concat(pCount===4?['Team']:[],['Final Points','Stroke Play Score'])],reportRows.map(r=>[r.player].concat(pCount===4?[r.team]:[],[r.totalPoints,r.strokePlayScore||''])))}<h3>Player Breakdown</h3>${tableHtml([['Player'].concat(pCount===4?['Team']:[],['Score','Stats','Penalty','Bonus','Total'])],breakdownBody)}<h3>Match Summary Report</h3>${tableHtml(summaryHead,summaryBody)}<h3>Hole by Hole</h3>${tableHtml(hbdHead,hbdBody)}<p>Use your browser's Print command and choose Save as PDF.</p></body></html>`);
  printable.document.close();
  printable.focus();
  printable.print();
}

function finalizeMatch(){
  const ok = window.confirm('Finalize Match?');
  if(!ok) return;
  G.finalized = true;
  showSummary(true);
}

function showSummary(isFinal=false){
  isFinal = isFinal || G.finalized;
  const tots={};G.players.forEach(p=>{tots[p.id]=playerTot(p.id).total;});
  const lrB=isFinal?lowRoundBonuses():{};
  document.getElementById('sumMeta').textContent=`${G.course}${G.matchNum?' · Match #'+G.matchNum:''} · ${fmtDate(G.date)} · ${G.holes} Holes`;

  // Score display grid
  const sg=document.getElementById('sumGrid');
  function sBlock(p,score,bonus){return `<div class="sum-block"><div class="sbn" style="color:${PCOLOR[p.ci]}">${p.name}</div><div class="sbs ${pc(score)}">${ps(score)}</div>${bonus?'<div class="sbb"> +'+bonus+' Low Round</div>':''}</div>`;}
  if(pCount===2){
    const[a,b]=G.players;const sa=tots[a.id]+(lrB[a.id]||0),sb=tots[b.id]+(lrB[b.id]||0);
    sg.innerHTML=`<div class="sg2">${sBlock(a,sa,lrB[a.id])}<div class="vs-sep">VS</div>${sBlock(b,sb,lrB[b.id])}</div>`;
  } else if(pCount===4){
    const t1ps=G.players.filter(p=>p.teamId===1),t2ps=G.players.filter(p=>p.teamId===2);
    const t1s=t1ps.reduce((s,p)=>s+tots[p.id]+(lrB[p.id]||0),0),t2s=t2ps.reduce((s,p)=>s+tots[p.id]+(lrB[p.id]||0),0);
    const t1b=t1ps.some(p=>lrB[p.id]),t2b=t2ps.some(p=>lrB[p.id]);
    sg.innerHTML=`<div class="sg2">
      <div class="sum-block"><div class="sbn" style="color:${PCOLOR[0]}">${t1ps[0].team}</div><div class="sbs ${pc(t1s)}">${ps(t1s)}</div>${t1b?'<div class="sbb"> Low Round Bonus Applied</div>':''}</div>
      <div class="vs-sep">VS</div>
      <div class="sum-block"><div class="sbn" style="color:${PCOLOR[2]}">${t2ps[0].team}</div><div class="sbs ${pc(t2s)}">${ps(t2s)}</div>${t2b?'<div class="sbb"> Low Round Bonus Applied</div>':''}</div>
    </div>`;
  } else {
    sg.innerHTML=`<div class="${pCount===1?'sg1':'sg-multi'}">${G.players.map(p=>sBlock(p,tots[p.id]+(lrB[p.id]||0),lrB[p.id])).join('')}</div>`;
  }

  // Winner
  let wH='';
  if(pCount===4){
    const t1s=G.players.filter(p=>p.teamId===1).reduce((s,p)=>s+tots[p.id]+(lrB[p.id]||0),0);
    const t2s=G.players.filter(p=>p.teamId===2).reduce((s,p)=>s+tots[p.id]+(lrB[p.id]||0),0);
    const t1n=G.players.find(p=>p.teamId===1)?.team||'Team 1',t2n=G.players.find(p=>p.teamId===2)?.team||'Team 2';
    if(t1s>t2s) wH=`<div class="winner-pill"> ${t1n} WINS</div>`;
    else if(t2s>t1s) wH=`<div class="winner-pill"> ${t2n} WINS</div>`;
    else wH=`<div class="winner-pill"> TIE</div>`;
  } else {
    const finals=G.players.map(p=>({p,s:tots[p.id]+(lrB[p.id]||0)}));
    const maxF=Math.max(...finals.map(x=>x.s));
    const topF=finals.filter(x=>x.s===maxF);
    if(topF.length===1) wH=`<div class="winner-pill"> ${topF[0].p.name} WINS</div>`;
    else wH=`<div class="winner-pill"> TIE</div>`;
  }
  document.getElementById('sumWinner').innerHTML=wH;

  // Player breakdown
  // IMPORTANT: Use the same per-hole scoring engine as the Hole by Hole summary.
  // This prevents the breakdown totals from drifting when LD/CTP rules affect FIR/GIR points.
  const ptbl=document.getElementById('sumBody');ptbl.innerHTML='';
  G.players.forEach(p=>{
    let score=0,stat=0,pen=0;
    for(let h=1;h<=G.holes;h++){
      const hp=holePtsDetailed(p.id,h);
      score+=hp.score;
      stat+=hp.stat;
      pen+=hp.penalty;
    }
    const bonus=lrB[p.id]||0,total=score+stat+pen+bonus;
    const row=document.createElement('tr');
    row.innerHTML=`<td><strong style="color:${PCOLOR[p.ci]}">${p.name}</strong>${pCount===4?`<br><small style="color:var(--text-muted)">${p.team}</small>`:''}</td>
      <td style="text-align:center" class="${pc(score)}">${ps(score)}</td>
      <td style="text-align:center" class="${pc(stat)}">${ps(stat)}</td>
      <td style="text-align:center" class="${pc(pen)}">${ps(pen)}</td>
      <td style="text-align:center" class="c-gold">${bonus?'+'+bonus:'—'}</td>
      <td style="text-align:right"><strong class="${pc(total)}">${ps(total)}</strong></td>`;
    ptbl.appendChild(row);
  });

  renderSummaryReport(lrB);

  // Hole by hole
  const hbt=document.getElementById('hbdTbl');
  let h=`<thead><tr><th>Hole</th><th>Par</th>`;
  G.players.forEach(p=>h+=`<th style="color:${PCOLOR[p.ci]}">${p.name.split(' ')[0]}<br><small>Pts / Strokes</small></th>`);
  h+=`</tr></thead><tbody>`;
  const run={}, strokeRun={};
  G.players.forEach(p=>{run[p.id]=0;strokeRun[p.id]=0;});

  for(let i=1;i<=G.holes;i++){
    const par=G.pars[i];
    h+=`<tr><td><strong>${i}</strong></td><td style="color:var(--text-muted)">${par}</td>`;
    G.players.forEach(p=>{
      const hp=holePts(p.id,i);
      run[p.id]+=hp.total;
      const sc=G.scores[p.id]?.[i]?.score;
      if(sc){
        strokeRun[p.id]+=sc;
      }
      h+=`<td class="${pc(hp.total)}">${ps(hp.total)}<br><small style="font-size:.62rem;color:var(--text-muted)">${sc||'–'}</small></td>`;
    });
    h+=`</tr>`;
  }

  h+=`<tr class="tot"><td colspan="2">POINT TOTAL</td>`;
  G.players.forEach(p=>h+=`<td class="${pc(run[p.id])}">${ps(run[p.id])}</td>`);
  h+=`</tr>`;

  h+=`<tr class="tot"><td colspan="2">STROKE TOTAL</td>`;
  G.players.forEach(p=>h+=`<td>${strokeRun[p.id]||'–'}</td>`);
  h+=`</tr></tbody>`;
  hbt.innerHTML=h;

  // Show correct buttons
  const holesPlayed=G.players.length?Object.keys(G.scores[G.players[0].id]).length:0;
  const returnBtn=document.getElementById('returnBtn');
  const newMatchBtn=document.getElementById('newMatchBtn');
  const downloadReportBtn=document.getElementById('downloadReportBtn');
  if(isFinal){
    returnBtn.style.display='none';
    newMatchBtn.style.display='block';
    if(downloadReportBtn) downloadReportBtn.style.display='block';
    document.querySelector('.sum-hero h2').textContent='Match Results';
  } else {
    returnBtn.style.display='block';
    newMatchBtn.style.display='block';
    if(downloadReportBtn) downloadReportBtn.style.display='none';
    document.querySelector('.sum-hero h2').textContent=`Scores — Hole ${G.currentHole} of ${G.holes}`;
  }

  switchScreen('summaryScreen');window.scrollTo(0,0);
}

function returnToScoring(){switchScreen('scoringScreen');renderHole();window.scrollTo(0,0);}
function hideLive(){const lb=document.getElementById('liveBar'); if(lb) lb.style.display='none';}
function showMainMenu(){switchScreen('mainMenuScreen');hideLive();window.scrollTo(0,0);}
function goHome(){goPlay();}
function goPlay(){switchScreen('setupScreen');hideLive();window.scrollTo(0,0);}
function showRules(){switchScreen('rulesScreen');hideLive();window.scrollTo(0,0);}
function showLeagues(){switchScreen('leaguesScreen');hideLive();window.scrollTo(0,0);}
function showContact(){
  switchScreen('contactScreen');
  hideLive();
  const session=getSession && getSession();
  if(session){
    const nameEl=document.getElementById('contactName');
    const emailEl=document.getElementById('contactEmail');
    if(nameEl && !nameEl.value) nameEl.value=session.name||'';
    if(emailEl && !emailEl.value) emailEl.value=session.email||'';
  }
  setContactStatus('', '');
  window.scrollTo(0,0);
}
function setContactStatus(type,msg){
  const el=document.getElementById('contactStatus');
  if(!el) return;
  el.className='contact-status' + (type ? ' ' + type : '');
  el.textContent=msg||'';
}
async function submitContactForm(event){
  event.preventDefault();
  const form=document.getElementById('contactForm');
  const btn=document.getElementById('contactSubmitBtn');
  const endpoint='https://formspree.io/f/xbdepqba';
  if(endpoint.includes('YOUR_FORM_ID')){
    setContactStatus('err','Formspree is not connected yet. Replace YOUR_FORM_ID in the HTML with your Formspree form ID.');
    return;
  }
  btn.disabled=true;
  btn.textContent='SENDING...';
  setContactStatus('', '');
  try{
    const response=await fetch(endpoint,{method:'POST',body:new FormData(form),headers:{'Accept':'application/json'}});
    if(response.ok){
      form.reset();
      setContactStatus('ok','Thank you. Your message has been sent to AX Golf.');
    }else{
      setContactStatus('err','The message could not be sent. Please check your connection and try again.');
    }
  }catch(err){
    setContactStatus('err','The message could not be sent. Please check your connection and try again.');
  }finally{
    btn.disabled=false;
    btn.textContent='SEND MESSAGE';
  }
}
function newMatch(){matchStarted=false;G={course:'',date:document.getElementById('matchDate').value||new Date().toISOString().split('T')[0],matchNum:'',players:[],holes:9,currentHole:1,pars:{},scores:{},finalized:false};document.getElementById('startMatchBtn').textContent='START AX GOLF MATCH';switchScreen('setupScreen');document.getElementById('liveBar').style.display='none';window.scrollTo(0,0);}
function switchScreen(id){document.querySelectorAll('.auth-screen').forEach(s=>s.classList.remove('active'));document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));const target=document.getElementById(id);if(target){target.classList.add('active');}document.getElementById('mainHeader').style.display='flex';}

// ══ AUTH ══
// NOTE: This stores accounts locally for now.
// Replace the doLogin / doCreate functions with Firebase Auth calls when ready.

function showAuth(screenId){
  document.querySelectorAll('.auth-screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  clearAuthErrs();
}

function clearAuthErrs(){
  ['loginErr','createErr'].forEach(id=>{const el=document.getElementById(id);if(el){el.style.display='none';el.textContent='';}});
}

function showErr(id,msg){const el=document.getElementById(id);el.textContent=msg;el.style.display='block';}

function getAccounts(){return JSON.parse(localStorage.getItem('ax_golf_accounts')||'{}');}
function saveAccounts(accts){localStorage.setItem('ax_golf_accounts',JSON.stringify(accts));}
function getSession(){return JSON.parse(localStorage.getItem('ax_golf_session')||'null');}
function saveSession(user){localStorage.setItem('ax_golf_session',JSON.stringify(user));}
function clearSession(){localStorage.removeItem('ax_golf_session');}

function doCreate(){
  const name=document.getElementById('createName').value.trim();
  const email=document.getElementById('createEmail').value.trim().toLowerCase();
  const pass=document.getElementById('createPassword').value;
  const confirm=document.getElementById('createConfirm').value;
  if(!name) return showErr('createErr','Please enter your full name.');
  if(!email||!email.includes('@')) return showErr('createErr','Please enter a valid email address.');
  if(pass.length<6) return showErr('createErr','Password must be at least 6 characters.');
  if(pass!==confirm) return showErr('createErr','Passwords do not match.');
  const accts=getAccounts();
  if(accts[email]) return showErr('createErr','An account with that email already exists.');
  // TODO: Replace with Firebase createUserWithEmailAndPassword(auth, email, pass)
  accts[email]={name,email,pass};
  saveAccounts(accts);
  saveSession({name,email});
  enterApp(name);
}

function doLogin(){
  const email=document.getElementById('loginEmail').value.trim().toLowerCase();
  const pass=document.getElementById('loginPassword').value;
  if(!email) return showErr('loginErr','Please enter your email.');
  if(!pass) return showErr('loginErr','Please enter your password.');
  // TODO: Replace with Firebase signInWithEmailAndPassword(auth, email, pass)
  const accts=getAccounts();
  const user=accts[email];
  if(!user||user.pass!==pass) return showErr('loginErr','Incorrect email or password.');
  saveSession({name:user.name,email});
  enterApp(user.name);
}

function doLogout(){
  // TODO: Replace with Firebase signOut(auth)
  clearSession();
  document.getElementById('mainHeader').style.display='none';
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  showAuth('loginScreen');
}

function enterApp(name){
  document.querySelectorAll('.auth-screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('mainHeader').style.display='flex';
  document.getElementById('hdrUser').textContent=name;
  document.getElementById('mainMenuScreen').classList.add('active');
  hideLive();
}

// Init — Auth bypass enabled.
// Login/create-account screens and auth functions are preserved above for future use,
// but the app now opens directly to the AX Golf home menu.
document.getElementById('matchDate').value=new Date().toISOString().split('T')[0];
setCount(2);
document.querySelectorAll('.auth-screen').forEach(s=>s.classList.remove('active'));
document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
document.getElementById('mainHeader').style.display='flex';
document.getElementById('mainMenuScreen').classList.add('active');
hideLive();
