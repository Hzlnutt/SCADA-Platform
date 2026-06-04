import React from "react";

/**
 * ChemicalDosingTank
 * ──────────────────────────────────────────────────────────
 * Props:
 *   x        {number}  Posisi kiri tank (default: 50)
 *   y        {number}  Posisi atas tank (default: 20)
 *   width    {number}  Lebar tank (default: 160)
 *   height   {number}  Tinggi badan tank (default: 280)
 *   id       {string}  ID unik untuk gradient (default: "tank1")
 *                      → Wajib diisi berbeda jika render lebih dari 1 tank
 *
 * SVG Container:
 *   Gunakan viewBox yang cukup besar untuk menampung tank.
 *   Contoh: <svg viewBox="0 0 300 400" width="300" height="400">
 *             <ChemicalDosingTank x={50} y={20} width={160} height={280} />
 *           </svg>
 * ──────────────────────────────────────────────────────────
 */
const ChemicalDosingTank = ({
  x = 50,
  y = 20,
  width = 160,
  height = 280,
  id = "tank1",
}) => {
  const cx     = x + width / 2;          // pusat horizontal
  const rx     = width / 2;              // radius ellipse horizontal
  const ry     = Math.max(8, Math.round(rx * 0.19)); // radius ellipse vertikal
  const yTop   = y;                      // tepi atas body
  const yBot   = y + height;             // tepi bawah body

  // Cap
  const capW   = Math.max(32, width * 0.26);
  const capH   = Math.max(18, height * 0.07);
  const capX   = cx - capW / 2;
  const capY   = yTop - capH;
  const capRx  = capW / 2;
  const capRy  = Math.max(5, capRx * 0.3);

  // Shoulder bump (kiri atas seperti foto)
  const bumpCx = x + rx * 0.37;
  const bumpCy = yTop - 1;
  const bumpRx = Math.max(10, rx * 0.24);
  const bumpRy = Math.max(5,  ry * 0.54);

  // Highlight stripe positions
  const hlx1   = cx - rx * 0.15;
  const hlx2   = cx - rx * 0.20;
  const shx    = cx + rx * 0.16;

  // gradient ids (unik per instance)
  const gBody   = `${id}_body`;
  const gTop    = `${id}_top`;
  const gCap    = `${id}_cap`;
  const gCapTop = `${id}_capTop`;
  const gBump   = `${id}_bump`;
  const gBot    = `${id}_bot`;

  return (
    <g>
      <defs>
        {/* Body gradient (kiri-kanan) */}
        <linearGradient id={gBody} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#252525" />
          <stop offset="18%"  stopColor="#424242" />
          <stop offset="45%"  stopColor="#575757" />
          <stop offset="55%"  stopColor="#636363" />
          <stop offset="82%"  stopColor="#353535" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </linearGradient>

        {/* Top ellipse gradient */}
        <linearGradient id={gTop} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#1e1e1e" />
          <stop offset="20%"  stopColor="#3e3e3e" />
          <stop offset="50%"  stopColor="#525252" />
          <stop offset="80%"  stopColor="#303030" />
          <stop offset="100%" stopColor="#161616" />
        </linearGradient>

        {/* Cap neck gradient */}
        <linearGradient id={gCap} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#0c0c0c" />
          <stop offset="30%"  stopColor="#222" />
          <stop offset="50%"  stopColor="#2c2c2c" />
          <stop offset="70%"  stopColor="#1a1a1a" />
          <stop offset="100%" stopColor="#070707" />
        </linearGradient>

        {/* Cap top ellipse gradient */}
        <linearGradient id={gCapTop} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#0f0f0f" />
          <stop offset="40%"  stopColor="#282828" />
          <stop offset="60%"  stopColor="#2e2e2e" />
          <stop offset="100%" stopColor="#0c0c0c" />
        </linearGradient>

        {/* Shoulder bump gradient */}
        <linearGradient id={gBump} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#4a4a4a" />
          <stop offset="100%" stopColor="#343434" />
        </linearGradient>

        {/* Bottom gradient */}
        <linearGradient id={gBot} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#383838" />
          <stop offset="100%" stopColor="#202020" />
        </linearGradient>
      </defs>

      {/* ── Body ── */}
      <rect
        x={x}
        y={yTop}
        width={width}
        height={height}
        fill={`url(#${gBody})`}
      />

      {/* ── Top ellipse ── */}
      <ellipse cx={cx} cy={yTop}     rx={rx}           ry={ry}           fill={`url(#${gTop})`} />
      <ellipse cx={cx} cy={yTop - 2} rx={rx * 0.83}    ry={ry * 0.58}    fill="#686868" opacity="0.22" />

      {/* ── Bottom ellipse ── */}
      <ellipse cx={cx} cy={yBot}     rx={rx}           ry={ry}           fill={`url(#${gBot})`} />
      <ellipse cx={cx} cy={yBot - 2} rx={rx * 0.83}    ry={ry * 0.58}    fill="#262626" opacity="0.5" />

      {/* ── Outline strokes ── */}
      <rect
        x={x} y={yTop} width={width} height={height}
        fill="none" stroke="#505050" strokeWidth="0.8" opacity="0.6"
      />
      <ellipse cx={cx} cy={yTop} rx={rx} ry={ry}
        fill="none" stroke="#5a5a5a" strokeWidth="0.8" opacity="0.6"
      />
      <ellipse cx={cx} cy={yBot} rx={rx} ry={ry}
        fill="none" stroke="#3a3a3a" strokeWidth="0.8" opacity="0.5"
      />

      {/* ── Highlight stripe (3D cylinder effect) ── */}
      <line x1={hlx1} y1={yTop + 2} x2={hlx1} y2={yBot - 2}
        stroke="#808080" strokeWidth={Math.max(3, rx * 0.027)} strokeOpacity="0.17"
      />
      <line x1={hlx2} y1={yTop + 2} x2={hlx2} y2={yBot - 2}
        stroke="#aaa" strokeWidth={Math.max(1.5, rx * 0.013)} strokeOpacity="0.11"
      />

      {/* ── Right shadow stripe ── */}
      <line x1={shx} y1={yTop + 2} x2={shx} y2={yBot - 2}
        stroke="#000" strokeWidth={Math.max(5, rx * 0.045)} strokeOpacity="0.17"
      />

      {/* ── Shoulder bump (kiri atas) ── */}
      <ellipse cx={bumpCx} cy={bumpCy}     rx={bumpRx}        ry={bumpRy}
        fill={`url(#${gBump})`} stroke="#404040" strokeWidth="0.7"
      />
      <ellipse cx={bumpCx} cy={bumpCy - 2} rx={bumpRx * 0.78} ry={bumpRy * 0.66}
        fill="#585858" opacity="0.45"
      />

      {/* ── Cap neck ── */}
      <rect
        x={capX} y={capY} width={capW} height={capH}
        rx={Math.max(4, capW * 0.1)}
        fill={`url(#${gCap})`}
      />
      {/* Threading lines on cap */}
      {[0.28, 0.50, 0.72].map((t, i) => (
        <line
          key={i}
          x1={capX} x2={capX + capW}
          y1={capY + capH * t} y2={capY + capH * t}
          stroke="#404040" strokeWidth="0.8" opacity="0.6"
        />
      ))}

      {/* ── Cap top ellipse ── */}
      <ellipse cx={cx} cy={capY}     rx={capRx}        ry={capRy}        fill={`url(#${gCapTop})`} />
      <ellipse cx={cx} cy={capY - 1} rx={capRx * 0.72} ry={capRy * 0.55} fill="#262626" opacity="0.65" />
    </g>
  );
};

export default ChemicalDosingTank;

/* ════════════════════════════════════════════════════════════
   CONTOH PENGGUNAAN
   ════════════════════════════════════════════════════════════

   1) SINGLE TANK
   ──────────────
   import ChemicalDosingTank from "./ChemicalDosingTank";

   export default function App() {
     return (
       <svg viewBox="0 0 300 400" width="300" height="400">
         <ChemicalDosingTank
           x={60}
           y={30}
           width={160}
           height={300}
           id="tank1"
         />
       </svg>
     );
   }

   2) MULTIPLE TANKS (id HARUS berbeda)
   ──────────────────────────────────────
   <svg viewBox="0 0 700 400" width="700" height="400">
     <ChemicalDosingTank x={20}  y={30} width={140} height={280} id="tankA" />
     <ChemicalDosingTank x={200} y={30} width={180} height={320} id="tankB" />
     <ChemicalDosingTank x={430} y={50} width={120} height={240} id="tankC" />
   </svg>

   3) DENGAN STATE (ukuran dinamis)
   ─────────────────────────────────
   const [w, setW] = useState(160);
   const [h, setH] = useState(280);

   return (
     <>
       <input type="range" min={80} max={300} value={w}
         onChange={e => setW(+e.target.value)} />
       <input type="range" min={100} max={500} value={h}
         onChange={e => setH(+e.target.value)} />

       <svg viewBox="0 0 400 600" width="400" height="600">
         <ChemicalDosingTank x={50} y={30} width={w} height={h} id="dynTank" />
       </svg>
     </>
   );

   ════════════════════════════════════════════════════════════ */