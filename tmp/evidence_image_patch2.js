const fs = require('fs');
const filePath = '/home/pixelwor/api.pixelworks.se/geoexp/src/routes/admin/content.js';
let content = fs.readFileSync(filePath, 'utf8');

// Fix INSERT kolumnlistan
content = content.replace(
  '          evidence_label, evidence_detail,\n          suspect_name,',
  '          evidence_label, evidence_detail, evidence_image_id,\n          suspect_name,'
);

// Fix INSERT värdelistan
content = content.replace(
  '        toNullable(b.evidence_label),\n        toNullable(b.evidence_detail),\n        toNullable(b.suspect_name),',
  '        toNullable(b.evidence_label),\n        toNullable(b.evidence_detail),\n        b.evidence_image_id ? toInt(b.evidence_image_id) : null,\n        toNullable(b.suspect_name),'
);

const count = (content.match(/evidence_image_id/g) || []).length;
if (count < 2) {
  console.error('FEL: Förväntade minst 2 träffar, hittade ' + count);
  process.exit(1);
}

fs.writeFileSync(filePath, content);
console.log('OK - evidence_image_id tillagt i INSERT (' + count + ' ställen)');
