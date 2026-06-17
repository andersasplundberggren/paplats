const fs = require('fs');
const path = '/home/pixelwor/api.pixelworks.se/geoexp/src/app.js';

const broken = `app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "[cdnjs.cloudflare.com](http://cdnjs.cloudflare.com)"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "[tile.openstreetmap.org](http://tile.openstreetmap.org)", "*.[pixelworks.se](http://pixelworks.se)"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    }
  },
  crossOriginEmbedderPolicy: false
}));`;

const fixed = `app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "tile.openstreetmap.org", "*.pixelworks.se"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    }
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "no-referrer-when-downgrade" }
}));`;

const content = fs.readFileSync(path, 'utf8');
if (!content.includes(broken)) {
  console.error('FEL: Kunde inte hitta felaktig helmet-konfiguration');
  process.exit(1);
}
const updated = content.replace(broken, fixed);
fs.writeFileSync(path + '.bak3', content);
fs.writeFileSync(path, updated);
console.log('OK: Helmet fixat. Backup sparad som app.js.bak3');
