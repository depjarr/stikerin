import React from 'react';

export function Star({ className = '', size }) {
  return (
    <svg className={`deco-star ${className}`} viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <path
        d="M50 6 L62 36 L94 38 L69 58 L78 90 L50 72 L22 90 L31 58 L6 38 L38 36 Z"
        fill="#ffd60a"
        stroke="#fff"
        strokeWidth="7"
        strokeLinejoin="round"
        paintOrder="stroke"
      />
      <path d="M50 6 L62 36 L94 38 L69 58 L78 90 L50 72 L22 90 L31 58 L6 38 L38 36 Z" fill="none" stroke="#c49a00" strokeWidth="2" strokeLinejoin="round" />
      <path d="M40 30 L44 22" stroke="#fff6b0" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function Marquee({ items }) {
  const row = [...items, ...items];
  return (
    <div className="marquee" role="presentation">
      <div className="marquee-track">
        {row.map((t, i) => (
          <span key={i}>
            {t} <em>✦</em>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Lace() {
  return <div className="lace" aria-hidden="true" />;
}

export function Tape({ className = '' }) {
  return <span className={`tape ${className}`} aria-hidden="true" />;
}

/* ---------- stiker hiasan di pinggir loker ---------- */
function Button({ className, fill }) {
  return (
    <svg className={`doodle ${className}`} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="42" fill={fill} stroke="#fff" strokeWidth="6" paintOrder="stroke" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="3" />
      {[[40, 40], [60, 40], [40, 60], [60, 60]].map(([x, y]) => (
        <circle key={x + '-' + y} cx={x} cy={y} r="5.5" fill="rgba(0,0,0,.28)" />
      ))}
    </svg>
  );
}
const OUT = { stroke: '#fff', strokeWidth: 5, paintOrder: 'stroke', strokeLinejoin: 'round' };

function Face({ cx, cy, r }) {
  return (
    <g fill="none" stroke="#3b2a12" strokeWidth={r * 0.12} strokeLinecap="round">
      <circle cx={cx - r * 0.33} cy={cy - r * 0.15} r={r * 0.05} fill="#3b2a12" />
      <circle cx={cx + r * 0.33} cy={cy - r * 0.15} r={r * 0.05} fill="#3b2a12" />
      <path d={`M${cx - r * 0.4} ${cy + r * 0.15} Q${cx} ${cy + r * 0.6} ${cx + r * 0.4} ${cy + r * 0.15}`} />
    </g>
  );
}

function Pill({ className, text, bg, fg, w = 120, font = 'Titan One' }) {
  return (
    <svg className={`doodle ${className}`} viewBox={`0 0 ${w} 50`}>
      <rect x="4" y="4" width={w - 8} height="42" rx="21" fill={bg} {...OUT} />
      <text x={w / 2} y="33" textAnchor="middle" fontFamily={font} fontSize="22" fill={fg}>{text}</text>
    </svg>
  );
}

export function DeskDoodles() {
  return (
    <div className="doodles" aria-hidden="true">
      {/* matahari senyum */}
      <svg className="doodle d-smile" viewBox="0 0 100 100">
        {Array.from({ length: 10 }).map((_, i) => (
          <ellipse key={i} cx="50" cy="16" rx="9" ry="14" fill="#ffd84a" {...OUT} transform={`rotate(${i * 36} 50 50)`} />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <ellipse key={'b' + i} cx="50" cy="16" rx="9" ry="14" fill="#ffd84a" transform={`rotate(${i * 36} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="24" fill="#ffe873" />
        <Face cx={50} cy={50} r={24} />
      </svg>
      <Button className="d-btn1" fill="#4a9be0" />
      <Button className="d-btn3" fill="#ff7fb6" />
      <Pill className="d-omg" text="OMG" bg="#6b4bd8" fg="#ff9fd2" w={130} />
      <svg className="doodle d-cool" viewBox="0 0 120 56">
        <text x="60" y="42" textAnchor="middle" fontFamily="Titan One" fontSize="38" fill="#6f7cf7" {...OUT} strokeWidth="9">COOL</text>
        <text x="60" y="42" textAnchor="middle" fontFamily="Titan One" fontSize="38" fill="#7b8cff">COOL</text>
      </svg>
      <svg className="doodle d-star" viewBox="0 0 100 100">
        <path d="M50 6 L62 36 L94 38 L69 58 L78 90 L50 72 L22 90 L31 58 L6 38 L38 36 Z" fill="#ff8a3d" {...OUT} strokeWidth="8" />
        <path d="M50 22 L57 40 L76 41 L61 53 L66 72 L50 61 L34 72 L39 53 L24 41 L43 40 Z" fill="#ffd84a" />
      </svg>
      <Pill className="d-good" text="GOOD VIBE" bg="#ff7fb6" fg="#fff" w={170} />
      {/* bunga senyum */}
      <svg className="doodle d-flower" viewBox="0 0 100 100">
        {Array.from({ length: 8 }).map((_, i) => (
          <circle key={i} cx="50" cy="20" r="17" fill="#ff8fc6" {...OUT} transform={`rotate(${i * 45} 50 50)`} />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <circle key={'b' + i} cx="50" cy="20" r="17" fill="#ff8fc6" transform={`rotate(${i * 45} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="22" fill="#ffd84a" />
        <circle cx="38" cy="56" r="4" fill="#ff7fb6" opacity=".7" />
        <circle cx="62" cy="56" r="4" fill="#ff7fb6" opacity=".7" />
        <Face cx={50} cy={50} r={22} />
      </svg>
      {/* segitiga no bad vibes */}
      <svg className="doodle d-nobad" viewBox="0 0 100 92">
        <path d="M50 6 L94 86 H6 Z" fill="#ff5fa2" {...OUT} strokeWidth="8" />
        <text x="50" y="52" textAnchor="middle" fontFamily="Titan One" fontSize="13" fill="#fff">NO</text>
        <text x="50" y="66" textAnchor="middle" fontFamily="Titan One" fontSize="13" fill="#fff">BAD</text>
        <text x="50" y="80" textAnchor="middle" fontFamily="Titan One" fontSize="13" fill="#fff">VIBES</text>
      </svg>
      {/* hati pixel */}
      <svg className="doodle d-heart" viewBox="0 0 9 8" shapeRendering="crispEdges">
        <path d="M1 0h2v1h1v1h1V1h1V0h2v1h1v3H8v1H7v1H6v1H5v1H4V7H3V6H2V5H1V4H0V1h1z" fill="#ff5f8f" stroke="#fff" strokeWidth=".5" paintOrder="stroke" />
        <path d="M2 1h1v1H2zM1 2h1v1H1z" fill="#ffc2d6" />
      </svg>
      <svg className="doodle d-stars2" viewBox="0 0 100 100">
        <path d="M60 10 L68 32 L92 33 L73 47 L80 70 L60 57 L40 70 L47 47 L28 33 L52 32 Z" fill="#c9a7ff" {...OUT} strokeWidth="6" />
        <path d="M26 56 L31 69 L45 70 L34 78 L38 92 L26 84 L14 92 L18 78 L7 70 L21 69 Z" fill="#ff8fc6" {...OUT} strokeWidth="6" />
      </svg>
      <Button className="d-btn2" fill="#ff9a3d" />
      {/* kelinci */}
      <svg className="doodle d-bunny" viewBox="0 0 100 100">
        <g fill="#c99a76" {...OUT} strokeWidth="6">
          <ellipse cx="34" cy="26" rx="10" ry="22" />
          <ellipse cx="66" cy="26" rx="10" ry="22" />
          <ellipse cx="50" cy="62" rx="36" ry="30" />
        </g>
        <ellipse cx="34" cy="26" rx="10" ry="22" fill="#c99a76" />
        <ellipse cx="66" cy="26" rx="10" ry="22" fill="#c99a76" />
        <ellipse cx="34" cy="28" rx="4.5" ry="14" fill="#f5b8c8" />
        <ellipse cx="66" cy="28" rx="4.5" ry="14" fill="#f5b8c8" />
        <ellipse cx="50" cy="62" rx="36" ry="30" fill="#c99a76" />
        <ellipse cx="50" cy="70" rx="14" ry="10" fill="#f3dcc6" />
        <circle cx="38" cy="58" r="3.5" fill="#3b2a12" />
        <circle cx="62" cy="58" r="3.5" fill="#3b2a12" />
        <path d="M47 66 Q50 69 53 66" stroke="#3b2a12" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
      {/* huruf HOME */}
      <svg className="doodle d-home" viewBox="0 0 220 60">
        {[['H', '#ffd1e3', 0, 'rect'], ['O', '#fff', 1, 'circle'], ['M', '#cfe7ff', 2, 'rect'], ['E', '#ff7fb6', 3, 'star']].map(([ch, bg, i, shape]) => {
          const cx = 28 + i * 54, cy = 30;
          return (
            <g key={ch} transform={`rotate(${[-6, 4, -3, 8][i]} ${cx} ${cy})`}>
              {shape === 'rect' && <rect x={cx - 22} y={cy - 22} width="44" height="44" rx="4" fill={bg} {...OUT} />}
              {shape === 'circle' && <circle cx={cx} cy={cy} r="23" fill={bg} stroke="#fde98f" strokeWidth="5" />}
              {shape === 'star' && <path transform={`translate(${cx - 26} ${cy - 26}) scale(.52)`} d="M50 6 L62 36 L94 38 L69 58 L78 90 L50 72 L22 90 L31 58 L6 38 L38 36 Z" fill={bg} {...OUT} strokeWidth="9" />}
              <text x={cx} y={cy + 9} textAnchor="middle" fontFamily="Fredoka" fontWeight="700" fontSize="26" fill={['#e0457f', '#4a9be0', '#7c5cd8', '#fff'][i]}>{ch}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
