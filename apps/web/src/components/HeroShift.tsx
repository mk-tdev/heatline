import { useEffect, useState } from 'react';
/** An illustrative motion panorama, not a live feed or model output. */
export function HeroShift() {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 700px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 700px)');
    const update = () => setNarrow(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return <div className="hero-vignette" aria-label="Animated illustration: a crane lifts materials, a truck arrives, and workers move into shade">
    <svg viewBox={narrow ? "630 100 810 710" : "0 0 1440 820"} preserveAspectRatio="xMidYMax meet" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="site-ground" x1="100" y1="180" x2="350" y2="370" gradientUnits="userSpaceOnUse"><stop stopColor="#bcd4cf"/><stop offset="1" stopColor="#648e91"/></linearGradient>
        <linearGradient id="site-building" x1="130" y1="100" x2="280" y2="270" gradientUnits="userSpaceOnUse"><stop stopColor="#e2e9da"/><stop offset="1" stopColor="#77989a"/></linearGradient>
      </defs>
      <defs>
        <linearGradient id="panorama-sky" x2="0" y2="1"><stop stopColor="#153e50"/><stop offset="1" stopColor="#638f95"/></linearGradient>
        <linearGradient id="panorama-sea" x2="0" y2="1"><stop stopColor="#558b95"/><stop offset="1" stopColor="#215365"/></linearGradient>
        <linearGradient id="panorama-land" x2="0" y2="1"><stop stopColor="#78928c"/><stop offset="1" stopColor="#355966"/></linearGradient>
        <radialGradient id="panorama-sun"><stop stopColor="#ffe6ae" stopOpacity=".35"/><stop offset="1" stopColor="#ffe6ae" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="1190" cy="130" r="250" fill="url(#panorama-sun)"/>
      <circle cx="1190" cy="130" r="42" fill="#f6d397" opacity=".8"/>
      <g fill="#92b4b3" opacity=".23">
        {[60,130,220,290,365,445,525,615,700].map((x,i)=><path key={x} d={`M${x} 440v-${45+(i%3)*28}h48v${45+(i%3)*28}Z`}/>)}
        <path d="M540 440V300l20-25 20 25v140ZM575 440V340h30v100Z"/>
      </g>
      <path d="M0 435Q370 409 740 437T1440 415V820H0Z" fill="url(#panorama-sea)"/>
      <g className="panorama-water" stroke="#c1e5df" strokeOpacity=".25" strokeWidth="2"><path d="M0 478h140m40 0h75m210-20h140M15 512h90m70 0h140m30 0h90m-140 30h95m-355 0h120"/></g>
      <g className="panorama-boat"><path d="m80 480 48 0-9 10H89Z" fill="#deece2"/><path d="M100 479v-13h18v13" fill="#c7ded8"/><path d="M42 492h50" stroke="#c5e7df" opacity=".4"/></g>
      <g className="panorama-birds" stroke="#cfdfd9" strokeWidth="2"><path d="m650 190 8-4 8 4m18-16 8-4 8 4m8 20 8-4 8 4"/></g>
      <path d="M0 640 520 506 900 460 1440 525V820H0Z" fill="url(#panorama-land)"/>
      <path d="m-40 729 450-100 1030 91v84L410 699-40 800Z" fill="#183f50"/>
      <path d="m-40 764 450-100 1030 91" stroke="#bdc9b3" strokeWidth="2" strokeDasharray="18 22"/>
      {/* The access street meets the boulevard at the foot of the site ramp. */}
      <path d="M1510 477 1314 606 1088 724" stroke="#244854" strokeWidth="21"/>
      <path d="M1510 477 1314 606 1088 724" stroke="#b4beb1" strokeWidth="1.8" strokeDasharray="10 14"/>
      <g fill="#658589" stroke="#8aa4a0" strokeWidth="1.5" opacity=".85">
        {[{x:550,y:516,h:34},{x:608,y:500,h:43},{x:681,y:494,h:27},{x:1315,y:524,h:43},{x:1388,y:535,h:32}].map(({x,y,h})=>
          <g key={x} transform={`translate(${x} ${y})`}>
            <path d={`M0 0v-${h}l26-8 29 9v${h}l-29 10Z`} />
            <path d={`M0 -${h}l28 9 27-8M28 ${10}v-${h}`} />
            {[10,19].map(d=><path key={d} d={`M4 -${h-d}l20 6m9 1 17-6`} stroke="#375962"/>)}
          </g>)}
      </g>
      <g className="panorama-traffic">
        <path d="M101 731h91v7h-91z" fill="#263b41"/>
        <path d="M103 707h58v23h-58z" fill="#b5c3bd"/><path d="M103 707l6-4h52v4z" fill="#dce0d0"/>
        <path d="M165 712h15l10 10v11h-25z" fill="#d9b67b"/><path d="M169 714h9l7 8h-16z" fill="#354e57"/>
        <path d="M187 727h5v3h-5z" fill="#f3e7c5"/>
        {[112,126,178].map(x=><g key={x}><circle cx={x} cy="736" r="6" fill="#242d31"/><circle cx={x} cy="736" r="2.8" fill="#8c9896"/></g>)}
      </g>
      <g transform="translate(460 480)">
        <path d="m0 97 102 30 99-47-92-30Z" fill="#264c56" opacity=".35"/>
        <path d="M25 32v70m85-34v63m70-93v61" stroke="#b6cfc4" strokeWidth="4"/>
        <path d="m7 35 74-37 114 36-82 39Z" fill="#a9d9cd"/><path d="m7 35 106 38v9L7 44Z" fill="#68a59c"/>
        <path d="m45 81 67 23 43-20" stroke="#d7e1c6" strokeWidth="7"/>
        <path d="m54 89 0 14m79 1v14" stroke="#284d53" strokeWidth="4"/>
        <path d="M160 82h14v24h-14Z" fill="#bce3e0"/><path d="M159 79h16v5h-16Z" fill="#f0ece0"/>
      </g>
      <g transform="translate(250 585)">
        <path d="m0 22 65-25 91 25-67 26Z" fill="#dfcfaa"/><path d="m0 22 89 26v24L0 45Z" fill="#b29f80"/><path d="m89 48 67-26v25L89 72Z" fill="#93866d"/>
        {[0,1,2,3,4].map(i=><path key={i} d={`m${10+i*13} ${18-i*5} 85 27`} stroke="#746a58" strokeWidth="4"/>)}
      </g>
      {[{x:70,y:625},{x:190,y:598},{x:1350,y:630}].map(({x,y})=><g key={x} transform={`translate(${x} ${y})`}><path d="M0 0q9-42 3-78" stroke="#9b9c7e" strokeWidth="7"/><g className="panorama-palm"><path d="M3-78q-33-37-50 1 28-15 50-1Q38-111 49-73 25-90 3-78Q2-122-17-111-3-99 3-78Z" fill="#538e82"/></g></g>)}
      <g transform="translate(750 160) scale(1.42)">
      <ellipse cx="250" cy="315" rx="180" ry="28" fill="#042f3d" opacity=".25"/>
      <path d="M35 265 235 164 455 268 255 367Z" fill="url(#site-ground)"/>
      <path d="m35 265 220 102v-12L35 253Z" fill="#547b7e"/>
      <path d="m255 355 200-99v12L255 367Z" fill="#365f69"/>
      <path d="m65 275 174 80 183-91-27-12-156 77-149-67Z" fill="#315d69"/>
      <path d="m89 278 152 66 154-76" stroke="#d1d9bb" strokeDasharray="8 10" opacity=".65"/>
      <path d="m118 235 88 41 90-45-88-41Z" fill="#234e59" opacity=".3"/>
      <path d="M123 122 208 161v111l-85-39Z" fill="url(#site-building)"/>
      <path d="m208 161 74-37v112l-74 36Z" fill="#47747a"/>
      {[0,1,2,3].map(i=><g key={i} transform={`translate(0 ${i*28})`}><path d="m123 122 85 39 74-37" stroke="#e1e9dc" strokeWidth="5"/><path d="m140 134 0 19m24-8v19m26-7v19m34-4v19m24-32v19m20-29v19" stroke="#284f5a" strokeWidth="5"/></g>)}
      <path d="m119 120 75-38 92 41-78 39Z" fill="#e8dcc0" stroke="#f8eed7" strokeWidth="2"/>
      <path d="m137 119 58-29 71 32-57 28Z" stroke="#aa9474" strokeDasharray="3 4"/>
      <g className="vignette-heat" stroke="#ffd18a" strokeWidth="2" strokeLinecap="round"><path d="M160 111c-15-15 12-17 0-34"/><path d="M195 100c-15-15 12-17 0-34"/><path d="M230 112c-15-15 12-17 0-34"/></g>
      <g stroke="#ffc367" strokeWidth="3" strokeLinejoin="round"><path d="M322 244V62h14v188M322 65l14 22-14 22 14 22-14 22 14 22-14 22 14 22-14 22"/><path d="M204 57h204V44H204Zm0 0 20-13 20 13 20-13 20 13 20-13 20 13 20-13 20 13 20-13"/><path d="m248 44 81-26 55 26M329 18v26" strokeWidth="2"/></g>
      <path d="M320 245 339 253 351 246 332 238Z" fill="#d9e0d2"/>
      <path d="M374 58h27v20h-27Z" fill="#c5d4cc"/>
      <path d="M336 59h16v15h-16Z" fill="#c1e7df" stroke="#ffc367" strokeWidth="3"/>
      <g className="vignette-lift"><path className="vignette-cable" d="M258 58v77" stroke="#dcf1e8" strokeWidth="1.5"/><g className="vignette-load"><path d="m244 137 14-7 20 9-14 8Z" fill="#eac88d"/><path d="m244 137 20 10v10l-20-10Z" fill="#ab8760"/><path d="m264 147 14-8v10l-14 8Z" fill="#d9b17b"/></g></g>
      <g className="vignette-truck">
        <path d="m51 285 62 29 18-9-62-28Z" fill="#273f45"/>
        <path d="m60 270 17-8 13 6-16 9Z" fill="#e0dfcf"/><path d="m60 270 14 7v16l-14-7Z" fill="#c1cdc6"/>
        <path d="m74 277 16-9v17l-16 8Z" fill="#899e99"/><path d="m62 273 10 5v5l-10-5Zm14 6 11-6v6l-11 5Z" fill="#304d59"/>
        <path d="m87 272 10-5q6-2 12 1l17 8q7 4 4 12l-5 6q-4 4-10 2l-26-12q-7-4-2-12Z" fill="#dad9c9" stroke="#758986" strokeWidth="1.1"/>
        <path d="m103 268 6 2q-11 8-11 18l-5-2q0-10 10-18Z" fill="#b97649"/>
        <path d="m128 285 7 2-1 5-6 3-3-2Z" fill="#8b9490"/>
        {[{x:67,y:291},{x:103,y:307},{x:114,y:312}].map(({x,y})=><g key={x}><ellipse cx={x} cy={y} rx="4" ry="5.4" fill="#26373c"/><ellipse cx={x} cy={y} rx="1.9" ry="2.5" fill="#9ba9a6"/></g>)}
      </g>
      <g><path d="m336 280 42 19 39-20-42-19Z" fill="#123e4d" opacity=".3"/><path d="M338 272v27m39-9v27m37-45v27" stroke="#c6dad0" strokeWidth="3"/><path d="m332 272 42-23 47 22-43 22Z" fill="#aadbd0" stroke="#d4f6e9" strokeWidth="2"/><path d="m332 272 46 21v7l-46-21Z" fill="#62a99f"/></g>
      {[0,1,2].map(i=><g key={i} className={`vignette-worker worker-${i}`} transform={`translate(${252+i*15} ${259+i*7})`}><ellipse cy="7" rx="6" ry="3" fill="#153e4a" opacity=".25"/><path d="M-2 2v6m5-6v6" stroke="#244b59" strokeWidth="2.5"/><path d="M0-7v9" stroke="#f6a744" strokeWidth="7"/><circle cy="-12" r="4" fill="#f2cd9e"/><path d="M-5-13q5-7 10 0" fill="#fff1c9"/></g>)}
      <path className="vignette-route" d="m272 280 48 23 29-15" stroke="#d9ffdb" strokeWidth="2" strokeDasharray="4 6"/>
      </g>
      <g className="panorama-hoist" transform="translate(932 432)"><path d="M0 0h14v22H0Z" fill="#f0b85c"/><path d="M3 3h8v15H3Z" stroke="#315462" strokeWidth="2"/></g>
      <path d="M935 365v205m9-210v209" stroke="#a5bcb4" strokeWidth="2"/>
      <g fill="#d6e6d9" fontSize="11" fontFamily="Inter, sans-serif" letterSpacing="1"><text x="490" y="644">COOLING &amp; WATER</text><text x="265" y="682">MATERIAL YARD</text></g>
      <g transform="translate(650 614)"><circle cy="-17" r="5" fill="#f7d6a4"/><path d="M0-11V3" stroke="#ffc25d" strokeWidth="9"/><path d="M-3 4v12m6-12v12" stroke="#244956" strokeWidth="3"/><path d="M-6-19q6-7 12 0" fill="#fff2d3"/></g>
    </svg>
    <div className="vignette-caption"><span className="panorama-label">A shift, in motion · Illustrated preview</span><div className="shift-phase phase-heat"><span className="phase-dot"/><div><strong>The site keeps moving.</strong><small>So does the heat.</small></div></div><div className="shift-phase phase-shade"><span className="phase-dot"/><div><strong>One decision changes the shift.</strong><small>Move the crew. Make room for recovery.</small></div></div></div>
    <div className="vignette-progress"><span /></div>
  </div>;
}
