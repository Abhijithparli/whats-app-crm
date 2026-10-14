// Usage: node deploy.js <flow.json-with-placeholders> <out.sql>
const fs = require("fs");
const json = fs.readFileSync(process.argv[2], "utf8");
const acct = "08fb83e9-cb90-4349-a5f3-ea7fe5d36839", uid = "0d75ca85-b303-48e3-b78c-e4b7adc11351";
const tag = (v, name, color) => `
  SELECT id INTO ${v} FROM tags WHERE account_id='${acct}' AND name='${name}';
  IF ${v} IS NULL THEN INSERT INTO tags(user_id,account_id,name,color) VALUES ('${uid}','${acct}','${name}','${color}') RETURNING id INTO ${v}; END IF;`;
fs.writeFileSync(process.argv[3], `DO $cns$
DECLARE v_order uuid; v_expert uuid; v_upi uuid; v_flow uuid; f jsonb; n jsonb; spec jsonb;
BEGIN
  DELETE FROM flows WHERE account_id='${acct}' AND name LIKE 'Care N Safe%';
  ${tag("v_order", "new-order", "#22c55e")}
  ${tag("v_expert", "expert-request", "#f59e0b")}
  ${tag("v_upi", "upi-payment-pending", "#8b5cf6")}
  spec := replace(replace(replace($json$${json}$json$, 'TAG_ORDER_PH', v_order::text), 'TAG_EXPERT_PH', v_expert::text), 'TAG_UPI_PH', v_upi::text)::jsonb;
  FOR f IN SELECT * FROM jsonb_array_elements(spec) LOOP
    INSERT INTO flows(user_id,account_id,name,description,status,trigger_type,trigger_config,entry_node_id)
    VALUES ('${uid}','${acct}', f->>'name', f->>'description', 'active', f->>'trigger_type', f->'trigger_config', f->>'entry_node_id')
    RETURNING id INTO v_flow;
    FOR n IN SELECT * FROM jsonb_array_elements(f->'nodes') LOOP
      INSERT INTO flow_nodes(flow_id,node_key,node_type,config,position_x,position_y)
      VALUES (v_flow, n->>'node_key', n->>'node_type', n->'config', (n->>'position_x')::int, (n->>'position_y')::int);
    END LOOP;
  END LOOP;
END
$cns$;`);
