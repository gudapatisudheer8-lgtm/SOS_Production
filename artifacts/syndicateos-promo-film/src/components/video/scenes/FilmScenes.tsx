import { motion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';
import logo from '@assets/syndicateos-logo-horizontal.png';

const ease = [0.22, 1, 0.36, 1] as const;
const rise = { initial: { y: 28, opacity: 0 }, animate: { y: 0, opacity: 1 }, transition: { duration: 0.65, ease } };

function Scene({ children, tone = 'navy', className = '' }: { children: ReactNode; tone?: 'navy' | 'paper' | 'split'; className?: string }) {
  return (
    <motion.section
      className={`film-scene tone-${tone} ${className}`}
      initial={{ opacity: 0, scale: 1.035, filter: 'blur(9px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 1.055, filter: 'blur(8px)' }}
      transition={{ duration: 0.56, ease }}
    >
      {children}
    </motion.section>
  );
}

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <motion.div className={`film-eyebrow ${dark ? 'eyebrow-dark' : ''}`} {...rise}>{children}</motion.div>;
}

function UIFrame({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`ui-window ${className}`}>
      <div className="ui-topbar"><span className="ui-mark">SOS</span><span>SyndicateOS</span><i /><span className="ui-workspace">VENTURE OPERATIONS</span><span className="ui-avatar">A</span></div>
      {children}
    </div>
  );
}

function MiniStat({ label, value, mood = '' }: { label: string; value: string; mood?: string }) {
  return <div className={`mini-stat ${mood}`}><span>{label}</span><strong>{value}</strong></div>;
}

function PaperRow({ title, sub, status, number = '—' }: { title: string; sub: string; status: string; number?: string }) {
  return <div className="paper-row"><div className="paper-dot" /><div className="paper-copy"><strong>{title}</strong><span>{sub}</span></div><span className="paper-status">{status}</span><b>{number}</b></div>;
}

export function FilmScene01() {
  return (
    <Scene className="scene-opening">
      <div className="opening-rail">
        <motion.span className="opening-kicker" initial={{ opacity: 0, x: -26 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .55 }}>A venture is never one thing.</motion.span>
        <motion.div className="opening-word first" initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 280, damping: 22 }}>PROJECTS.</motion.div>
        <motion.div className="opening-word second" initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 280, damping: 22, delay: .48 }}>MONEY.</motion.div>
        <motion.div className="opening-word third" initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 280, damping: 22, delay: .96 }}>PEOPLE.</motion.div>
        <motion.div className="opening-statement" {...rise} transition={{ ...rise.transition, delay: 1.4 }}>One shared picture changes the work.</motion.div>
        <div className="opening-small">ILLUSTRATIVE PRODUCT TOUR</div>
      </div>
      <motion.div className="opening-orbit" initial={{ rotate: -35, scale: .75, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} transition={{ duration: 1.3, ease }}>
        <span className="orbit-tag">01 / ALIGN</span><span className="orbit-node node-one" /><span className="orbit-node node-two" /><span className="orbit-node node-three" />
      </motion.div>
      <motion.div className="gold-spine" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.1, delay: 1.6, ease }} />
    </Scene>
  );
}

export function FilmScene02() {
  return (
    <Scene tone="paper" className="scene-accountant">
      <div className="feature-copy accountant-copy">
        <Eyebrow dark>01 / ACCOUNTANT CONSOLE</Eyebrow>
        <motion.h1 {...rise} transition={{ ...rise.transition, delay: .12 }}>One view.<br /><em>The whole portfolio.</em></motion.h1>
        <motion.p {...rise} transition={{ ...rise.transition, delay: .25 }}>Dashboard / Partners &amp; Equity / Open Plotting / Project Statement</motion.p>
        <div className="data-disclaimer">ILLUSTRATIVE DEMO DATA</div>
      </div>
      <motion.div className="dashboard-tilt" initial={{ x: 125, y: 20, rotateY: -9, opacity: 0 }} animate={{ x: 0, y: 0, rotateY: -3, opacity: 1 }} transition={{ duration: .9, ease }}>
        <UIFrame>
          <div className="ui-dashboard">
            <div className="ui-heading"><span>Operations overview</span><span className="date-pill">THIS QUARTER</span></div>
            <div className="stats-row">
              <MiniStat label="ACTIVE VENTURES" value="03" />
              <MiniStat label="CAPITAL TRACKED" value="₹ 8.4 Cr*" mood="stat-amber" />
              <MiniStat label="NOTIFICATIONS" value="04" mood="stat-slate" />
            </div>
            <div className="ui-section-label">VENTURES AT A GLANCE <span>VIEW ALL ↗</span></div>
            <div className="venture-row"><span className="venture-symbol">01</span><div><b>Northstar Fields</b><small>LAND DEVELOPMENT · 2 PARTNERS</small></div><span className="tag-live">IN PROGRESS</span><div className="venture-bar"><i style={{ width: '68%' }} /></div><small>68%</small></div>
            <div className="venture-row"><span className="venture-symbol alt">02</span><div><b>Orchard Heights</b><small>RESIDENTIAL · 4 PARTNERS</small></div><span className="tag-watch">BOOKINGS</span><div className="venture-bar"><i style={{ width: '42%' }} /></div><small>42%</small></div>
            <div className="ui-footer-label">*SYNTHETIC EXAMPLE · NOT LIVE ACCOUNT DATA</div>
          </div>
        </UIFrame>
      </motion.div>
      <motion.div className="corner-bracket" initial={{ scale: .6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: .7, duration: .5 }} />
    </Scene>
  );
}

export function FilmScene03() {
  return (
    <Scene tone="navy" className="scene-ledger">
      <div className="ledger-title">
        <Eyebrow>02 / TREASURY & STATEMENT</Eyebrow>
        <motion.h2 {...rise} transition={{ ...rise.transition, delay: .1 }}>Every account,<br /><span>in context.</span></motion.h2>
        <motion.p {...rise} transition={{ ...rise.transition, delay: .24 }}>Connected to its project. Ready to follow.</motion.p>
      </div>
      <motion.div className="ledger-stack" initial={{ rotateY: 16, scale: .9, x: 75, opacity: 0 }} animate={{ rotateY: 0, scale: 1, x: 0, opacity: 1 }} transition={{ duration: .85, ease }}>
        <div className="ledger-card ledger-bank"><span className="ledger-index">A / 01</span><span className="ledger-kind">PROJECT BANK</span><strong>•••• ••••</strong><small>OPERATING ACCOUNT</small><div className="ledger-wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div>
        <div className="ledger-card ledger-cash"><span className="ledger-index">A / 02</span><span className="ledger-kind">SITE CASH</span><strong>••••</strong><small>FIELD IMPREST</small><div className="ledger-wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></div>
        <div className="ledger-line" />
        <div className="ledger-transactions">
          <div className="statement-head"><span>PROJECT STATEMENT</span><span>ILLUSTRATIVE RECORDS</span></div>
          <PaperRow title="Customer advance" sub="Booking · Project account" status="CLEARED" />
          <PaperRow title="Materials outlay" sub="Site expense · Enrolled" status="POSTED" />
          <PaperRow title="Partner contribution" sub="Capital · Linked entry" status="RECORDED" />
        </div>
      </motion.div>
      <motion.div className="ledger-seal" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 1.1, type: 'spring', stiffness: 260, damping: 19 }}>✓</motion.div>
    </Scene>
  );
}

export function FilmScene04() {
  return (
    <Scene tone="paper" className="scene-approval">
      <div className="approval-header">
        <Eyebrow dark>03 / POSTING &amp; CORRECTIONS</Eyebrow>
        <motion.h2 {...rise} transition={{ ...rise.transition, delay: .08 }}>Posted once.<br />Traced always.</motion.h2>
        <motion.p {...rise} transition={{ ...rise.transition, delay: .2 }}>Entries post directly. Corrections keep the original.</motion.p>
      </div>
      <div className="approval-stage">
        <motion.div className="expense-slip" initial={{ y: 100, rotate: -6, opacity: 0 }} animate={{ y: 0, rotate: -2, opacity: 1 }} transition={{ duration: .65, ease }}>
          <div className="slip-top"><span>FIELD EXPENSE</span><span>DEMO</span></div>
          <strong>Site materials</strong><small>Enrolled by site team</small>
          <div className="slip-rule" /><div className="slip-line w-80" /><div className="slip-line w-55" /><div className="slip-redaction" />
          <span className="slip-status">POSTED</span>
        </motion.div>
        <motion.div className="approval-path" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: .4, duration: .85, ease }} />
        <motion.div className="review-seal referred" initial={{ scale: .4, opacity: 0 }} animate={{ scale: [0.4, 1, 1, 0.9], opacity: [0, 1, 1, 0] }} transition={{ delay: 1.05, duration: 2.6, times: [0, .2, .85, 1] }}><span>↺</span><small>REFERRED BACK</small></motion.div>
        <motion.div className="review-seal" initial={{ scale: .4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 3.55, type: 'spring', stiffness: 240, damping: 18 }}><span>✓</span><small>RESUBMITTED</small></motion.div>
        <motion.div className="drawing-token" initial={{ x: 80, y: 45, opacity: 0 }} animate={{ x: 0, y: 0, opacity: 1 }} transition={{ delay: 1.6, duration: .6, ease }}>
          <span className="token-mark">●</span><div><b>Notification sent</b><small>PARTNERS SEE THE ENTRY</small></div>
        </motion.div>
        <motion.div className="audit-trail" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 4.2, duration: .55, ease }}>
          <span><i />ORIGINAL KEPT</span><span><i />REASON LOGGED</span><span><i className="ok" />BALANCE RECALCULATED</span>
        </motion.div>
        <div className="flow-caption">Illustrative audit trail — not live records.</div>
      </div>
    </Scene>
  );
}

const plots = [
  ['01', 'available'], ['02', 'reserved'], ['03', 'available'], ['04', 'sold'],
  ['05', 'available'], ['06', 'available'], ['07', 'reserved'], ['08', 'available'],
  ['09', 'sold'], ['10', 'available'], ['11', 'available'], ['12', 'available'],
];

export function FilmScene05() {
  const plotLines = useMemo(() => Array.from({ length: 7 }, (_, index) => index), []);
  return (
    <Scene tone="navy" className="scene-plots">
      <div className="plot-copy">
        <Eyebrow>04 / OPEN PLOTTING</Eyebrow>
        <motion.h2 {...rise} transition={{ ...rise.transition, delay: .08 }}>See the<br /><i>landscape.</i></motion.h2>
        <div className="plot-filters"><span>ORIENTATION</span><span>STATUS</span><span>AVAILABILITY</span></div>
        <motion.p {...rise} transition={{ ...rise.transition, delay: .25 }}>Inventory, collections and registration — per plot.</motion.p>
        <small className="survey-note">ILLUSTRATIVE LAYOUT · NOT A SURVEYED PLAN</small>
      </div>
      <motion.div className="plot-map" initial={{ scale: .8, rotate: -4, x: 90, opacity: 0 }} animate={{ scale: 1, rotate: 0, x: 0, opacity: 1 }} transition={{ duration: .85, ease }}>
        <div className="map-road"><span>ACCESS ROAD · ILLUSTRATIVE</span></div>
        <div className="plot-grid">
          {plots.map(([num, status], index) => <motion.div key={num} className={`plot-cell plot-${status}`} initial={{ scale: .7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: .18 + index * .055, duration: .35, ease }}><b>{num}</b><span>{status.toUpperCase()}</span></motion.div>)}
        </div>
        <div className="map-compass">N <span>↑</span></div>
        {plotLines.map((i) => <i key={i} className={`map-contour contour-${i}`} />)}
      </motion.div>
      <motion.div className="plot-focus" initial={{ scale: .3, opacity: 0 }} animate={{ scale: [0.3, 1, 1, 0.6], opacity: [0, 1, 1, 0] }} transition={{ delay: 1.55, duration: 1.9, times: [0, .25, .8, 1] }}><span>FOCUS</span><b>07</b><small>RESERVED</small></motion.div>
      <motion.div className="collect-card" initial={{ scale: .6, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ delay: 3.1, type: 'spring', stiffness: 240, damping: 20 }}>
        <div className="collect-top"><span>PLOT 07 · COLLECTIONS</span><em>DEMO</em></div>
        <div className="collect-rate"><span>RATE</span><b>₹ ••••/sq.yd</b><i>LOCKED AFTER 1ST PAYMENT</i></div>
        <div className="collect-bar"><motion.i initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 3.8, duration: .9, ease }} /></div>
        <div className="collect-sums"><span>COLLECTED<b>2 receipts</b></span><span>OUTSTANDING<b>₹ •• L</b></span></div>
        <motion.div className="collect-block" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 4.7, duration: .4 }}>OVERPAYMENT BLOCKED</motion.div>
        <motion.div className="collect-reg" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 5.4, duration: .45 }}><b>REGISTRATION</b><span>Date · Time · Location · Reminder</span></motion.div>
      </motion.div>
    </Scene>
  );
}

export function FilmScene06() {
  return (
    <Scene tone="navy" className="scene-partner">
      <motion.div className="share-ring" initial={{ rotate: -80, scale: .75, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} transition={{ duration: .9, ease }}>
        <i /><i /><i /><span className="ring-center"><b>YOUR</b><strong>VENTURE</strong><small>PARTNER VIEW</small></span>
      </motion.div>
      <motion.div className="partner-device" initial={{ y: 80, rotate: 4, opacity: 0 }} animate={{ y: 0, rotate: 1, opacity: 1 }} transition={{ duration: .75, delay: .16, ease }}>
        <div className="partner-top"><span className="device-dot" /><span>PARTNER PORTAL</span><span className="device-avatar">P</span></div>
        <div className="partner-hello">My venture view.</div>
        <div className="partner-tabs"><span className="on">Dashboard</span><span>Plots</span><span>Project Statements</span></div>
        <div className="partner-project">Northstar Fields <span>ACTIVE</span></div>
        <div className="partner-metrics"><MiniStat label="INVESTMENT" value="••••••" /><MiniStat label="DRAWINGS" value="••" /><MiniStat label="ALERTS" value="02" mood="stat-amber" /></div>
        <div className="partner-history-title">RECENT ACTIVITY <span>DEMO RECORDS</span></div>
        <div className="partner-history"><i /><div><b>Contribution recorded</b><small>Linked to project account</small></div><span>✓</span></div>
        <div className="partner-history"><i className="history-amber" /><div><b>Site expense posted</b><small>Notification · in the statement</small></div><span>●</span></div>
      </motion.div>
      <div className="partner-copy">
        <Eyebrow>05 / FOR THE PARTNER</Eyebrow>
        <motion.p {...rise} transition={{ ...rise.transition, delay: .25 }}>Know what's recorded.<br /><strong>See what's next.</strong></motion.p>
        <small>ALL EXAMPLE DATA IS SYNTHETIC</small>
      </div>
    </Scene>
  );
}

export function FilmScene07() {
  return (
    <Scene tone="split" className="scene-shared">
      <div className="shared-dark" /><div className="shared-paper" />
      <div className="shared-title">
        <Eyebrow>ONE PROJECT · TWO CLEAR VIEWS</Eyebrow>
        <motion.h2 {...rise} transition={{ ...rise.transition, delay: .05 }}>One workflow.<br /><i>Shared clarity.</i></motion.h2>
      </div>
      <motion.div className="role-panel role-accountant" initial={{ x: -80, rotateY: 12, opacity: 0 }} animate={{ x: 0, rotateY: 0, opacity: 1 }} transition={{ duration: .7, delay: .2, ease }}>
        <span>ACCOUNTANT</span><b>OPERATIONS</b><i className="role-bars"><em /><em /><em /></i>
      </motion.div>
      <motion.div className="role-panel role-partner" initial={{ x: 80, rotateY: -12, opacity: 0 }} animate={{ x: 0, rotateY: 0, opacity: 1 }} transition={{ duration: .7, delay: .34, ease }}>
        <span>PARTNER</span><b>OVERSIGHT</b><i className="role-bars"><em /><em /><em /></i>
      </motion.div>
      <motion.div className="shared-spine" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: .55, duration: .8, ease }}>
        <span className="spine-node one" /><span className="spine-node two" /><span className="spine-node three" />
      </motion.div>
      <motion.div className="shared-message" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4, duration: .5, ease }}>Less chasing. <strong>Clearer coordination.</strong></motion.div>
      <motion.div className="shared-word-trio" initial={{ scale: .9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 2.6, duration: .45 }}>PROJECTS <b>/</b> PARTNERS <b>/</b> CLARITY</motion.div>
    </Scene>
  );
}

export function FilmScene08() {
  return (
    <Scene tone="paper" className="scene-endcard">
      <div className="endcard-orbit" />
      <motion.div className="endcard-brand" initial={{ scale: .86, y: 16, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ duration: .7, ease }}>
        <img src={logo} alt="SyndicateOS" />
        <motion.div className="endcard-rule" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: .45, duration: .6, ease }} />
        <motion.h2 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .65, duration: .55, ease }}>PROJECTS, <em>IN SYNC.</em></motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: .5 }}>Accountant operations. Partner visibility.</motion.p>
        <motion.small initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.45, duration: .45 }}>One connected place to manage a venture.</motion.small>
      </motion.div>
      <div className="endcard-footer">ILLUSTRATIVE PRODUCT TOUR <span>·</span> SYNDICATEOS</div>
    </Scene>
  );
}
