const fs = require('fs');
const filePath = '/home/pixelwor/api.pixelworks.se/geoexp/src/routes/admin/content.js';
let content = fs.readFileSync(filePath, 'utf8');

// Fix UPDATE SET-listan
content = content.replace(
  '         evidence_label = ?, evidence_detail = ?,\n         suspect_name = ?',
  '         evidence_label = ?, evidence_detail = ?, evidence_image_id = ?,\n         suspect_name = ?'
);

// Fix UPDATE värdelistan
content = content.replace(
  '        toNullable(b.evidence_label),\n        toNullable(b.evidence_detail),\n        toNullable(b.suspect_name),',
  '        toNullable(b.evidence_label),\n        toNullable(b.evidence_detail),\n        b.evidence_image_id ? toInt(b.evidence_image_id) : null,\n        toNullable(b.suspect_name),'
);

const count = (content.match(/evidence_image_id/g) || []).length;
console.log('Antal evidence_image_id i filen: ' + count);
fs.writeFileSync(filePath, content);
console.log('OK');
