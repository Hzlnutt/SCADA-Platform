// {/* PIPE DARI TANK KE MOTOR 3 */}
//               <PipeH x={588} y={596} w={133} h={8} on={motorStatus["MTR-3"]} dir="left" />

//               {/* PIPE DARI TANK KE MOTOR 1 dan 2 */}
//               <PipeH 
//               x={467} y={616} w={254} h={8} 
//               on={motorStatus["MTR-1"] || motorStatus["MTR-2"]} dir="left" />

//               {/* PIPE DARI TANK KE HEADER KANAN*/}
//               <PipeH 
//               x={1003} y={616} w={153} h={8} 
//               on={motorStatus["MTR-4"] || motorStatus["MTR-5"] || motorStatus["MTR-6"] || motorStatus["MTR-7"] || motorStatus["MTR-8"] || motorStatus["MTR-9"]} />

//               {/* ── BRANCH VERTIKAL — MTR-1 (Cooling Tower 1) ─────────────── */}
//               <PipeV x={233.5} y={42} w={9} h={560} on={motorStatus["MTR-1"]} dir="up" />

//               {/* ── BRANCH HORIZONTAL — MTR-1 (Cooling Tower 1) ─────────────── */}
//               <PipeH x={254} y={20} w={144} h={9} on={motorStatus["MTR-1"]} />

//               {/* ── BRANCH VERTIKAL — MTR-2 (Cooling Tower 2) ─────────────── */}
//               <PipeV x={403.3} y={41} w={9} h={561} on={motorStatus["MTR-2"]} dir="up" />

//               {/* ── BRANCH HORIZONTAL — MTR-2 (Cooling Tower 2) ─────────────── */}
//               <PipeH 
//               x={419} y={20} 
//               w={147} h={9} 
//               on={motorStatus["MTR-1"] || motorStatus["MTR-2"]}  />

//               {/* ── BRANCH VERTIKAL — MTR-3 (Cooling Tower 3) ─────────────── */}
//               <PipeV x={572} y={41} w={9} h={545} on={motorStatus["MTR-3"]} dir="up" />

//               {/* ── BRANCH HORIZONTAL — MTR-3 (Cooling Tower 3) ─────────────── */}
//               <PipeH 
//               x={587} y={20} 
//               w={329} h={9} 
//               on={motorStatus["MTR-1"] || motorStatus["MTR-2"] || motorStatus["MTR-3"]}  />

//               {/* ── BRANCH VERTIKAL — CT KE TANK ─────────────── */}
//               <PipeV 
//               x={928} y={36} 
//               w={9} h={411} 
//               on={motorStatus["MTR-1"] || motorStatus["MTR-2"] || motorStatus["MTR-3"]}  />

//               {/* ── BRANCH VERTIKAL — MTR-4 (DU-03) ──────────────────────── */}
//               <PipeV x={1209} y={267} w={9} h={330} on={motorStatus["MTR-4"]} dir="up" />

//               {/* ── BRANCH VERTIKAL — MTR-5 (BP-03) ──────────────────────── */}
//               <PipeV x={1319} y={267} w={9} h={330} on={motorStatus["MTR-5"]} dir="up" />

//               {/* ── BRANCH VERTIKAL — MTR-6 (SP-03) ──────────────────────── */}
//               <PipeV x={1430} y={267} w={9} h={330} on={motorStatus["MTR-6"]} dir="up" />

//               {/* ── BRANCH VERTIKAL — MTR-7 (ST-03) ──────────────────────── */}
//               <PipeV x={1541} y={267} w={9} h={330} on={motorStatus["MTR-7"]} dir="up" />

//               {/* ── BRANCH VERTIKAL — MTR-8 (WASHING) ────────────────────── */}
//               <PipeV x={1651} y={267} w={9} h={330} on={motorStatus["MTR-8"]} dir="up" />

//               {/* ── BRANCH VERTIKAL — MTR-9 (MINI LAB) ───────────────────── */}
//               <PipeV x={1762} y={267} w={9} h={330} on={motorStatus["MTR-9"]} dir="up" />

//               {/* ── BRANCH HORIZONTAL — DOSING ───────────────────── */}
//               <PipeH x={969} y={426} w={62} h={9} on={motorStatus["MTR-9"]} dir="left" />

//               {/* ── BRANCH HORIZONTAL — RAW WATER ───────────────────── */}
//               <PipeH x={832} y={369} w={30} h={8} on={motorStatus["MTR-9"]} dir="left" />

//               {/* ── BRANCH VERTIKAL — RAW WATER ───────────────────── */}
//               <PipeV x={769} y={389} w={8} h={58} on={motorStatus["MTR-9"]} />

//               {/* ── BRANCH HORIZONTAL — BLOWDOWN ───────────────────── */}
//               <PipeH x={656} y={630} w={65} h={8} on={motorStatus["MTR-9"]} dir="left" />

//               {/* ── BRANCH VERTIKAL — BLOWDOWN ───────────────────── */}
//               <PipeV x={637} y={651} w={9} h={21} on={motorStatus["MTR-9"]} />

//               {/* ── BRANCH HORIZONTAL — BLOWDOWN ───────────────────── */}
//               <PipeH x={543} y={683} w={40} h={7} on={motorStatus["MTR-9"]} dir="left" />


//               {/* ── LABEL SVG ───── */}

//             <DeviceLabel x={183} y={105} w={110} h={80} name="FAN-1" on={motorStatus["FAN-1"]} />
//             <DeviceLabel x={353} y={105} w={110} h={80} name="FAN-2" on={motorStatus["FAN-2"]} />
//             <DeviceLabel x={523} y={105} w={110} h={80} name="FAN-3" on={motorStatus["FAN-3"]} />

//             <DeviceLabel x={200} y={430} w={80} h={70} name="MTR-1" on={motorStatus["MTR-1"]} />
//             <DeviceLabel x={368} y={430} w={80} h={70} name="MTR-2" on={motorStatus["MTR-2"]} />
//             <DeviceLabel x={537} y={430} w={80} h={70} name="MTR-3" on={motorStatus["MTR-3"]} />
//             <DeviceLabel x={1177} y={430} w={80} h={70} name="MTR-4" on={motorStatus["MTR-4"]} />
//             <DeviceLabel x={1287} y={430} w={80} h={70} name="MTR-5" on={motorStatus["MTR-5"]} />
//             <DeviceLabel x={1397} y={430} w={80} h={70} name="MTR-6" on={motorStatus["MTR-6"]} />
//             <DeviceLabel x={1509} y={430} w={80} h={70} name="MTR-7" on={motorStatus["MTR-7"]} />
//             <DeviceLabel x={1619} y={430} w={80} h={70} name="MTR-8" on={motorStatus["MTR-8"]} />
//             <DeviceLabel x={1729} y={430} w={80} h={70} name="MTR-9" on={motorStatus["MTR-9"]} />


//             {/* SENSOR INDICATOR SVG */}

//             {/* INDOCATOR CT */}
//             <SensorIndicator x={190} y={275} value={1.9} unit=" Bar" decimalPlaces={1}
//             warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />
//             <SensorIndicator x={360} y={275} value={0.8} unit=" Bar" decimalPlaces={1}
//             warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />
//             <SensorIndicator x={530} y={275} value={2} unit=" Bar" decimalPlaces={1}
//             warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />

//             {/* INDOCATOR MTR KANAN */}
//             <LabelComponent text="DU-03" x={1165} y={222} w={100} h={35} hasBorder={false} />
//             <SensorIndicator x={1165} y={275} value={1.9} unit=" Bar" decimalPlaces={1}
//             warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />

//             <LabelComponent text="BP-03" x={1278} y={222} w={100} h={35} hasBorder={false} />
//             <SensorIndicator x={1278} y={275} value={1.5} unit=" Bar" decimalPlaces={1}
//             warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />

//             <LabelComponent text="SP-03" x={1388} y={222} w={100} h={35} hasBorder={false} />
//             <SensorIndicator x={1388} y={275} value={1.1} unit=" Bar" decimalPlaces={1}
//             warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />

//             <LabelComponent text="ST-03" x={1500} y={222} w={100} h={35} hasBorder={false} />
//             <SensorIndicator x={1500} y={275} value={1.9} unit=" Bar" decimalPlaces={1}
//             warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />

//             <LabelComponent text="WASHING" x={1600} y={222} w={110} h={35} hasBorder={false} />
//             <SensorIndicator x={1612} y={275} value={1.5} unit=" Bar" decimalPlaces={1}
//             warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />

//             <LabelComponent text="MINI LAB" x={1710} y={222} w={120} h={35} hasBorder={false} />
//             <SensorIndicator x={1721} y={275} value={2} unit=" Bar" decimalPlaces={1}
//             warningThreshold={1.5} alarmThreshold={2} w={100} h={45} />

//             {/* INDICATOR RETURN */}
//             <SensorIndicator x={1165} y={155} value={31.2} unit=" °C" decimalPlaces={1}
//             warningThreshold={35} alarmThreshold={40} w={100} h={45} />
//             <SensorIndicator x={1278} y={155} value={36.2} unit=" °C" decimalPlaces={1}
//             warningThreshold={35} alarmThreshold={40} w={100} h={45} />
//             <SensorIndicator x={1388} y={155} value={40.1} unit=" °C" decimalPlaces={1}
//             warningThreshold={35} alarmThreshold={40} w={100} h={45} />
//             <SensorIndicator x={1500} y={155} value={28.8} unit=" °C" decimalPlaces={1}
//             warningThreshold={35} alarmThreshold={40} w={100} h={45} />
//             <SensorIndicator x={1612} y={155} value={29.4} unit=" °C" decimalPlaces={1}
//             warningThreshold={35} alarmThreshold={40} w={100} h={45} />
//             <SensorIndicator x={1721} y={155} value={32.5} unit=" °C" decimalPlaces={1}
//             warningThreshold={35} alarmThreshold={40} w={100} h={45} />

//             {/* INDICATOR DOSING */}
//             <LabelComponent text="DOSING" x={1010} y={135} w={100} h={35} hasBorder={true} />
//             <LabelComponent text="VOLUME" x={950} y={192} w={100} h={35} hasBorder={false} />
//             <LabelComponent text="LEVEL" x={958} y={245} w={85} h={35} hasBorder={false} />
//             <SensorIndicator x={1055} y={185} value={70} unit="%"
//             warningThreshold={70} alarmThreshold={60} w={100} h={45} />
//             <SensorIndicator x={1055} y={240} value={7.2} unit="" decimalPlaces={1}
//             warningThreshold={7.5} alarmThreshold={7.6} w={100} h={45} />

//             {/* FLOW RATE INDICATOR */}
//             <LabelComponent text="RAW WATER" x={760} y={280} w={120} h={40} hasBorder={false} />
//             <SensorIndicator x={785} y={385} value={20.2} unit=" m³/s" decimalPlaces={1}
//              w={100} h={45} />

//              {/* MAKE UP WATER INDICATOR */}
//              <LabelComponent text="MAKEUP WTR" x={765} y={80} w={150} h={40} hasBorder={true} />
//              <LabelComponent text="TDS" x={755} y={145} w={60} h={35} hasBorder={false} />
//             <LabelComponent text="PH" x={760} y={200} w={50} h={35} hasBorder={false} />
//              <SensorIndicator x={820} y={140} value={320} unit=" ppm"
//             warningThreshold={300} alarmThreshold={350} w={100} h={45} />
//              <SensorIndicator x={820} y={195} value={7.2} unit=" pH" decimalPlaces={1}
//             warningThreshold={7.5} alarmThreshold={7.6} w={100} h={45} />

//             {/* BLOWDOWN INDICATOR */}
//             <LabelComponent text="BLOWDOWN" x={536} y={745} w={130} h={35} hasBorder={true} />
//             <SensorIndicator x={550} y={700} value={18.3} unit=" m³/s" decimalPlaces={1}
//              w={100} h={40} />

//             {/* TANK INDICATOR */}

//             <LevelIndicator x={742} y={250} value={92} w={70} h={150} />
//             <LevelIndicator x={280} y={250} value={92} w={70} h={150} />


//             <SensorIndicator x={742} y={585} value={0} unit="%"
//             warningThreshold={7.5} alarmThreshold={7.6} w={100} h={45} />
//             <SensorIndicator x={881} y={585} value={0} unit="%"
//             warningThreshold={7.5} alarmThreshold={7.6} w={100} h={45} />

//             <LabelComponent text="TDS" x={760} y={710} w={60} h={35} hasBorder={false} />
//             <LabelComponent text="PH" x={905} y={710} w={50} h={35} hasBorder={false} />
//             <SensorIndicator x={742} y={660} value={320} unit=" ppm"
//             warningThreshold={300} alarmThreshold={350} w={100} h={45} />
//             <SensorIndicator x={881} y={660} value={7.2} unit=" pH" decimalPlaces={1}
//             warningThreshold={7.5} alarmThreshold={7.6} w={100} h={45} />

//             {/* AMBIENT TEMP */}
//             <LabelComponent text="AMBIENT TEMP" x={10} y={40} w={150} h={50} hasBorder={true} />
//             <SensorIndicator x={30} y={100} value={32.5} unit=" °C" decimalPlaces={1}
//             warningThreshold={35} alarmThreshold={40} w={100} h={45} />