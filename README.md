# GeoExp Backend

Self-hosted Node.js + Express + MariaDB backend for location-based digital experiences.

<!-- deploy test 2 -->

---

## Requirements

- Node.js 18+
- MariaDB 10.6+
- Git, SSH access to your server
- A domain with SSL (Let's Encrypt or your host's SSL tool)

---

## First deployment

### 1. Clone the repository

```bash
cd /var/www
git clone <your-repo-url> geoexp
cd geoexp/backend
```

### 2. Install dependencies

```bash
npm install --production
```

### 3. Create the uploads directory

The uploads directory must live outside the repository so it is not deleted on `git pull`.

```bash
mkdir -p /var/www/geoexp/uploads/images
mkdir -p /var/www/geoexp/uploads/videos
```

Set ownership so Node can write:

```bash
chown -R www-data:www-data /var/www/geoexp/uploads
```

### 4. Configure environment variables

```bash
cp .env.example .env
nano .env
```

Fill in all values. Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run that twice — once for `SESSION_SECRET`, once for `APP_API_TOKEN_SECRET`.

### 5. Create the MariaDB database and user

```sql
CREATE DATABASE geoexp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'geoexp_user'@'127.0.0.1' IDENTIFIED BY 'your_strong_password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP
  ON geoexp.* TO 'geoexp_user'@'127.0.0.1';
FLUSH PRIVILEGES;
```

### 6. Run the database schema

```bash
mysql -u geoexp_user -p geoexp < database/schema.sql
```

### 7. Create the first admin account

```bash
node scripts/createAdmin.js
```

Follow the prompts. This is the only admin — you can add more via the admin UI later (feature in v1.1) or by running the script again.

### 8. Start the application

For development:

```bash
npm run dev
```

For production with your host's Node.js process manager or PM2:

```bash
# If your host uses a startup file, point it to src/app.js
# Example with PM2:
pm2 start src/app.js --name geoexp --env production
pm2 save
pm2 startup
```

### 9. Configure your reverse proxy (nginx example)

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # Proxy all traffic to Node
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Serve uploaded media directly via nginx for better performance
    # Comment this out if you prefer Node to serve media
    location /media/ {
        alias /var/www/geoexp/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options nosniff;
    }

    client_max_body_size 520M;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}
```

---

## Updating (pulling new code)

```bash
cd /var/www/geoexp/backend
git pull
npm install --production
# Run any new migration files:
mysql -u geoexp_user -p geoexp < database/migrations/XXX_description.sql
pm2 restart geoexp
```

---

## Database migrations

Schema changes after initial deployment go in numbered files:

```
database/migrations/001_initial.sql       ← initial schema (same as schema.sql)
database/migrations/002_add_tags.sql      ← future change
```

Always write migrations as non-destructive `ALTER TABLE … ADD COLUMN IF NOT EXISTS` statements. Never drop columns in production without a backup.

---

## Backup

### Database

Add to cron (`crontab -e`):

```cron
# Daily at 02:00 — backup GeoExp database
0 2 * * * mysqldump -u geoexp_user -pYOUR_PASSWORD geoexp | gzip > /var/backups/geoexp/db_$(date +\%Y\%m\%d).sql.gz

# Keep 30 days of backups
0 3 * * * find /var/backups/geoexp -name "db_*.sql.gz" -mtime +30 -delete
```

Create the backup directory:

```bash
mkdir -p /var/backups/geoexp
```

### Uploaded media files

```cron
# Daily at 03:30 — sync uploads to backup location
30 3 * * * rsync -a /var/www/geoexp/uploads/ /var/backups/geoexp/uploads/
```

### Restore

```bash
# Database
gunzip < /var/backups/geoexp/db_20240601.sql.gz | mysql -u geoexp_user -p geoexp

# Files
rsync -a /var/backups/geoexp/uploads/ /var/www/geoexp/uploads/
```

---

## API Reference

Base URL: `https://yourdomain.com`

All app-facing endpoints are under `/api/v1/`. No authentication required in v1 (places are public). Admin routes require a session cookie.

### GET /api/v1/places

Returns all published places. Used by the iPhone app for the map.

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "title": "Old Town Square",
      "slug": "old-town-square",
      "short_description": "The heart of the historic quarter.",
      "latitude": 59.33258,
      "longitude": 18.06490,
      "activation_radius_meters": 50,
      "preferred_bearing_degrees": 270.0,
      "preferred_distance_meters": 10,
      "category_id": 1,
      "category_name": "History",
      "category_slug": "history",
      "sort_order": 0,
      "hero_image_url": "https://yourdomain.com/media/images/2024/06/uuid.jpg"
    }
  ],
  "count": 1
}
```

### GET /api/v1/places/:id

Returns a single published place with all attached media.

**Response:**
```json
{
  "data": {
    "id": 1,
    "title": "Old Town Square",
    "slug": "old-town-square",
    "short_description": "The heart of the historic quarter.",
    "long_description": "Built in 1642, this square...",
    "latitude": 59.33258,
    "longitude": 18.06490,
    "activation_radius_meters": 50,
    "preferred_bearing_degrees": 270.0,
    "preferred_distance_meters": 10,
    "status": "published",
    "category_id": 1,
    "category_name": "History",
    "media": [
      {
        "id": 3,
        "type": "image",
        "original_filename": "photo_1890.jpg",
        "mime_type": "image/jpeg",
        "file_size": 204800,
        "width": 1200,
        "height": 900,
        "duration_seconds": null,
        "alt_text": "The square in 1890",
        "display_order": 0,
        "usage_type": "ar_overlay",
        "opacity_default": 0.85,
        "url": "https://yourdomain.com/media/images/2024/06/uuid.jpg"
      }
    ]
  }
}
```

---

## Admin routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/login | Login page |
| POST | /admin/login | Authenticate |
| POST | /admin/logout | Destroy session |
| GET | /admin/dashboard | Dashboard |
| GET | /admin/places | Place list |
| GET | /admin/places/new | New place form |
| POST | /admin/places | Create place |
| GET | /admin/places/:id | Place preview |
| GET | /admin/places/:id/edit | Edit place form |
| POST | /admin/places/:id | Update place |
| POST | /admin/places/:id/publish | Toggle status |
| POST | /admin/places/:id/delete | Delete place |
| POST | /admin/places/:id/media | Attach media |
| POST | /admin/places/:id/media/:pmId/delete | Unlink media |
| POST | /admin/places/:id/media/:pmId/order | Update order/type |
| GET | /admin/media | Media library |
| GET | /admin/media/upload | Upload form |
| POST | /admin/media/upload | Handle upload |
| POST | /admin/media/:id/delete | Delete asset + file |
| GET | /admin/categories | Categories |
| POST | /admin/categories | Create category |
| POST | /admin/categories/:id | Update category |
| POST | /admin/categories/:id/delete | Delete category |

---

## Security notes

- Passwords hashed with bcrypt (cost factor 12)
- Sessions stored server-side, cookie is httpOnly + secure + sameSite=lax
- CSRF token on all admin POST forms
- Rate limiting on login: 10 attempts per 15 minutes per IP
- File uploads: MIME type validation, safe random filenames, size limits
- All SQL queries use prepared statements (mysql2 pool.execute)
- Helmet sets security headers including CSP
- Uploads directory is outside the web root in the recommended nginx config

---

## Folder structure

See `docs/FOLDER_STRUCTURE.md`.
<!-- deploy test 3 -->
<!-- test 4 -->
