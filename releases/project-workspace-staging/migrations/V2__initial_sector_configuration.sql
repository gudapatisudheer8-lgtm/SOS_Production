-- Initial content is DATA, not sector-specific application branches.
INSERT INTO sos.component_definitions(key,label,props_schema) VALUES
 ('summary','Project summary','{}'),('project-list','Project list','{}'),
 ('project-form','Project form','{}'),('partner-list','Partner list','{}'),('partner-form','Partner form','{}');
INSERT INTO sos.permission_definitions(key,label) VALUES
 ('projects.read','Read authorised projects'),('projects.write','Manage firm projects'),
 ('partners.read','Read authorised project membership'),('partners.write','Provision project partners');
INSERT INTO sos.action_definitions(key,label,handler_key,permission_key,input_schema) VALUES
 ('project.create','Create project','project.create','projects.write','{}'),
 ('project.update','Update project','project.update','projects.write','{}'),
 ('partner.add','Add partner','partner.add','partners.write','{}');
INSERT INTO sos.data_source_definitions(key,handler_key,permission_key,parameter_schema) VALUES
 ('projects','projects','projects.read','{}'),('partners','partners','partners.read','{}');

CREATE TEMPORARY TABLE sos_initial_configuration (
 code text, name text, manifest jsonb
) ON COMMIT DROP;
INSERT INTO sos_initial_configuration VALUES
('open-plotting','Open plotting',$json$
{
 "label":"Plotting foundation",
 "interfaces":[
  {"role":"ACCOUNTANT","title":"Plotting portfolio","screens":[
   {"key":"plotting-projects","label":"Plotting projects","components":[
    {"key":"summary","props":{"title":"Plotting project overview","description":"Manage project setup and membership. Inventory and financial posting will follow in a later release."},"fields":[],"actions":[]},
    {"key":"project-list","props":{"title":"Project register","emptyMessage":"Create your first plotting project."},"fields":[],"actions":[]},
    {"key":"project-form","props":{"title":"Plotting project details"},"fields":[
      {"key":"name","label":"Project name","kind":"text","required":true,"constraints":{"maxLength":160},"options":[]},
      {"key":"location","label":"Location","kind":"text","required":false,"constraints":{"maxLength":500},"options":[]},
      {"key":"details.plotCount","label":"Planned plot count","kind":"number","required":false,"constraints":{"min":0},"options":[]},
      {"key":"details.approvalReference","label":"Approval reference","kind":"text","required":false,"constraints":{"maxLength":120},"options":[]}
     ],"actions":[{"key":"project.create","label":"Create plotting project"},{"key":"project.update","label":"Save project changes"}]}
   ]},
   {"key":"plotting-partners","label":"Project partners","components":[
    {"key":"partner-list","props":{"title":"Partner access"},"fields":[],"actions":[]},
    {"key":"partner-form","props":{"title":"Add project partner"},"fields":[
     {"key":"name","label":"Partner name","kind":"text","required":true,"constraints":{"maxLength":120},"options":[]},
     {"key":"mobile","label":"Mobile number","kind":"text","required":true,"constraints":{"maxLength":24},"options":[]}
    ],"actions":[{"key":"partner.add","label":"Give partner access"}]}
   ]}
  ]},
  {"role":"PARTNER","title":"My plotting ventures","screens":[
   {"key":"my-plotting-projects","label":"My plotting projects","components":[
    {"key":"summary","props":{"title":"Your plotting membership","description":"Only projects assigned to you are available here. This foundation does not yet include capital balances or inventory."},"fields":[],"actions":[]},
    {"key":"project-list","props":{"title":"My project register"},"fields":[],"actions":[]},
    {"key":"partner-list","props":{"title":"My membership"},"fields":[],"actions":[]}
   ]}
  ]}
 ],
 "grants":[
  {"role":"ACCOUNTANT","permission":"projects.read","scope":"FIRM"},
  {"role":"ACCOUNTANT","permission":"projects.write","scope":"FIRM"},
  {"role":"ACCOUNTANT","permission":"partners.read","scope":"FIRM"},
  {"role":"ACCOUNTANT","permission":"partners.write","scope":"FIRM"},
  {"role":"PARTNER","permission":"projects.read","scope":"MEMBER_PROJECTS"},
  {"role":"PARTNER","permission":"partners.read","scope":"MEMBER_PROJECTS"}
 ]
}
$json$::jsonb),
('construction','Residential construction',$json$
{
 "label":"Construction foundation",
 "interfaces":[
  {"role":"ACCOUNTANT","title":"Construction workspace","screens":[
   {"key":"construction-register","label":"Construction register","components":[
    {"key":"summary","props":{"title":"Construction project overview","description":"Record project setup, development phase and partner access. Milestones, procurement and accounting are not yet enabled."},"fields":[],"actions":[]},
    {"key":"project-list","props":{"title":"Building projects","emptyMessage":"Create your first construction project."},"fields":[],"actions":[]},
    {"key":"project-form","props":{"title":"Construction project details"},"fields":[
     {"key":"name","label":"Project name","kind":"text","required":true,"constraints":{"maxLength":160},"options":[]},
     {"key":"location","label":"Site location","kind":"text","required":false,"constraints":{"maxLength":500},"options":[]},
     {"key":"details.unitCount","label":"Planned unit count","kind":"number","required":false,"constraints":{"min":0},"options":[]},
     {"key":"details.phase","label":"Development phase","kind":"select","required":false,"constraints":{},"options":[{"value":"planning","label":"Planning"},{"value":"execution","label":"Execution"},{"value":"handover","label":"Handover"}]},
     {"key":"details.startDate","label":"Planned start date","kind":"date","required":false,"constraints":{},"options":[]}
    ],"actions":[{"key":"project.create","label":"Create construction project"},{"key":"project.update","label":"Save construction details"}]}
   ]},
   {"key":"construction-partners","label":"Construction partners","components":[
    {"key":"partner-list","props":{"title":"Project membership"},"fields":[],"actions":[]},
    {"key":"partner-form","props":{"title":"Invite construction partner"},"fields":[
     {"key":"name","label":"Partner name","kind":"text","required":true,"constraints":{"maxLength":120},"options":[]},
     {"key":"mobile","label":"Mobile number","kind":"text","required":true,"constraints":{"maxLength":24},"options":[]}
    ],"actions":[{"key":"partner.add","label":"Add construction partner"}]}
   ]}
  ]},
  {"role":"PARTNER","title":"My construction ventures","screens":[
   {"key":"my-building-projects","label":"My building projects","components":[
    {"key":"summary","props":{"title":"Your construction membership","description":"View the setup of construction projects assigned to you. Financial and milestone modules will be released separately."},"fields":[],"actions":[]},
    {"key":"project-list","props":{"title":"My construction register"},"fields":[],"actions":[]},
    {"key":"partner-list","props":{"title":"My project access"},"fields":[],"actions":[]}
   ]}
  ]}
 ],
 "grants":[
  {"role":"ACCOUNTANT","permission":"projects.read","scope":"FIRM"},
  {"role":"ACCOUNTANT","permission":"projects.write","scope":"FIRM"},
  {"role":"ACCOUNTANT","permission":"partners.read","scope":"FIRM"},
  {"role":"ACCOUNTANT","permission":"partners.write","scope":"FIRM"},
  {"role":"PARTNER","permission":"projects.read","scope":"MEMBER_PROJECTS"},
  {"role":"PARTNER","permission":"partners.read","scope":"MEMBER_PROJECTS"}
 ]
}
$json$::jsonb);

DO $$
DECLARE
 seed record; sector uuid; release uuid; interface uuid; screen uuid; component uuid;
 field uuid; option_set uuid; u jsonb; s jsonb; c jsonb; f jsonb; o jsonb; a jsonb; g jsonb;
 screen_position integer; component_position integer; field_position integer; option_position integer;
BEGIN
 FOR seed IN SELECT * FROM sos_initial_configuration LOOP
  sector:=gen_random_uuid(); release:=gen_random_uuid();
  INSERT INTO sos.sectors(id,code,name) VALUES(sector,seed.code,seed.name);
  INSERT INTO sos.sector_releases(id,sector_id,version,label) VALUES(release,sector,1,seed.manifest->>'label');
  FOR u IN SELECT value FROM jsonb_array_elements(seed.manifest->'interfaces') LOOP
   interface:=gen_random_uuid();
   INSERT INTO sos.sector_interfaces(id,release_id,role_code,title) VALUES(interface,release,u->>'role',u->>'title');
   screen_position:=0;
   FOR s IN SELECT value FROM jsonb_array_elements(u->'screens') LOOP
    screen:=gen_random_uuid();
    INSERT INTO sos.interface_screens(id,release_id,interface_id,key,label,position)
      VALUES(screen,release,interface,s->>'key',s->>'label',screen_position);
    screen_position:=screen_position+1; component_position:=0;
    FOR c IN SELECT value FROM jsonb_array_elements(s->'components') LOOP
     component:=gen_random_uuid();
     INSERT INTO sos.screen_components(id,release_id,screen_id,component_key,props,position)
       VALUES(component,release,screen,c->>'key',c->'props',component_position);
     component_position:=component_position+1; field_position:=0;
     FOR f IN SELECT value FROM jsonb_array_elements(c->'fields') LOOP
      field:=gen_random_uuid(); option_set:=NULL;
      IF jsonb_array_length(f->'options')>0 THEN
       option_set:=gen_random_uuid();
       INSERT INTO sos.option_sets(id,release_id,key) VALUES(option_set,release,(c->>'key')||':'||(f->>'key'));
       option_position:=0;
       FOR o IN SELECT value FROM jsonb_array_elements(f->'options') LOOP
        INSERT INTO sos.options(id,release_id,option_set_id,value,label,position)
          VALUES(gen_random_uuid(),release,option_set,o->>'value',o->>'label',option_position);
        option_position:=option_position+1;
       END LOOP;
      END IF;
      INSERT INTO sos.field_definitions(id,release_id,key,label,kind,required,option_set_id,constraints)
        VALUES(field,release,f->>'key',f->>'label',f->>'kind',(f->>'required')::boolean,option_set,f->'constraints');
      INSERT INTO sos.form_fields(release_id,component_id,field_id,position) VALUES(release,component,field,field_position);
      field_position:=field_position+1;
     END LOOP;
     FOR a IN SELECT value FROM jsonb_array_elements(c->'actions') LOOP
      INSERT INTO sos.component_actions(release_id,component_id,action_key,label) VALUES(release,component,a->>'key',a->>'label');
     END LOOP;
    END LOOP;
   END LOOP;
  END LOOP;
  FOR g IN SELECT value FROM jsonb_array_elements(seed.manifest->'grants') LOOP
   INSERT INTO sos.permission_grants(release_id,role_code,permission_key,scope)
     VALUES(release,g->>'role',g->>'permission',g->>'scope');
  END LOOP;
  UPDATE sos.sector_releases SET state='PUBLISHED',published_at=now() WHERE id=release;
 END LOOP;
END $$;
