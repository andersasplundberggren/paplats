const fs = require('fs');
const filePath = '/home/pixelwor/api.pixelworks.se/geoexp/src/routes/api/v1/assignments.js';
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Preview SELECT — lägg till evidence_image_id och JOIN
content = content.replace(
  '                cb.witness_reliability, cb.evidence_label, cb.evidence_detail,\n                cb.suspect_name',
  '                cb.witness_reliability, cb.evidence_label, cb.evidence_detail,\n                cb.evidence_image_id,\n                cb.suspect_name'
);

// Fix 2: Publik SELECT — lägg till evidence_image_id
content = content.replace(
  '                cb.evidence_label, cb.evidence_detail,\n                cb.suspect_name, cb.suspect_role, cb.suspect_motive,\n                cb.suspect_alibi, CAST',
  '                cb.evidence_label, cb.evidence_detail,\n                cb.evidence_image_id,\n                cb.suspect_name, cb.suspect_role, cb.suspect_motive,\n                cb.suspect_alibi, CAST'
);

// Fix 3: Preview response-objekt
content = content.replace(
  "          evidence_label:   b.evidence_label || null,",
  "          evidence_label:   b.evidence_label || null,\n          evidence_image_id: b.evidence_image_id || null,"
);

// Fix 4: Publik response-objekt
content = content.replace(
  "          evidence_label:  b.evidence_label || null,",
  "          evidence_label:  b.evidence_label || null,\n          evidence_image_id: b.evidence_image_id || null,"
);

const count = (content.match(/evidence_image_id/g) || []).length;
console.log('Antal evidence_image_id: ' + count);
if (count < 4) {
  console.error('FEL: Förväntade 4 träffar');
  process.exit(1);
}
fs.writeFileSync(filePath, content);
console.log('OK');
