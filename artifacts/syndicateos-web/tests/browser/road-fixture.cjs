const { execFileSync } = require('node:child_process');
const { randomUUID, randomInt } = require('node:crypto');
const bcrypt = require('bcryptjs');

// Fixed disposable preview DB only. Never read RDS/environment credentials.
function sql(statement) {
  return execFileSync('psql', [
    '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1',
    '-h', '127.0.0.1', '-p', '55439', '-U', 'sos_test', '-d', 'sos_development',
    '-c', statement,
  ], { encoding: 'utf8', env: {
    PATH: process.env.PATH, HOME: process.env.HOME,
    // Disable inherited connection overrides and password-file credentials.
    PGPASSFILE: '/tmp/sos-browser-unused-password-file', PGCONNECT_TIMEOUT: '5',
  } }).trim();
}
const quote = (v) => `'${String(v).replaceAll("'", "''")}'`;
const json = (v) => `${quote(JSON.stringify(v))}::jsonb`;
const tables = [
  'projects', 'project_setup_sections', 'erp_records', 'erp_project_settings',
  'erp_approvals', 'erp_postings', 'erp_audit', 'erp_inventory_reservations',
  'erp_attachments', 'project_cash_accounts',
];

// Full row hashes cover bookings, buyer fields, amounts, ledgers, approvals,
// revisions and timestamps, not just row counts. Compared after fixture cleanup.
function snapshot() {
  return Object.fromEntries(tables.map((table) => [table, sql(
    `SELECT md5(coalesce(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text),'')) FROM sos.${table} t`,
  )]));
}

async function seed() {
  if (sql("SELECT current_database()='sos_development' AND host(inet_server_addr())='127.0.0.1' AND current_user='sos_test'") !== 't') {
    throw new Error('Refusing to seed anything except the disposable local preview database.');
  }
  const before = snapshot();
  const identity = randomUUID();
  const firm = randomUUID();
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const code = `ROAD-${suffix}`;
  const mobile = `+919${randomInt(100000000, 999999999)}`;
  const pin = String(randomInt(100000, 999999));
  const hash = await bcrypt.hash(pin, 12);
  const release = JSON.parse(sql(`SELECT row_to_json(r) FROM (
    SELECT s.id AS sector, r.id AS release FROM sos.sectors s
    JOIN sos.sector_releases r ON r.sector_id=s.id
    WHERE s.code='open-plotting' AND r.state='PUBLISHED'
    ORDER BY r.version DESC LIMIT 1) r`));
  if (!release) throw new Error('Local preview needs published open-plotting configuration.');
  const projects = ['A', 'B', 'Missing'].map((key) => ({
    key, id: randomUUID(), name: `Road regression ${key} ${suffix}`,
    // Match persisted project setup selects: numeric strings.
    details: { projectCode: `${key}-${suffix}`, extentValue: 2, extentUnit: 'Acres',
      ...(key === 'Missing' ? {} : { roadWidth: key === 'A' ? '30' : '60' }) },
    plots: key === 'Missing'
      ? [{ plotNumber: 'Missing-E', facing: 'East', status: 'available' }]
      : [
        { plotNumber: `${key}-E`, facing: 'East', status: 'available', roadWidthFt: key === 'A' ? 33 : 40 },
        { plotNumber: `${key}-W`, facing: 'West', status: 'reserved' },
        { plotNumber: `${key}-N`, facing: 'North', status: 'sold', roadWidthFt: key === 'A' ? 32.5 : 45.5 },
      ],
  }));
  sql(`BEGIN;
    INSERT INTO sos.identities(id,mobile,display_name,credential_hash,must_change_credential)
      VALUES (${quote(identity)},${quote(mobile)},'Road regression accountant',${quote(hash)},false);
    INSERT INTO sos.firms(id,client_code,name,created_by)
      VALUES (${quote(firm)},${quote(code)},${quote(`Road regression ${suffix}`)},${quote(identity)});
    INSERT INTO sos.firm_memberships(firm_id,identity_id,role_code)
      VALUES (${quote(firm)},${quote(identity)},'ACCOUNTANT');
    INSERT INTO sos.firm_sector_assignments(firm_id,sector_id,release_id)
      VALUES (${quote(firm)},${quote(release.sector)},${quote(release.release)});
    ${projects.map((p) => `
      INSERT INTO sos.projects(id,firm_id,sector_id,name,details,created_by,setup_state,setup_release_id)
        VALUES (${quote(p.id)},${quote(firm)},${quote(release.sector)},${quote(p.name)},${json(p.details)},${quote(identity)},'READY',${quote(release.release)});
      ${p.plots.map((plot) => {
        const data = { ...plot, areaSqYards: 200, ratePerSqYard: 1000 };
        return `INSERT INTO sos.erp_records(id,project_id,firm_id,kind,data,request_data,status,created_by,request_id)
          VALUES (${quote(randomUUID())},${quote(p.id)},${quote(firm)},'plots',${json(data)},${json(data)},'approved',${quote(identity)},${quote(randomUUID())});`;
      }).join('\n')}`).join('\n')}
    COMMIT;`);
  return { identity, firm, code, mobile, pin, projects, before };
}

function cleanup(fixture) {
  // Delete only UUID-scoped records created by this test; FK checks stay enabled.
  sql(`BEGIN;
    DELETE FROM sos.auth_sessions WHERE identity_id=${quote(fixture.identity)};
    DELETE FROM sos.project_cash_accounts WHERE project_id IN (SELECT id FROM sos.projects WHERE firm_id=${quote(fixture.firm)});
    DELETE FROM sos.erp_audit WHERE project_id IN (SELECT id FROM sos.projects WHERE firm_id=${quote(fixture.firm)});
    DELETE FROM sos.erp_records WHERE firm_id=${quote(fixture.firm)};
    DELETE FROM sos.erp_project_settings WHERE project_id IN (SELECT id FROM sos.projects WHERE firm_id=${quote(fixture.firm)});
    DELETE FROM sos.projects WHERE firm_id=${quote(fixture.firm)};
    DELETE FROM sos.firm_sector_assignments WHERE firm_id=${quote(fixture.firm)};
    DELETE FROM sos.firm_memberships WHERE firm_id=${quote(fixture.firm)};
    DELETE FROM sos.firms WHERE id=${quote(fixture.firm)};
    DELETE FROM sos.identities WHERE id=${quote(fixture.identity)};
    COMMIT;`);
}

module.exports = { seed, cleanup, snapshot };
