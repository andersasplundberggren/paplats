const fs = require('fs');
const filePath = '/home/pixelwor/api.pixelworks.se/geoexp/src/app.js';
let content = fs.readFileSync(filePath, 'utf8');

// Ta bort hela helmet-blocket oavsett hur URL:erna ser ut
const start = content.indexOf('// ─── Helmet');
const end = content.indexOf('// ─────────────────────────────────────────────────────────────\nconst webappPath');

if (start === -1 || end === -1) {
  console.error('FEL: Kunde inte hitta helmet-blocket. start=' + start + ' end=' + end);
  process.exit(1);
}

const before = content.substring(0, start);
const after = content.substring(end);

const helmetBlock = `// ─── Helmet — HTTP-säkerhetsheaders ──────────────────────────
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "tile.openstreetmap.org", "*.pixelworks.se", "api.pixelworks.se"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    }
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "no-referrer-when-downgrade" }
}));
`;

const updated = before + helmetBlock + after;
fs.writeFileSync(filePath, updated);
console.log('OK');
