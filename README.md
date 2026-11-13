# Mom's Hands Cafe & Pasta, Dijital Menü

Mobile first digital menu with allergen icons, calorie info and a password protected admin panel.

* `/` public menu (Turkish)
* `/admin` admin panel: edit items, prices, allergens, settings, upload images
* `api/` Vercel functions. Menu data and images are stored in Vercel Blob.

Environment variables (Vercel):

* `ADMIN_PASSWORD` admin panel password
* `BLOB_READ_WRITE_TOKEN` set automatically when the Blob store is connected

`data/menu.json` is the default menu used until the first publish from the admin panel.
