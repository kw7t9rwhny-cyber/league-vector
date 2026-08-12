(function(){
"use strict";

const API="https://api.sleeper.app";

function num(v){
  const n=Number(v);
  return Number.isFinite(n)?n:0;
}

function clamp(v,min,max){
  return Math.min(max,Math.max(min,v));
}

function posOf(player){
  return player?.fantasy_positions?.[0]||player?.position||"?";
}

function starterDemandByPosition(league){
  const slots=league?.roster_positions||[];
  const teams=num(league?.total_rosters)||12;
  const counts={QB:0,RB:0,WR:0,TE:0};

  for(const slot of slots){
    if(slot==="QB")counts.QB++;
    if(slot==="RB")counts.RB++;
    if(slot==="WR")counts.WR++;
    if(slot==="TE")counts.TE++;

    if(slot==="SUPER_FLEX"){
      counts.QB+=0.85;
    }

    if([
      "FLEX",
      "REC_FLEX",
      "WRRB_FLEX"
    ].includes(slot)){
      counts.RB+=0.34;
      counts.WR+=0.50;
      counts.TE+=0.16;
    }
  }

  return Object.fromEntries(
    Object.entries(counts).map(
      ([p,c])=>[
        p,
        Math.max(
          1,
          Math.round(c*teams)
        )
      ]
    )
  );
}

async function fetchWeekProjection(
  season,
  week
){
  const qs=
    new URLSearchParams({
      season_type:"regular"
    });

  [
    "QB",
    "RB",
    "WR",
    "TE",
    "FLEX"
  ].forEach(
    p=>
      qs.append(
        "position[]",
        p
      )
  );

  const url=
    `${API}/projections/nfl/${season}/${week}?${qs.toString()}`;

  const r=
    await fetch(url);

  if(!r.ok){
    throw new Error(
      `Sleeper projections ${r.status}`
    );
  }

  return r.json();
}

async function fetchSeasonProjections(
  season
){
  const weeks=
    Array.from(
      {length:18},
      (_,i)=>i+1
    );

  const out=[];

  for(
    let i=0;
    i<weeks.length;
    i+=6
  ){
    const batch=
      weeks.slice(i,i+6);

    const rows=
      await Promise.all(
        batch.map(
          async w=>{
            try{
              return await fetchWeekProjection(
                season,
                w
              );
            }catch{
              return [];
            }
          }
        )
      );

    rows.forEach(
      x=>
        out.push(
          ...(x||[])
        )
    );
  }

  return out;
}

function aggregateSeasonProjections(
  rows
){
  const map={};

  for(const row of rows||[]){
    const id=
      String(
        row?.player_id||""
      );

    if(!id)continue;

    if(!map[id]){
      map[id]={
        player_id:id,
        stats:{},
        weeks:0
      };
    }

    map[id].weeks++;

    for(
      const [k,v]
      of Object.entries(
        row?.stats||{}
      )
    ){
      if(
        typeof v==="number" &&
        Number.isFinite(v)
      ){
        map[id].stats[k]=
          (map[id].stats[k]||0)+v;
      }
    }
  }

  return map;
}

function scoreStatLine(
  stats,
  scoring,
  position
){
  let pts=0;

  const used=[];
  const ignored=[];

  for(
    const [key,rateRaw]
    of Object.entries(
      scoring||{}
    )
  ){
    const rate=
      num(rateRaw);

    if(!rate)continue;

    if(
      key==="bonus_rec_te"
    ){
      if(
        position==="TE" &&
        stats.rec!=null
      ){
        pts+=
          num(stats.rec)*rate;

        used.push(key);
      }

      continue;
    }

    if(
      key==="bonus_rec_rb"
    ){
      if(
        position==="RB" &&
        stats.rec!=null
      ){
        pts+=
          num(stats.rec)*rate;

        used.push(key);
      }

      continue;
    }

    if(
      key==="bonus_rec_wr"
    ){
      if(
        position==="WR" &&
        stats.rec!=null
      ){
        pts+=
          num(stats.rec)*rate;

        used.push(key);
      }

      continue;
    }

    if(
      Object.prototype
        .hasOwnProperty.call(
          stats,
          key
        )
    ){
      pts+=
        num(stats[key])*rate;

      used.push(key);
    }else{
      ignored.push(key);
    }
  }

  return {
    points:pts,
    used:[
      ...new Set(used)
    ],
    ignored:[
      ...new Set(ignored)
    ]
  };
}

function buildProjectionScores(
  players,
  projectionMap,
  league
){
  const scoring=
    league?.scoring_settings||{};

  const rows=[];

  for(
    const [id,p]
    of Object.entries(
      players||{}
    )
  ){
    const pos=
      posOf(p);

    if(
      ![
        "QB",
        "RB",
        "WR",
        "TE"
      ].includes(pos)
    ){
      continue;
    }

    const proj=
      projectionMap[id];

    if(!proj)continue;

    const scored=
      scoreStatLine(
        proj.stats,
        scoring,
        pos
      );

    rows.push({
      id,
      pos,
      points:scored.points,
      stats:proj.stats,
      usedScoringKeys:
        scored.used,
      ignoredScoringKeys:
        scored.ignored
    });
  }

  return rows;
}

function replacementLevels(
  projectionScores,
  league
){
  const demand=
    starterDemandByPosition(
      league
    );

  const out={};

  for(
    const pos
    of [
      "QB",
      "RB",
      "WR",
      "TE"
    ]
  ){
    const vals=
      projectionScores
        .filter(
          x=>
            x.pos===pos
        )
        .map(
          x=>x.points
        )
        .sort(
          (a,b)=>b-a
        );

    if(!vals.length){
      out[pos]=0;
      continue;
    }

    const idx=
      clamp(
        (demand[pos]||1)-1,
        0,
        vals.length-1
      );

    out[pos]=
      vals[idx]||0;
  }

  return {
    levels:out,
    demand
  };
}

function vorpForPlayer(
  projectionScore,
  replacement
){
  return (
    projectionScore.points-
    num(
      replacement
        ?.levels
        ?.[projectionScore.pos]
    )
  );
}

function projectionValueDelta(
  vorp,
  points,
  pos
){
  if(
    !Number.isFinite(vorp) ||
    !Number.isFinite(points) ||
    points<=0
  ){
    return 0;
  }

  const ratio=
    vorp/
    Math.max(
      1,
      points
    );

  const cap=
    pos==="TE"
      ? .26
      : pos==="QB"
      ? .18
      : .16;

  return clamp(
    ratio*.55,
    -.10,
    cap
  );
}

function rookieFloorFromEcr(
  ecr,
  pos
){
  if(
    !Number.isFinite(ecr) ||
    ecr<=0
  ){
    return 0;
  }

  const posBump={
    QB:1.08,
    RB:1.00,
    WR:1.02,
    TE:.92
  }[pos]||1;

  return Math.round(
    9000*
    Math.exp(
      -.034*(ecr-1)
    )*
    posBump
  );
}

function rookieDraftCapitalFloor(
  player,
  pos
){
  const yearsExp=
    num(
      player?.years_exp
    );

  if(yearsExp>0){
    return 0;
  }

  const round=
    num(
      player?.draft_round
    );

  const pick=
    num(
      player?.draft_pick
    );

  if(!round){
    return 0;
  }

  let base={
    1:5200,
    2:3600,
    3:2400,
    4:1500,
    5:900,
    6:600,
    7:400
  }[round]||0;

  if(
    round===1 &&
    pick
  ){
    base+=
      Math.max(
        0,
        1800-
        (pick-1)*55
      );
  }

  if(pos==="QB"){
    base*=1.10;
  }

  if(pos==="TE"){
    base*=.95;
  }

  return Math.round(base);
}

function applyRookieFloor(
  baseValue,
  player,
  marketRow
){
  const pos=
    posOf(player);

  const yearsExp=
    num(
      player?.years_exp
    );

  if(yearsExp>0){
    return {
      value:baseValue,
      floor:0,
      applied:false
    };
  }

  const ecrFloor=
    rookieFloorFromEcr(
      num(
        marketRow?.ecr
      ),
      pos
    );

  const draftFloor=
    rookieDraftCapitalFloor(
      player,
      pos
    );

  const floor=
    Math.max(
      ecrFloor,
      draftFloor
    );

  return {
    value:
      Math.max(
        baseValue,
        floor
      ),

    floor,

    applied:
      floor>baseValue
  };
}

function compactAgeDelta(
  pos,
  age
){
  if(
    !Number.isFinite(age)
  ){
    return 0;
  }

  if(pos==="QB"){
    if(age<25)return .06;
    if(age<29)return .03;
    if(age<32)return 0;
    if(age<35)return -.05;
    return -.10;
  }

  if(pos==="RB"){
    if(age<24)return .05;
    if(age<27)return .01;
    if(age<29)return -.06;
    return -.13;
  }

  if(pos==="WR"){
    if(age<24)return .05;
    if(age<28)return .02;
    if(age<31)return -.03;
    return -.09;
  }

  if(pos==="TE"){
    if(age<25)return .04;
    if(age<29)return .02;
    if(age<32)return -.03;
    return -.08;
  }

  return 0;
}

window.LeagueVectorEngine={
  fetchSeasonProjections,
  aggregateSeasonProjections,
  scoreStatLine,
  buildProjectionScores,
  replacementLevels,
  vorpForPlayer,
  projectionValueDelta,
  applyRookieFloor,
  compactAgeDelta,
  starterDemandByPosition
};

})();
