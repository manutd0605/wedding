# Cloudflare Worker JSON API

Worker này ghi/đọc `wishes.json` và `rsvp.json` trực tiếp trên GitHub repo bằng GitHub Contents API.

## 1) Chuẩn bị
- Cài `wrangler`: `npm i -g wrangler`
- Đăng nhập: `wrangler login`
- Vào thư mục `worker/`

## 2) Cấu hình
Sửa `wrangler.toml`:
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH` (main/master)
- `WISHES_FILE_PATH` (mặc định `wishes.json`)
- `RSVP_FILE_PATH` (mặc định `rsvp.json`)
- `ALLOWED_ORIGIN` (vd: `https://<user>.github.io` hoặc `*`)

## 3) Tạo GitHub token
Tạo Fine-grained PAT có quyền:
- Repository: repository bạn deploy
- Permissions: **Contents: Read and write**

Set secret cho Worker:
- `wrangler secret put GITHUB_TOKEN`

## 4) Deploy
- `wrangler deploy`
- Sau khi deploy, bạn có URL kiểu `https://wedding-json-api.<subdomain>.workers.dev`

## 5) Nối vào frontend
Trong `index.html`, đặt biến global trước script chính:

```html
<script>
  window.WEDDING_API_BASE = 'https://wedding-json-api.<subdomain>.workers.dev';
</script>
```

Nếu không set biến này, trang dùng relative path (`/api/...`) cho local server.

## 6) API endpoints
- `GET /api/wishes`
- `POST /api/wishes`
- `GET /api/rsvp`
- `POST /api/rsvp`
- `GET /wishes.json`
- `GET /rsvp.json`
