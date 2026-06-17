const fs = require('fs');
const path = '/home/pixelwor/api.pixelworks.se/geoexp/src/app.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  `      scriptSrc: ["'self'", "'unsafe-inline'", "[cdnjs.cloudflare.com](http://cdnjs.cloudflare.com)"],`,
  `      scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],`
);
content = content.replace(
  `      imgSrc: ["'self'", "data:", "[tile.openstreetmap.org](http://tile.openstreetmap.org)", "*.[pixelworks.se](http://pixelworks.se)"],`,
  `      imgSrc: ["'self'", "data:", "tile.openstreetmap.org", "*.pixelworks.se", "api.pixelworks.se"],`
);
content = content.replace(
  `  crossOriginEmbedderPolicy: false`,
  `  crossOriginEmbedderPolicy: false,\n  referrerPolicy: { policy: "no-referrer-when-downgrade" }`
);

fs.writeFileSync(path, content);
console.log('OK');
