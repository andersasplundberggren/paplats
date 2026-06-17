const fs = require('fs');
const filePath = '/home/pixelwor/api.pixelworks.se/geoexp/src/routes/admin/content.js';
let content = fs.readFileSync(filePath, 'utf8');

// ─── Fix 1: INSERT — lägg till evidence_image_id i kolumnlistan
content = content.replace(
  `witness_name, witness_role, witness_statement, witness_reliability, witness_image_id,
          evidence_label, evidence_detail)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  `witness_name, witness_role, witness_statement, witness_reliability, witness_image_id,
          evidence_label, evidence_detail, evidence_image_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
);

// ─── Fix 2: INSERT — lägg till värdet i värdelistan
content = content.replace(
  `        // Bevisblock
        toNullable(b.evidence_label),
        toNullable(b.evidence_detail)
      ]
    );

    req.flash('success', 'Blocket lades till.')`,
  `        // Bevisblock
        toNullable(b.evidence_label),
        toNullable(b.evidence_detail),
        b.evidence_image_id ? toInt(b.evidence_image_id) : null
      ]
    );

    req.flash('success', 'Blocket lades till.')`
);

// ─── Fix 3: UPDATE — lägg till evidence_image_id i SET-listan
content = content.replace(
  `         evidence_label = ?, evidence_detail = ?
       WHERE id = ? AND place_id = ?`,
  `         evidence_label = ?, evidence_detail = ?, evidence_image_id = ?
       WHERE id = ? AND place_id = ?`
);

// ─── Fix 4: UPDATE — lägg till värdet i värdelistan
content = content.replace(
  `        // Bevisblock
        toNullable(b.evidence_label),
        toNullable(b.evidence_detail),
        blockId,
        placeId`,
  `        // Bevisblock
        toNullable(b.evidence_label),
        toNullable(b.evidence_detail),
        b.evidence_image_id ? toInt(b.evidence_image_id) : null,
        blockId,
        placeId`
);

fs.writeFileSync(filePath + '.bak', content);
fs.writeFileSync(filePath, content);
console.log('OK');
