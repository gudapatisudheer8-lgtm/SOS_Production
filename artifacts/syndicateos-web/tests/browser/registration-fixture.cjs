// Explicit isolated browser fixture; never seed the preview or any remote database.
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
function sql(statement) {
  return execFileSync('psql', ['-X','-q','-At','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55447',
    '-U','sos_test','-d','sos_direct_test','-c',statement], {
    encoding:'utf8',env:{PATH:process.env.PATH,PGPASSFILE:'/tmp/sos-unused',PGCONNECT_TIMEOUT:'3'},
  }).trim();
}
async function seed() {
  if(sql("SELECT current_database()='sos_direct_test' AND inet_server_port()=55447 AND host(inet_server_addr())='127.0.0.1'")!=='t')
    throw new Error('Only the isolated registration test database is permitted.');
  const firm=randomUUID(),project=randomUUID(),accountant=randomUUID(),partner=randomUUID(),bank=randomUUID(),plot=randomUUID();
  const code='REG-'+randomUUID().slice(0,8).toUpperCase();
  const release=JSON.parse(sql(`SELECT row_to_json(t) FROM (
    SELECT r.id,r.sector_id FROM sos.sector_releases r JOIN sos.sectors s ON s.id=r.sector_id
    WHERE s.code='open-plotting' AND r.state='PUBLISHED' ORDER BY version DESC LIMIT 1) t`));
  const pin='123456',hash=await bcrypt.hash(pin,12),mobile='+919000001001',partnerMobile='+919000001002';
  const ids=[accountant,partner];
  for(const [i,id] of ids.entries()) sql(`INSERT INTO sos.identities(id,mobile,display_name,credential_hash,must_change_credential)
    VALUES(${quote(id)},${quote(i?partnerMobile:mobile)},${quote(i?'Registration test partner':'Registration test accountant')},${quote(hash)},false)`);
  sql(`INSERT INTO sos.firms(id,client_code,name,created_by) VALUES(${quote(firm)},${quote(code)},'Isolated registration browser firm',${quote(accountant)});
    INSERT INTO sos.firm_memberships(firm_id,identity_id,role_code) VALUES(${quote(firm)},${quote(accountant)},'ACCOUNTANT'),(${quote(firm)},${quote(partner)},'PARTNER');
    INSERT INTO sos.firm_sector_assignments(firm_id,sector_id,release_id) VALUES(${quote(firm)},${quote(release.sector_id)},${quote(release.id)});
    INSERT INTO sos.projects(id,firm_id,sector_id,name,created_by,setup_state,setup_release_id,details)
      VALUES(${quote(project)},${quote(firm)},${quote(release.sector_id)},'Registration browser project',${quote(accountant)},'READY',${quote(release.id)},'{"floorRatePerSqYard":1,"roadWidth":"30","extentValue":2,"extentUnit":"Acres"}');
    INSERT INTO sos.project_memberships(project_id,firm_id,identity_id) VALUES(${quote(project)},${quote(firm)},${quote(partner)});
    INSERT INTO sos.erp_records(id,project_id,firm_id,kind,data,request_data,status,created_by,request_id) VALUES
      (${quote(bank)},${quote(project)},${quote(firm)},'accounts','{"accountName":"Test project bank","status":"active","openingBalance":0}','{}','approved',${quote(accountant)},${quote(randomUUID())}),
      (${quote(plot)},${quote(project)},${quote(firm)},'plots','{"plotNumber":"REG-101","areaSqYards":100,"status":"available","ratePerSqYard":1000,"facing":"East"}','{}','approved',${quote(accountant)},${quote(randomUUID())});`);
  return {firm,project,accountant,partner,bank,plot,code,mobile,partnerMobile,pin};
}
module.exports={seed,sql};
if(require.main===module) seed().then(f=>console.log(JSON.stringify(f))).catch(e=>{console.error(e.message);process.exitCode=1;});
