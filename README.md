# Sútil Laser

Professional catalog and customization storefront for personalized laser-engraved products.

The frontend is hosted on GitHub Pages. Product data, authentication, store settings and product photos are managed by a dedicated Supabase project.

**Start here:** [Portuguese setup and handover guide](README_PT.md).

## Quick links

- Public storefront: `index.html`
- Store administration: `admin.html`
- Public Supabase configuration: `config.js`
- Database schema, Row Level Security and initial catalog: `supabase/SETUP.sql`

## Project boundaries

This is currently a product catalog and quote/contact experience, not a complete online checkout. It does not yet process payments, shipping, fiscal documents or stock orders. The product preview is an image-based composition aid, not a manufacturing proof or 3D/CAD model.

Never place Supabase `service_role` keys, database passwords or private credentials in public files. The browser may contain only the publishable/anon key, protected by the SQL policies in `supabase/SETUP.sql`.
