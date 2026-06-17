const fs = require('fs');
const filePath = '/home/pixelwor/api.pixelworks.se/geoexp/src/app.js';
let content = fs.readFileSync(filePath, 'utf8');
const start = content.indexOf('// ─── Helmet');
if (start === -1) { console.error('Hittades inte'); process.exit(1); }
const end = content.indexOf('\nconst webappPath', start);
if (end === -1) { console.error('Slut hittades inte'); process.exit(1); }
const updated = content.substring(0, start) + content.substring(end + 1);
fs.writeFileSync(filePath, updated);
console.log('OK');
