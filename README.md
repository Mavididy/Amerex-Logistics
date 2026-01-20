🚚 Amerex Logistics Platform

A full‑stack logistics, shipment tracking, and administration platform built with Supabase, JavaScript, and HTML/CSS. Amerex Logistics allows users to create shipments, generate tracking codes, upload video proof, apply coupons, track shipments in real time, and manage logistics operations securely.


---

🌍 Project Overview

Amerex Logistics is designed to handle:

Shipment creation (quotes & orders)

Automatic tracking code generation

Shipment tracking page

Video proof uploads (Supabase Storage)

User authentication (Login / Signup / Admin)

Admin & user role management

Secure database policies (RLS)


The platform is optimized for production use, with scalability, security, and real‑world logistics workflows in mind.


---

🧱 Tech Stack

Frontend

HTML5

CSS3

Vanilla JavaScript (Production‑ready)

Font Awesome (icons)


Backend / Services

Supabase

PostgreSQL database

Authentication (email/password + OAuth)

Row Level Security (RLS)

Edge Functions

Storage (video proof uploads)




---

🔐 Authentication & Roles

User Types

Normal Users

Create shipments

Track shipments

View own shipment history


Admins

View all shipments

Update shipment status

Manage tracking updates

Access admin dashboard



Admins are managed via:

admin_users table

Secure RLS policies



---

📦 Core Features

1️⃣ Create Shipment Page

Users can:

Enter sender & recipient details

Select service level (Express, Standard, Economy)

Add package dimensions and weight

Upload video proof (stored in Supabase Storage)

Apply coupon codes

Generate a unique tracking number


Tracking Code Format:

AMRX-G3IE-O2HJ-WIH1

Every shipment is stored in the shipments table.


---

2️⃣ Tracking System

Users can track shipments using the tracking code

Shipment updates are stored in shipment_updates

Each shipment can have:

Status updates

Location updates

Messages

Video proof link




---

3️⃣ Video Proof Upload

Videos are uploaded to Supabase Storage

Public URLs are saved in:

shipments.video_proof_url

shipments.video_recorded_at

shipments.video_notes



Videos are displayed on the tracking page if available.


---

4️⃣ Coupon System

Supported coupon types:

Percentage discounts

Fixed discounts

Free shipping (optional)


Coupons are applied client‑side, validated, and saved in the database:

coupon_code

discount_amount


(Admin‑only coupons can be enabled later.)


---

🗄️ Database Structure (Main Tables)

shipments

Stores all shipment records.

Key columns:

id

user_id

tracking_number

sender_*

recipient_*

package_type

weight, length, width, height

service_level

status

video_proof_url

created_at



---

shipment_updates

Stores shipment tracking history.

Key columns:

id

shipment_id

status

location

message

created_at



---

user_profiles

Stores extended user information.

Key columns:

user_id

email

account_type

created_at



---

admin_users

Controls admin access.

Key columns:

user_id

email

created_at



---

🔒 Security & RLS

Row Level Security (RLS) is enabled for all sensitive tables.

Examples:

Users can only view their own shipments

Admins can view & manage all shipments

Public users can read shipment status for tracking


Policies are carefully written to avoid recursion and privilege leaks.


---

📁 Project Structure

Amerex-Logistics/
│
├── index.html
├── login.html
├── dashboard.html
├── create-shipment.html
├── track.html
│
├── js/
│   ├── login.js
│   ├── create-shipment.js
│   ├── track.js
│   └── supabase.js
│
├── css/
│   └── styles.css
│
└── README.md


---

⚙️ Environment Setup

1️⃣ Create a Supabase project

2️⃣ Enable:

Authentication

Storage bucket (shipment-media)

Database tables


3️⃣ Add Supabase keys to supabase.js

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


---

🚀 Deployment

This project can be deployed on:

Netlify

Vercel

Firebase Hosting

Any static hosting provider


Supabase handles backend services.


---

🧪 Testing Checklist

✅ Signup & login

✅ Create shipment

✅ Generate tracking number

✅ Upload video proof

✅ Track shipment

✅ Admin access



---

🛠️ Future Improvements

Payment gateway integration

Admin dashboard UI

Real‑time tracking (maps)

Email notifications

Invoice generation



---

📞 Support

For support or development inquiries:

Amerex Logistics
📧 info.amerexlogistics@gmail.com


---

📄 License

This project is proprietary to Amerex Logistics. Unauthorized use or redistribution is prohibited.


---

✅ Built for production.
✅ Secure.
✅ Scalable.

Amerex Logistics – Delivering with precision.
