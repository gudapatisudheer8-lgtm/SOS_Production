// Professional architectural & layout blueprints in SVG Data URL format for instant prototyping and visual reference

export const SAMPLE_CONSTRUCTION_BLUEPRINT = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" width="1000" height="700" style="background:#0f172a; font-family: ui-monospace, monospace;">
  <!-- Grid background -->
  <defs>
    <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" stroke-width="0.7"/>
    </pattern>
    <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
      <rect width="100" height="100" fill="url(#smallGrid)"/>
      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#334155" stroke-width="1.2"/>
    </pattern>
  </defs>
  <rect width="1000" height="700" fill="url(#grid)" />

  <!-- Blueprint Header / Title Block -->
  <rect x="30" y="25" width="940" height="60" fill="#1e293b" rx="8" stroke="#38bdf8" stroke-width="1.5" />
  <text x="50" y="55" fill="#38bdf8" font-size="16" font-weight="900" letter-spacing="1.5">ROYAL RESIDENCY - TYPICAL FLOOR ARCHITECTURAL PLAN (FLOORS 1 - 5)</text>
  <text x="50" y="73" fill="#94a3b8" font-size="11">RERA REG NO: P03240019284 | SANCTIONED PLAN NO: GHMC/BA/2026/089 | SCALE: 1:100</text>
  <text x="800" y="60" fill="#38bdf8" font-size="14" font-weight="bold">4 UNITS / FLOOR</text>

  <!-- Central Corridor & Lift Lobby -->
  <rect x="420" y="110" width="160" height="470" fill="#1e293b" stroke="#64748b" stroke-width="2" stroke-dasharray="4,4"/>
  <text x="440" y="340" fill="#94a3b8" font-size="13" font-weight="bold" transform="rotate(-90 440 340)">COMMON PASSAGE / LOBBY (6'-0" WIDE)</text>

  <!-- Lift & Staircase -->
  <rect x="440" y="130" width="120" height="80" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
  <text x="465" y="175" fill="#38bdf8" font-size="13" font-weight="bold">LIFT</text>
  <text x="450" y="195" fill="#94a3b8" font-size="9">8 PASSENGER</text>

  <rect x="440" y="470" width="120" height="90" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
  <text x="460" y="515" fill="#38bdf8" font-size="12" font-weight="bold">STAIRCASE</text>
  <line x1="440" y1="485" x2="560" y2="485" stroke="#475569" stroke-width="1"/>
  <line x1="440" y1="500" x2="560" y2="500" stroke="#475569" stroke-width="1"/>
  <line x1="440" y1="530" x2="560" y2="530" stroke="#475569" stroke-width="1"/>
  <line x1="440" y1="545" x2="560" y2="545" stroke="#475569" stroke-width="1"/>

  <!-- FLAT #01 - North-East 3 BHK -->
  <rect x="50" y="110" width="350" height="220" fill="#1e293b" fill-opacity="0.6" stroke="#38bdf8" stroke-width="2.5" rx="4"/>
  <rect x="60" y="120" width="130" height="110" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="75" y="175" fill="#f8fafc" font-size="11" font-weight="bold">MASTER BED</text>
  <text x="80" y="195" fill="#94a3b8" font-size="9">12'0" x 14'0"</text>

  <rect x="200" y="120" width="190" height="110" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="250" y="175" fill="#f8fafc" font-size="11" font-weight="bold">LIVING / DINING</text>
  <text x="260" y="195" fill="#94a3b8" font-size="9">18'0" x 12'6"</text>

  <rect x="60" y="240" width="130" height="80" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="85" y="280" fill="#f8fafc" font-size="11" font-weight="bold">BEDROOM 2</text>

  <rect x="200" y="240" width="90" height="80" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="215" y="280" fill="#f8fafc" font-size="11" font-weight="bold">KITCHEN</text>

  <rect x="300" y="240" width="90" height="80" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="315" y="280" fill="#38bdf8" font-size="11" font-weight="bold">BALCONY</text>

  <rect x="60" y="120" width="90" height="24" fill="#38bdf8" rx="3"/>
  <text x="68" y="136" fill="#0f172a" font-size="11" font-weight="900">FLAT #101 • 3 BHK</text>
  <text x="310" y="140" fill="#fbbf24" font-size="11" font-weight="bold">1,650 SFT (EAST)</text>

  <!-- FLAT #02 - North-West 2 BHK -->
  <rect x="600" y="110" width="350" height="220" fill="#1e293b" fill-opacity="0.6" stroke="#38bdf8" stroke-width="2.5" rx="4"/>
  <rect x="610" y="120" width="190" height="110" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="660" y="175" fill="#f8fafc" font-size="11" font-weight="bold">LIVING / DINING</text>
  <rect x="810" y="120" width="130" height="110" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="830" y="175" fill="#f8fafc" font-size="11" font-weight="bold">MASTER BED</text>
  <rect x="610" y="240" width="110" height="80" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="635" y="280" fill="#f8fafc" font-size="11" font-weight="bold">BEDROOM 2</text>
  <rect x="730" y="240" width="100" height="80" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="750" y="280" fill="#f8fafc" font-size="11" font-weight="bold">KITCHEN</text>
  <rect x="840" y="240" width="100" height="80" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="860" y="280" fill="#38bdf8" font-size="11" font-weight="bold">BALCONY</text>

  <rect x="610" y="120" width="90" height="24" fill="#10b981" rx="3"/>
  <text x="618" y="136" fill="#0f172a" font-size="11" font-weight="900">FLAT #102 • 2 BHK</text>
  <text x="860" y="140" fill="#fbbf24" font-size="11" font-weight="bold">1,250 SFT (NORTH)</text>

  <!-- FLAT #03 - South-East 2 BHK -->
  <rect x="50" y="360" width="350" height="220" fill="#1e293b" fill-opacity="0.6" stroke="#38bdf8" stroke-width="2.5" rx="4"/>
  <rect x="60" y="370" width="190" height="110" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="120" y="425" fill="#f8fafc" font-size="11" font-weight="bold">LIVING ROOM</text>
  <rect x="260" y="370" width="130" height="110" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="280" y="425" fill="#f8fafc" font-size="11" font-weight="bold">MASTER BED</text>
  <rect x="60" y="490" width="120" height="80" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="90" y="535" fill="#f8fafc" font-size="11" font-weight="bold">BEDROOM 2</text>
  <rect x="190" y="490" width="100" height="80" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="210" y="535" fill="#f8fafc" font-size="11" font-weight="bold">KITCHEN</text>
  <rect x="300" y="490" width="90" height="80" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="315" y="535" fill="#38bdf8" font-size="11" font-weight="bold">BALCONY</text>

  <rect x="60" y="370" width="90" height="24" fill="#10b981" rx="3"/>
  <text x="68" y="386" fill="#0f172a" font-size="11" font-weight="900">FLAT #103 • 2 BHK</text>
  <text x="310" y="390" fill="#fbbf24" font-size="11" font-weight="bold">1,250 SFT (WEST)</text>

  <!-- FLAT #04 - South-West Corner 3 BHK -->
  <rect x="600" y="360" width="350" height="220" fill="#1e293b" fill-opacity="0.6" stroke="#38bdf8" stroke-width="2.5" rx="4"/>
  <rect x="610" y="370" width="130" height="110" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="630" y="425" fill="#f8fafc" font-size="11" font-weight="bold">MASTER BED</text>
  <rect x="750" y="370" width="190" height="110" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="800" y="425" fill="#f8fafc" font-size="11" font-weight="bold">LIVING / DINING</text>
  <rect x="610" y="490" width="110" height="80" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="630" y="535" fill="#f8fafc" font-size="11" font-weight="bold">BEDROOM 2</text>
  <rect x="730" y="490" width="100" height="80" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="750" y="535" fill="#f8fafc" font-size="11" font-weight="bold">BEDROOM 3</text>
  <rect x="840" y="490" width="100" height="80" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="860" y="535" fill="#38bdf8" font-size="11" font-weight="bold">KITCHEN</text>

  <rect x="610" y="370" width="90" height="24" fill="#38bdf8" rx="3"/>
  <text x="618" y="386" fill="#0f172a" font-size="11" font-weight="900">FLAT #104 • 3 BHK</text>
  <text x="850" y="390" fill="#fbbf24" font-size="11" font-weight="bold">1,650 SFT (CORNER)</text>

  <!-- Legend & Stamps at bottom -->
  <rect x="30" y="605" width="940" height="70" fill="#1e293b" rx="6" stroke="#475569" stroke-width="1"/>
  <text x="50" y="630" fill="#94a3b8" font-size="11" font-weight="bold">STRUCTURAL HIGHLIGHTS:</text>
  <text x="50" y="650" fill="#64748b" font-size="10">• RCC Framed Earthquake Resistant Structure • Fe 550D TMT Steel • Red Clay Brickwork 9" Outer / 4.5" Inner</text>
  <text x="50" y="665" fill="#64748b" font-size="10">• Stilt Floor Car Parking • Clubhouse Level 1: Gym (2,500 SFT) • Level 2: Community Banquet Hall (3,000 SFT)</text>

  <!-- Seal -->
  <circle cx="890" cy="640" r="24" fill="none" stroke="#22c55e" stroke-width="2"/>
  <text x="868" y="638" fill="#22c55e" font-size="8" font-weight="bold">APPROVED</text>
  <text x="872" y="649" fill="#22c55e" font-size="8" font-weight="bold">AP-RERA</text>
</svg>
`)}`;

export const SAMPLE_LAYOUT_BLUEPRINT = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" width="1000" height="700" style="background:#091e2b; font-family: ui-monospace, monospace;">
  <!-- Grid -->
  <defs>
    <pattern id="layoutGrid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#133e54" stroke-width="0.8"/>
    </pattern>
  </defs>
  <rect width="1000" height="700" fill="url(#layoutGrid)" />

  <!-- Layout Title Block -->
  <rect x="40" y="25" width="920" height="60" fill="#0d2e40" rx="8" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="60" y="55" fill="#38bdf8" font-size="16" font-weight="900" letter-spacing="1">CRDA / DTCP APPROVED MASTER LAYOUT PLAN - 6.0 ACRES</text>
  <text x="60" y="73" fill="#7dd3fc" font-size="11">LP NO: CRDA/LP/2026/058 | SY NO: 165/1, 166/2 | AMARAVATI CAPITAL BORDER</text>
  <text x="810" y="60" fill="#fbbf24" font-size="14" font-weight="bold">36 PLOTS TOTAL</text>

  <!-- Main 40 FT Master Approach Road -->
  <rect x="40" y="110" width="920" height="50" fill="#1e293b" stroke="#64748b" stroke-width="1.5"/>
  <text x="380" y="140" fill="#f8fafc" font-size="13" font-weight="900" letter-spacing="3">40 FEET WIDE SECTOR ROAD (EAST-WEST)</text>

  <!-- North Plot Row (Plots 1 to 6) -->
  <g transform="translate(60, 180)">
    <!-- Plot 1 -->
    <rect x="0" y="0" width="130" height="150" fill="#0e3a4e" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="35" y="40" fill="#fbbf24" font-size="12" font-weight="bold">PLOT #01</text>
    <text x="35" y="65" fill="#f8fafc" font-size="10">267 Sq.Yds</text>
    <text x="25" y="85" fill="#34d399" font-size="9" font-weight="bold">CORNER (E/N)</text>
    <text x="35" y="110" fill="#f87171" font-size="9" font-weight="bold">[SOLD]</text>

    <!-- Plot 2 -->
    <rect x="145" y="0" width="130" height="150" fill="#0e3a4e" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="180" y="40" fill="#fbbf24" font-size="12" font-weight="bold">PLOT #02</text>
    <text x="180" y="65" fill="#f8fafc" font-size="10">200 Sq.Yds</text>
    <text x="185" y="85" fill="#38bdf8" font-size="9">EAST FACING</text>
    <text x="175" y="110" fill="#fbbf24" font-size="9" font-weight="bold">[RESERVED]</text>

    <!-- Plot 3 -->
    <rect x="290" y="0" width="130" height="150" fill="#0e3a4e" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="325" y="40" fill="#fbbf24" font-size="12" font-weight="bold">PLOT #03</text>
    <text x="325" y="65" fill="#f8fafc" font-size="10">200 Sq.Yds</text>
    <text x="330" y="85" fill="#38bdf8" font-size="9">EAST FACING</text>
    <text x="330" y="110" fill="#34d399" font-size="9" font-weight="bold">[AVAILABLE]</text>

    <!-- Plot 4 -->
    <rect x="435" y="0" width="130" height="150" fill="#0e3a4e" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="470" y="40" fill="#fbbf24" font-size="12" font-weight="bold">PLOT #04</text>
    <text x="470" y="65" fill="#f8fafc" font-size="10">200 Sq.Yds</text>
    <text x="475" y="85" fill="#38bdf8" font-size="9">EAST FACING</text>
    <text x="475" y="110" fill="#34d399" font-size="9" font-weight="bold">[AVAILABLE]</text>

    <!-- Park & Green Belt (Statutory 10%) -->
    <rect x="580" y="0" width="300" height="150" fill="#064e3b" stroke="#10b981" stroke-width="2" rx="4"/>
    <text x="630" y="55" fill="#6ee7b7" font-size="14" font-weight="900">STATUTORY 10% OPEN PARK</text>
    <text x="660" y="80" fill="#a7f3d0" font-size="11">2,904 Sq. Yards (0.60 Acres)</text>
    <text x="640" y="105" fill="#6ee7b7" font-size="10">Children Tot-Lot, Walking Track &amp; Sump</text>
  </g>

  <!-- Internal 33 FT Cross Road -->
  <rect x="40" y="350" width="920" height="40" fill="#1e293b" stroke="#64748b" stroke-width="1.5"/>
  <text x="410" y="375" fill="#f8fafc" font-size="12" font-weight="bold">33 FEET WIDE INTERNAL LAYOUT ROAD</text>

  <!-- South Plot Row (Plots 5 to 10) -->
  <g transform="translate(60, 410)">
    <rect x="0" y="0" width="130" height="150" fill="#0e3a4e" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="35" y="40" fill="#fbbf24" font-size="12" font-weight="bold">PLOT #05</text>
    <text x="35" y="65" fill="#f8fafc" font-size="10">267 Sq.Yds</text>
    <text x="30" y="85" fill="#34d399" font-size="9">CORNER (W/S)</text>

    <rect x="145" y="0" width="130" height="150" fill="#0e3a4e" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="180" y="40" fill="#fbbf24" font-size="12" font-weight="bold">PLOT #06</text>
    <text x="180" y="65" fill="#f8fafc" font-size="10">220 Sq.Yds</text>
    <text x="185" y="85" fill="#38bdf8" font-size="9">NORTH FACING</text>

    <rect x="290" y="0" width="130" height="150" fill="#0e3a4e" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="325" y="40" fill="#fbbf24" font-size="12" font-weight="bold">PLOT #07</text>
    <text x="325" y="65" fill="#f8fafc" font-size="10">200 Sq.Yds</text>
    <text x="330" y="85" fill="#38bdf8" font-size="9">NORTH FACING</text>

    <rect x="435" y="0" width="130" height="150" fill="#0e3a4e" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="470" y="40" fill="#fbbf24" font-size="12" font-weight="bold">PLOT #08</text>
    <text x="470" y="65" fill="#f8fafc" font-size="10">200 Sq.Yds</text>
    <text x="475" y="85" fill="#38bdf8" font-size="9">NORTH FACING</text>

    <rect x="580" y="0" width="140" height="150" fill="#0e3a4e" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="615" y="40" fill="#fbbf24" font-size="12" font-weight="bold">PLOT #09</text>
    <text x="615" y="65" fill="#f8fafc" font-size="10">300 Sq.Yds</text>
    <text x="615" y="85" fill="#38bdf8" font-size="9">COMMERCIAL</text>

    <!-- OHT & Utility -->
    <rect x="735" y="0" width="145" height="150" fill="#1e1b4b" stroke="#818cf8" stroke-width="1.5"/>
    <text x="750" y="55" fill="#c7d2fe" font-size="12" font-weight="bold">OVERHEAD TANK</text>
    <text x="755" y="80" fill="#a5b4fc" font-size="10">&amp; TRANSFORMER</text>
    <text x="765" y="105" fill="#818cf8" font-size="9">50,000 Litres</text>
  </g>

  <!-- Footer Seal -->
  <rect x="40" y="580" width="920" height="95" fill="#0d2e40" rx="6" stroke="#1e40af" stroke-width="1"/>
  <text x="60" y="610" fill="#93c5fd" font-size="12" font-weight="bold">STATUTORY CRDA SANCTION PARTICULARS:</text>
  <text x="60" y="630" fill="#7dd3fc" font-size="10">• Plotted Area: 65.5% • Roads &amp; Infrastructure: 24.5% • Statutory Public Open Space: 10.0%</text>
  <text x="60" y="650" fill="#7dd3fc" font-size="10">• Mortgaged Plots with CRDA: Plots 31 to 36 (15% statutory development guarantee)</text>

  <circle cx="890" cy="625" r="28" fill="none" stroke="#38bdf8" stroke-width="2"/>
  <text x="865" y="622" fill="#38bdf8" font-size="9" font-weight="bold">CRDA LP</text>
  <text x="865" y="635" fill="#38bdf8" font-size="8" font-weight="bold">APPROVED</text>
</svg>
`)}`;
