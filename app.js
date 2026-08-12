const API="https://api.sleeper.app/v1";
const DYNASTY_DATA_URL="https://raw.githubusercontent.com/dynastyprocess/data/master/files/values-players.csv";
const $=id=>document.getElementById(id);

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({
"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

function lid(v){
const m=String(v).match(/\d{8,}/g);
return m?m[m.length-1]:"";
}

async function get(url){
const r=await fetch(url);
if(!r.ok)throw Error("Request returned "+r.status);
return r.json();
}

async function getText(url){
const r=await fetch(url);
if(!r.ok)throw Error("Market data returned "+r.status);
return r.text();
}

function parseCSV(text){
const rows=[];
let row=[],field="",quoted=false;

for(let i=0;i<text.length;i++){
const c=text[i],next=text[i+1];

if(c==='"'&&quoted&&next==='"'){
field+='"';i++;continue;
}

if(c==='"'){
quoted=!quoted;continue;
}

if(c===","&&!quoted){
row.push(field);field="";continue;
}

if((c==="\n"||c==="\r")&&!quoted){
if(c==="\r"&&next==="\n")i++;
row.push(field);
if(row.some(x=>x!==""))rows.push(row);
row=[];field="";continue;
}

field+=c;
}

if(field||row.length){
row.push(field);rows.push(row);
}

if(rows.length<2)return [];

const headers=rows.shift().map(h=>h.trim());

return rows.map(values=>
Object.fromEntries(headers.map((h,i)=>[h,values[i]??""]))
);
}

function normalizeName(name){
return String(name||"")
.toLowerCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g,"")
.replace(/\b(jr|sr|ii|iii|iv)\b\.?/g,"")
.replace(/[^a-z0-9]/g,"");
}

function playerName(p,id){
return p?.full_name||
[p?.first_name,p?.last_name].filter(Boolean).join(" ")||
`Unknown Player (${id})`;
}

function position(p){
return p?.fantasy_positions?.[0]||p?.position||"?";
}

function cleanSlot(slot){
const map={
SUPER_FLEX:"SF",
REC_FLEX:"FLEX",
WRRB_FLEX:"FLEX",
FLEX:"FLEX",
IDP_FLEX:"IDP",
DEF:"DST"
};
return (map[slot]||slot||"?").replace("_FLEX","");
}

function countSlots(arr){
const out={};
for(const slot of arr||[]){
if(slot==="BN")continue;
out[slot]=(out[slot]||0)+1;
}
return out;
}

const slotCount=(counts,slot)=>Number(counts[slot]||0);

function scoringProfile(s={}){
const chips=[];
const rec=Number(s.rec||0);

chips.push(rec>0?`${rec} PPR`:"Standard receptions");

if(s.pass_td!=null)chips.push(`${s.pass_td} pt Pass TD`);

if(Number(s.bonus_rec_te||0)>0){
chips.push(`TE Premium +${s.bonus_rec_te}`);
}else if(Number(s.rec_te||0)>rec){
chips.push(`TE Premium ${s.rec_te} PPR`);
}

const idpKeys=Object.keys(s).filter(k=>
/tkl|sack|int|ff|fum|def|qb_hit|pass_def|ast/.test(k)
);

if(idpKeys.length)chips.push("IDP scoring");

return {chips,idpKeys};
}

function calcValueContext(league,counts){
const teams=Number(league.total_rosters||0)||12;
const scoring=league.scoring_settings||{};
const teamPressure=Math.max(0,teams-12)*3;

const qb=slotCount(counts,"QB");
const sf=slotCount(counts,"SUPER_FLEX");
const rb=slotCount(counts,"RB");
const wr=slotCount(counts,"WR");
const te=slotCount(counts,"TE");

const flex=
slotCount(counts,"FLEX")+
slotCount(counts,"REC_FLEX")+
slotCount(counts,"WRRB_FLEX");

const dl=
slotCount(counts,"DL")+
slotCount(counts,"DE")+
slotCount(counts,"DT");

const lb=slotCount(counts,"LB");

const db=
slotCount(counts,"DB")+
slotCount(counts,"CB")+
slotCount(counts,"S");

const idpFlex=slotCount(counts,"IDP_FLEX");
const passTD=Number(scoring.pass_td||4);
const ppr=Number(scoring.rec||0);
const teBonus=Number(scoring.bonus_rec_te||0);
const tePpr=Number(scoring.rec_te||ppr);

const idpSettings=Object.keys(scoring).filter(k=>
/tkl|sack|int|ff|fum|def|qb_hit|pass_def|ast/.test(k)
).length;

const QB=
100+teamPressure+sf*28+
Math.max(0,qb-1)*15+
Math.max(0,passTD-4)*4;

const RB=
100+teamPressure+
Math.max(0,rb-2)*7+
flex*4+ppr*2;

const WR=
100+teamPressure+
Math.max(0,wr-2)*7+
flex*5+ppr*5;

const TE=
100+teamPressure+
Math.max(0,te-1)*10+
flex*2+
teBonus*15+
Math.max(0,tePpr-ppr)*15;

const idpBase=
100+teamPressure+
Math.min(15,idpSettings*.4);

return {
QB:{
score:Math.round(QB),
demand:teams*(qb+sf),
reason:sf?`${teams}-team Superflex creates major quarterback scarcity.`:`${teams}-team QB demand.`
},
RB:{
score:Math.round(RB),
demand:teams*rb,
reason:`${rb} dedicated RB slots plus ${flex} flex slots per team.`
},
WR:{
score:Math.round(WR),
demand:teams*wr,
reason:`${wr} dedicated WR slots plus ${flex} flex slots and ${ppr} PPR scoring.`
},
TE:{
score:Math.round(TE),
demand:teams*te,
reason:(teBonus>0||tePpr>ppr)?"Tight ends receive premium reception scoring.":`${te} starting TE slot per team.`
},
DL:{
score:Math.round(idpBase+dl*5+idpFlex*3),
demand:teams*dl,
reason:`${dl} dedicated DL slots plus ${idpFlex} IDP flex slots per team.`
},
LB:{
score:Math.round(idpBase+lb*5+idpFlex*3),
demand:teams*lb,
reason:`${lb} dedicated LB slots plus ${idpFlex} IDP flex slots per team.`
},
DB:{
score:Math.round(idpBase+db*5+idpFlex*3),
demand:teams*db,
reason:`${db} dedicated DB slots plus ${idpFlex} IDP flex slots per team.`
}
};
}

const LEAGUE_RULES={
QB:{rate:.0028,maxUp:.12,maxDown:.06},
RB:{rate:.0020,maxUp:.08,maxDown:.06},
WR:{rate:.0024,maxUp:.10,maxDown:.06},
TE:{rate:.0026,maxUp:.12,maxDown:.06}
};

function leagueDelta(pos,context){
const rule=LEAGUE_RULES[pos]||{rate:.002,maxUp:.08,maxDown:.06};
const pressure=(context[pos]?.score||100)-100;
return Math.min(rule.maxUp,Math.max(-rule.maxDown,pressure*rule.rate));
}

function ageDelta(pos,age){
if(!Number.isFinite(age))return 0;

if(pos==="QB"){
if(age<24)return .14;
if(age<26)return .11;
if(age<28)return .07;
if(age<30)return .02;
if(age<32)return -.03;
if(age<34)return -.08;
return -.14;
}

if(pos==="RB"){
if(age<23)return .10;
if(age<25)return .06;
if(age<27)return 0;
if(age<29)return -.08;
return -.16;
}

if(pos==="WR"){
if(age<23)return .10;
if(age<25)return .07;
if(age<27)return .03;
if(age<29)return 0;
if(age<31)return -.06;
return -.12;
}

if(pos==="TE"){
if(age<24)return .09;
if(age<27)return .05;
if(age<30)return .01;
if(age<32)return -.05;
return -.10;
}

return 0;
}

function buildMarketMap(rows){
const map=new Map();

for(const row of rows){
const pos=String(row.pos||"").trim().toUpperCase();

if(!["QB","RB","WR","TE"].includes(pos))continue;

const base=Number(row.value_2qb||0);
if(!base)continue;

const name=normalizeName(row.player);
if(!name)continue;

map.set(`${name}|${pos}`,{
name:row.player,
pos,
team:row.team,
age:Number(row.age)||null,
ecr:Number(row.ecr_2qb)||null,
base,
date:row.scrape_date||""
});
}

return map;
}

function rankExpectedValue(ecr){
if(!Number.isFinite(ecr)||ecr<=0)return null;
return Math.round(10500*Math.exp(-.018*(ecr-1)));
}

function confidenceFor(base,ecr){
const expected=rankExpectedValue(ecr);

if(!expected||!base){
return {label:"Limited signal",gap:0};
}

const gap=Math.abs(base-expected)/Math.max(base,expected);

if(gap<.12)return {label:"High confidence",gap};
if(gap<.25)return {label:"Moderate confidence",gap};
return {label:"Market disagreement",gap};
}

function playerValuation(id,players,marketMap,context,tradeCounts){
const p=players[id];
const pos=position(p);

if(!["QB","RB","WR","TE"].includes(pos))return null;

const name=playerName(p,id);

const market=marketMap.get(
`${normalizeName(name)}|${pos}`
);

if(!market)return null;

const league=leagueDelta(pos,context);
const age=ageDelta(pos,market.age);
const confidence=confidenceFor(market.base,market.ecr);

const rawDelta=league+age;
const totalDelta=Math.min(.22,Math.max(-.20,rawDelta));

const adjusted=Math.round(
market.base*(1+totalDelta)
);

return {
id,
name,
pos,
team:p?.team||market.team||"FA",
age:market.age,
ecr:market.ecr,
base:market.base,
date:market.date,
leaguePct:Math.round(league*100),
agePct:Math.round(age*100),
totalPct:Math.round(totalDelta*100),
adjusted,
confidence:confidence.label,
tradeCount:tradeCounts[id]||0
};
}

function valueCard(pos,data){
const width=Math.min(
100,
Math.max(12,((data.score-70)/80)*100)
);

const label=
data.score>=135?"Extreme pressure":
data.score>=120?"High pressure":
data.score>=108?"Elevated":
data.score>=95?"Neutral":
"Reduced";

return `
<div class="value-card">
<h3>${esc(pos)}</h3>
<div class="value-number">${data.score}</div>
<div class="value-label">${label}</div>
<div class="value-bar">
<div class="value-fill" style="width:${width}%"></div>
</div>
<div class="value-note">
<span class="demand">${data.demand}</span>
dedicated league-wide starter opportunities.
<br><br>
${esc(data.reason)}
</div>
</div>`;
}

function valueExplanation(ctx){
const ranked=Object.entries(ctx)
.sort((a,b)=>b[1].score-a[1].score);

const top=ranked[0];
const second=ranked[1];

const idpAvg=Math.round(
(ctx.DL.score+ctx.LB.score+ctx.DB.score)/3
);

return `The strongest league-driven value pressure is currently ${top[0]} (${top[1].score}), followed by ${second[0]} (${second[1].score}). The combined IDP environment averages ${idpAvg}. v0.6 keeps league pressure separate from the player's dynasty age curve and market baseline.`;
}

function signPct(n){
return `${n>0?"+":""}${n}%`;
}

function playerCard(v,rank){
const totalClass=v.totalPct<0?"signal bad":"signal good";

return `
<div class="player-card">

<div class="rank">#${rank}</div>

<div>

<div class="pv-name">
${esc(v.name)}
</div>

<div class="pv-meta">
${esc(v.pos)} • ${esc(v.team)}
${v.age?` • Age ${v.age}`:""}
${v.ecr?` • 2QB ECR ${v.ecr}`:""}
</div>

<div class="signal-row">

<span class="signal">
Market ${v.base.toLocaleString()}
</span>

<span class="${v.agePct<0?"signal bad":"signal good"}">
Age ${signPct(v.agePct)}
</span>

<span class="signal good">
League ${signPct(v.leaguePct)}
</span>

<span class="${totalClass}">
Net ${signPct(v.totalPct)}
</span>

${v.tradeCount?`
<span class="signal">
${v.tradeCount} local trade${v.tradeCount===1?"":"s"}
</span>
`:""}

</div>
</div>

<div class="pv-values">

<div class="lv-value">
${v.adjusted.toLocaleString()}
</div>

<div class="market-value">
Base ${v.base.toLocaleString()}
</div>

<div class="confidence">
${esc(v.confidence)}
</div>

</div>
</div>`;
}

function playerRow(id,players,slot,valuation){
const p=players[id];

return `
<div class="player">

${slot?`
<span class="slot">
${esc(cleanSlot(slot))}
</span>`:""}

<span class="pos">
${esc(position(p))}
</span>

<span class="player-name">
${esc(playerName(p,id))}
</span>

${valuation?`
<span class="roster-value">
LV ${valuation.adjusted.toLocaleString()}
</span>
`:`
<span class="nfl-team">
${esc(p?.team||"FA")}
</span>
`}

</div>`;
}

async function fetchLeagueTrades(leagueId){
const all=[];

const weeks=Array.from(
{length:18},
(_,i)=>i+1
);

const batches=[];

for(let i=0;i<weeks.length;i+=6){
batches.push(
weeks.slice(i,i+6)
);
}

for(const batch of batches){

const results=await Promise.all(
batch.map(async week=>{
try{
return await get(
`${API}/league/${leagueId}/transactions/${week}`
);
}catch{
return [];
}
})
);

for(const txs of results){

for(const tx of txs||[]){

if(
tx?.type==="trade" &&
tx?.status==="complete"
){
all.push(tx);
}

}

}

}

return all;
}

function buildTradeCounts(trades){
const counts={};

for(const tx of trades){

const ids=new Set();

for(const pid of Object.keys(tx.adds||{})){
ids.add(pid);
}

for(const pid of Object.keys(tx.drops||{})){
ids.add(pid);
}

for(const pid of ids){
counts[pid]=(counts[pid]||0)+1;
}

}

return counts;
}

$("go").onclick=async()=>{

const id=lid(
$("leagueId").value
);

if(!id){

$("status").className="status error";

$("status").textContent=
"Enter a valid Sleeper league ID.";

return;
}

$("go").disabled=true;

$("status").className="status";

$("status").textContent=
"Building League Vector model…";

$("results").style.display="none";

try{

const [
league,
users,
rosters,
players,
dynastyCSV,
trades
]=await Promise.all([

get(`${API}/league/${id}`),

get(`${API}/league/${id}/users`),

get(`${API}/league/${id}/rosters`),

get(`${API}/players/nfl`),

getText(DYNASTY_DATA_URL),

fetchLeagueTrades(id)

]);
  const projectionRows=
await window.LeagueVectorEngine
  .fetchSeasonProjections(
    Number(league.season)||2026
  )
  .catch(()=>[]);

const userMap=Object.fromEntries(
users.map(
x=>[x.user_id,x]
)
);

const marketRows=parseCSV(
dynastyCSV
);

const marketMap=buildMarketMap(
marketRows
);

const tradeCounts=buildTradeCounts(
trades
);

const rosterPositions=
league.roster_positions||[];

const starterSlots=
rosterPositions.filter(
x=>x!=="BN"
);

const slotCounts=countSlots(
rosterPositions
);

const context=calcValueContext(
league,
slotCounts
);

$("name").textContent=
league.name||"Sleeper League";

$("count").textContent=
rosters.length;

$("season").textContent=
league.season||"—";

$("leagueStarters").textContent=
starterSlots.length*rosters.length;

$("lineupChips").innerHTML=
Object.entries(slotCounts)
.map(([slot,n])=>`
<span class="chip ${
slot.includes("FLEX")?"hot":""
}">
${n}× ${esc(cleanSlot(slot))}
</span>
`)
.join("");

const sf=starterSlots.some(
x=>x==="SUPER_FLEX"
);

const idp=starterSlots.some(
x=>[
"DL","DE","DT",
"LB","DB","CB","S",
"IDP_FLEX"
].includes(x)
);

$("lineupNote").textContent=
`${sf?"Superflex • ":""}${idp?"IDP • ":""}${starterSlots.length} starters per team across ${rosters.length} teams.`;

const profile=scoringProfile(
league.scoring_settings||{}
);

$("scoringChips").innerHTML=
profile.chips
.map(
x=>`<span class="chip hot">${esc(x)}</span>`)
.join("");

$("scoringNote").textContent=
`${profile.idpKeys.length} defensive scoring categories detected • ${
Object.keys(league.scoring_settings||{}).length
} total scoring settings imported`;

$("valueGrid").innerHTML=
["QB","RB","WR","TE","DL","LB","DB"]
.map(pos=>valueCard(pos,context[pos]))
.join("");

$("valueExplanation").textContent=
valueExplanation(context);

const rosteredIds=[
...new Set(
rosters.flatMap(
r=>r.players||[]
)
)
];

const valuations=
rosteredIds
.map(pid=>
playerValuation(
pid,
players,
marketMap,
context,
tradeCounts
)
)
.filter(Boolean)
.sort(
(a,b)=>b.adjusted-a.adjusted
);

const valuationMap=
Object.fromEntries(
valuations.map(
v=>[v.id,v]
)
);

const latestDate=
valuations
.map(v=>v.date)
.filter(Boolean)
.sort()
.at(-1)||"";

const tradedPlayers=
Object.keys(tradeCounts).length;

$("playerValueStatus").textContent=
`${valuations.length} rostered offensive players matched • ${
trades.length
} completed league trades scanned • ${
tradedPlayers
} players appeared in trades${
latestDate
? ` • Market snapshot ${latestDate}`
: ""
}.`;

$("playerValues").innerHTML=
valuations.length
? valuations
.slice(0,40)
.map(
(v,i)=>playerCard(v,i+1)
)
.join("")
: `
<div class="dna-note">
No offensive market-value matches were found.
</div>
`;

$("teams").innerHTML=
rosters
.sort(
(a,b)=>a.roster_id-b.roster_id
)
.map(roster=>{

const owner=
userMap[
roster.owner_id
];

const teamName=
owner?.metadata?.team_name||
owner?.display_name||
`Roster ${roster.roster_id}`;

const starters=
(roster.starters||[])
.filter(
x=>x&&x!=="0"
);

const allPlayers=
roster.players||[];

const starterSet=
new Set(starters);

const bench=
allPlayers.filter(
x=>!starterSet.has(x)
);

const idpCount=
allPlayers.filter(pid=>
[
"DL","DE","DT",
"LB","ILB","OLB",
"DB","CB","S"
].includes(
position(players[pid])
)
).length;

const starterHTML=
starters
.map(
(pid,i)=>
playerRow(
pid,
players,
starterSlots[i],
valuationMap[pid]
)
)
.join("");

const benchPreview=
bench
.slice(0,8)
.map(
pid=>
playerRow(
pid,
players,
null,
valuationMap[pid]
)
)
.join("");

const extraBench=
Math.max(
0,
bench.length-8
);

return `
<div class="team">

<h3>
${esc(teamName)}
</h3>

<div class="owner">
${esc(
owner?.display_name||
"Unknown owner"
)}
• Roster ${roster.roster_id}
</div>

<div class="team-stats">

<span class="pill">
${allPlayers.length} players
</span>

<span class="pill">
${starters.length} starters
</span>

<span class="pill">
${bench.length} bench
</span>

<span class="pill">
${idpCount} IDP
</span>

<span class="pill">
${(roster.taxi||[]).length} taxi
</span>

<span class="pill">
${(roster.reserve||[]).length} IR
</span>

</div>

<div class="label">
Starting Lineup — Slot Aware
</div>

${
starterHTML||
`
<div class="more">
No starters currently set.
</div>
`
}

<div class="label">
Bench Preview
</div>

${
benchPreview||
`
<div class="more">
No bench players.
</div>
`
}

${
extraBench
? `
<div class="more">
+ ${extraBench} more bench players
</div>
`
: ""
}

</div>
`;

})
.join("");

$("results").style.display=
"block";

$("status").className=
"status success";

$("status").textContent=
"✓ League Vector v0.6 model calculated.";

}catch(e){

console.error(e);

$("status").className=
"status error";

$("status").textContent=
"Could not analyze league: "+
e.message;

}finally{

$("go").disabled=
false;

}

};

$("leagueId")
.addEventListener(
"keydown",
e=>{

if(e.key==="Enter"){
$("go").click();
}

}
);
